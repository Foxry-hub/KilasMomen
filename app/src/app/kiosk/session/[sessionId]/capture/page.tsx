"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { SHOT_COUNT } from "@/lib/constants";
import { kioskUpload } from "@/components/kiosk/api";
import { useConfig, useHeartbeat, useKioskSession } from "@/components/kiosk/hooks";
import { ConnectingOverlay, SessionEndedOverlay } from "@/components/kiosk/ScreenOverlays";
import { useCamera } from "@/components/kiosk/useCamera";
import { playCountdownBeep, playShutterSound } from "@/components/kiosk/sfx";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default function CapturePage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = params?.sessionId ?? "";
  const retakeParam = searchParams.get("retake");
  const retakeMode = retakeParam !== null;
  const requestedShot = retakeParam === null ? NaN : Number(retakeParam);
  const retakeShot =
    Number.isInteger(requestedShot) && requestedShot >= 1 && requestedShot <= SHOT_COUNT
      ? requestedShot
      : null;

  const { config } = useConfig();
  const [ended, setEnded] = useState(false);
  const [shot, setShot] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [retakeError, setRetakeError] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const uploadsRef = useRef<Promise<unknown>[]>([]);

  const reviewPath = `/kiosk/session/${sessionId}/review`;
  const editorPath = `/kiosk/session/${sessionId}/editor`;
  const donePath = `/kiosk/session/${sessionId}/done`;

  const { data, connection } = useKioskSession(sessionId, {
    onCancelled: () => {
      cancelledRef.current = true;
      setEnded(true);
    },
  });

  const camera = useCamera({
    source: config?.camera.source,
    deviceLabel: config?.camera.deviceLabel ?? null,
    deviceId: config?.camera.deviceId ?? null,
    maxResolution: config?.camera.maxResolution,
    enabled: !ended,
  });
  const {
    active: cameraActive,
    capture,
    devices: cameraDevices,
    error: cameraError,
    restart: restartCamera,
    selectDevice,
    selectedDeviceId,
    videoRef,
  } = camera;

  useHeartbeat("CAPTURE", {
    devices: cameraDevices,
    cameraStatus: cameraError ? "ERROR" : cameraActive ? "ACTIVE" : "IDLE",
  });

  const countdownSec = config?.countdownSec ?? 3;

  /* Guard layar: arahkan ke layar yang benar sesuai data (§7.9). */
  useEffect(() => {
    if (!data) return;
    const s = data.session;
    if (!s || !s.frameId) {
      router.replace(`/kiosk/frame/${data.id}`);
      return;
    }
    if (s.hasFinal) {
      router.replace(donePath);
      return;
    }
    if (retakeMode) {
      if (!retakeShot || !s.photos.some((photo) => photo.shotIndex === retakeShot)) {
        router.replace(reviewPath);
      }
      return;
    }
    if (s.photoCount >= SHOT_COUNT) router.replace(editorPath);
  }, [data, router, donePath, editorPath, retakeMode, retakeShot, reviewPath]);

  const upload = useCallback(
    (shotIndex: number, blob: Blob) => {
      const form = new FormData();
      form.append("shotIndex", String(shotIndex));
      form.append("isRetake", "false");
      form.append("file", blob, `shot-${shotIndex}.jpg`);
      return kioskUpload(`/api/kiosk/sessions/${sessionId}/photos`, form).then((res) => {
        if (res.status === 409) {
          cancelledRef.current = true;
          setEnded(true);
        }
        return res;
      });
    },
    [sessionId]
  );

  const runRetake = useCallback(
    async (shotIndex: number) => {
      setShot(shotIndex);
      for (let seconds = countdownSec; seconds >= 1; seconds--) {
        if (cancelledRef.current) return;
        setCountdown(seconds);
        playCountdownBeep(seconds === 1);
        await sleep(1000);
      }

      if (cancelledRef.current) return;
      setCountdown(0);
      const blob = await capture();
      setFlash(true);
      playShutterSound();
      setTimeout(() => setFlash(false), 200);
      if (!blob) {
        setCountdown(null);
        setRetakeError("Foto tidak berhasil diambil. Silakan coba lagi.");
        startedRef.current = false;
        return;
      }

      const form = new FormData();
      form.append("file", blob, `shot-${shotIndex}.jpg`);
      const result = await kioskUpload(
        `/api/kiosk/sessions/${sessionId}/photos/${shotIndex}/retake`,
        form
      );
      setCountdown(null);
      if (!result.ok) {
        if (result.status === 409 && result.conflictStatus !== "PROCESSING") {
          setEnded(true);
          return;
        }
        setRetakeError(result.error ?? "Gagal menyimpan foto ulang.");
        startedRef.current = false;
        return;
      }
      router.replace(reviewPath);
    },
    [capture, countdownSec, reviewPath, router, sessionId]
  );

  const runSession = useCallback(
    async (start: number) => {
      for (let i = start; i <= SHOT_COUNT; i++) {
        if (cancelledRef.current) return;
        setShot(i);

        for (let s = countdownSec; s >= 1; s--) {
          if (cancelledRef.current) return;
          setCountdown(s);
          playCountdownBeep(s === 1);
          await sleep(1000);
        }

        setCountdown(0);
        const blob = await capture();
        setFlash(true);
        playShutterSound();
        setTimeout(() => setFlash(false), 200);

        if (blob) uploadsRef.current.push(upload(i, blob));
        await sleep(1000);
      }

      setCountdown(null);
      if (cancelledRef.current) return;
      await Promise.allSettled(uploadsRef.current);
      if (!cancelledRef.current) router.replace(reviewPath);
    },
    [countdownSec, capture, upload, router, reviewPath]
  );

  /* Mulai otomatis setelah kamera aktif & sesi termuat (§7.5). */
  useEffect(() => {
    if (startedRef.current || ended) return;
    if (!data?.session || !cameraActive) return;

    if (retakeMode) {
      if (!retakeShot || retakeError) return;
      if (!data.session.photos.some((photo) => photo.shotIndex === retakeShot)) {
        router.replace(reviewPath);
        return;
      }
      startedRef.current = true;
      const timer = window.setTimeout(() => {
        void runRetake(retakeShot);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const start = data.session.photoCount + 1;
    if (start > SHOT_COUNT) {
      router.replace(editorPath);
      return;
    }
    startedRef.current = true;
    void runSession(start);
  }, [
    data,
    cameraActive,
    ended,
    retakeMode,
    retakeShot,
    retakeError,
    runRetake,
    runSession,
    router,
    reviewPath,
    editorPath,
  ]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {flash && <div className="fixed inset-0 z-[95] bg-white animate-flash" />}

      <header className="flex shrink-0 items-center justify-between border-b-4 border-ink bg-brand-cyan p-3 lg:p-4">
        <span className="font-display text-xl uppercase tracking-tight lg:text-2xl">
          {retakeMode
            ? `FOTO ULANG #${retakeShot ?? "?"}`
            : copy.kiosk.capture.shot(shot, SHOT_COUNT)}
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: SHOT_COUNT }, (_, i) => {
            const isRetakeShot = retakeMode && i + 1 === retakeShot;
            const filled =
              !isRetakeShot &&
              (i + 1 <= (data?.session?.photoCount ?? 0) || i + 1 < shot);
            const current = isRetakeShot || (i + 1 === shot && countdown !== null);
            return (
              <span
                key={i}
                className={[
                  "size-4 border-2 border-ink",
                  filled ? "bg-brand-green" : current ? "bg-brand-yellow" : "bg-white",
                ].join(" ")}
              />
            );
          })}
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-ink">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full scale-x-[-1] object-cover"
        />

        {retakeError && retakeMode && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/70 p-6">
            <div className="w-full max-w-lg border-4 border-ink bg-white p-6 text-center shadow-brut-xl">
              <p className="mb-5 font-display text-xl uppercase text-brand-red">{retakeError}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRetakeError(null);
                    startedRef.current = false;
                  }}
                  className="border-4 border-ink bg-brand-yellow px-5 py-3 font-display uppercase shadow-brut"
                >
                  Coba Lagi
                </button>
                <button
                  type="button"
                  onClick={() => router.replace(reviewPath)}
                  className="border-4 border-ink bg-white px-5 py-3 font-display uppercase shadow-brut"
                >
                  Kembali ke Review
                </button>
              </div>
            </div>
          </div>
        )}

        {countdown !== null && countdown > 0 && (
          <div className="pointer-events-none absolute right-4 top-4 z-20 lg:right-8 lg:top-8">
            <div className="animate-pop border-4 border-ink bg-brand-yellow p-4 text-center shadow-brut-lg lg:p-5">
              <p className="mb-1 font-display text-base uppercase lg:text-lg">
                {copy.kiosk.capture.getReady}
              </p>
              <p className="font-display text-6xl leading-none lg:text-7xl">{countdown}</p>
            </div>
          </div>
        )}

        {(cameraError || !cameraActive) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-paper/95 p-6">
            <div className="w-full max-w-xl border-4 border-ink bg-white p-6 text-center shadow-brut-xl">
              <div className="mb-4 border-4 border-ink bg-brand-red p-3 shadow-brut">
                <p className="font-display text-2xl uppercase text-white">
                  ⚠ Kamera belum terhubung
                </p>
              </div>
              <p className="mb-5 font-sans text-sm text-ink/80">{cameraError}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={restartCamera}
                  className="border-4 border-ink bg-brand-yellow px-6 py-3 font-display text-lg uppercase shadow-brut active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  Pindai Ulang Kamera
                </button>
                {cameraDevices.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = cameraDevices.findIndex(
                        (d) => d.deviceId === selectedDeviceId
                      );
                      const next = cameraDevices[(idx + 1) % cameraDevices.length];
                      selectDevice(next.deviceId);
                    }}
                    className="border-4 border-ink bg-white px-6 py-3 font-display text-lg uppercase shadow-brut active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    Ganti Kamera
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <ConnectingOverlay show={connection === "offline" && !ended} />
      {ended && <SessionEndedOverlay onDone={() => router.replace("/kiosk")} />}
    </div>
  );
}
