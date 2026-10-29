"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const sessionId = params?.sessionId ?? "";

  const { config } = useConfig();
  const [ended, setEnded] = useState(false);
  const [shot, setShot] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

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

  useHeartbeat("CAPTURE", {
    devices: camera.devices,
    cameraStatus: camera.error ? "ERROR" : camera.active ? "ACTIVE" : "IDLE",
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
    if (s.photoCount >= SHOT_COUNT) router.replace(editorPath);
  }, [data, router, donePath, editorPath]);

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
        const blob = await camera.capture();
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
    [countdownSec, camera, upload, router, reviewPath]
  );

  /* Mulai otomatis setelah kamera aktif & sesi termuat (§7.5). */
  useEffect(() => {
    if (startedRef.current || ended) return;
    if (!data?.session || !camera.active) return;

    const start = data.session.photoCount + 1;
    if (start > SHOT_COUNT) {
      router.replace(editorPath);
      return;
    }
    startedRef.current = true;
    void runSession(start);
  }, [data, camera.active, ended, runSession, router, editorPath]);

  const frame = data?.session?.frame;
  const ratio = frame?.slots?.[0]
    ? frame.slots[0].w / frame.slots[0].h
    : frame
      ? frame.canvasWidth / frame.canvasHeight
      : 4 / 3;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {flash && <div className="fixed inset-0 z-[95] bg-white animate-flash" />}

      <header className="flex shrink-0 items-center justify-between border-b-4 border-ink bg-brand-cyan p-3 lg:p-4">
        <span className="font-display text-xl uppercase tracking-tight lg:text-2xl">
          {copy.kiosk.capture.shot(shot, SHOT_COUNT)}
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: SHOT_COUNT }, (_, i) => {
            const filled = i + 1 <= (data?.session?.photoCount ?? 0) || i + 1 < shot;
            const current = i + 1 === shot && countdown !== null;
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
          ref={camera.videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full scale-x-[-1] object-cover"
        />

        <div className="pointer-events-none absolute inset-4 flex items-center justify-center overflow-hidden">
          <div
            className="h-full w-auto border-4 border-dashed border-white/70"
            style={{ aspectRatio: String(ratio) }}
          />
        </div>

        {countdown !== null && countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40">
            <div className="animate-pop border-8 border-ink bg-brand-yellow p-10 text-center shadow-brut-xl">
              <p className="mb-2 font-display text-2xl uppercase">{copy.kiosk.capture.getReady}</p>
              <p className="font-display text-8xl leading-none lg:text-9xl">{countdown}</p>
            </div>
          </div>
        )}

        {(camera.error || !camera.active) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-paper/95 p-6">
            <div className="w-full max-w-xl border-4 border-ink bg-white p-6 text-center shadow-brut-xl">
              <div className="mb-4 border-4 border-ink bg-brand-red p-3 shadow-brut">
                <p className="font-display text-2xl uppercase text-white">
                  ⚠ Kamera belum terhubung
                </p>
              </div>
              <p className="mb-5 font-sans text-sm text-ink/80">{camera.error}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={camera.restart}
                  className="border-4 border-ink bg-brand-yellow px-6 py-3 font-display text-lg uppercase shadow-brut active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  Pindai Ulang Kamera
                </button>
                {camera.devices.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = camera.devices.findIndex(
                        (d) => d.deviceId === camera.selectedDeviceId
                      );
                      const next = camera.devices[(idx + 1) % camera.devices.length];
                      camera.selectDevice(next.deviceId);
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

      <footer className="shrink-0 border-t-4 border-ink bg-white p-3 text-center lg:p-4">
        <p className="font-sans text-sm text-ink/70">
          Posisikan wajah di dalam garis putus-putus. Foto diambil otomatis.
        </p>
      </footer>

      <ConnectingOverlay show={connection === "offline" && !ended} />
      {ended && <SessionEndedOverlay onDone={() => router.replace("/kiosk")} />}
    </div>
  );
}
