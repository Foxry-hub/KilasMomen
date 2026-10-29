"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { kioskUpload } from "@/components/kiosk/api";
import { useConfig, useHeartbeat, useKioskSession } from "@/components/kiosk/hooks";
import { ConnectingOverlay, SessionEndedOverlay } from "@/components/kiosk/ScreenOverlays";
import { useCamera } from "@/components/kiosk/useCamera";
import { playCountdownBeep, playShutterSound } from "@/components/kiosk/sfx";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";

  const { config } = useConfig();
  const [ended, setEnded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retakeShot, setRetakeShot] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const busyRef = useRef(false);

  const editorPath = `/kiosk/session/${sessionId}/editor`;

  const { data, connection, refresh } = useKioskSession(sessionId, {
    onCancelled: () => setEnded(true),
  });

  const camera = useCamera({
    source: config?.camera.source,
    deviceLabel: config?.camera.deviceLabel ?? null,
    maxResolution: config?.camera.maxResolution,
    enabled: !ended,
  });

  useHeartbeat("REVIEW", {
    devices: camera.devices,
    cameraStatus: camera.error ? "ERROR" : camera.active ? "ACTIVE" : "IDLE",
  });

  const countdownSec = config?.countdownSec ?? 3;
  const quota = config?.retakeQuota ?? 3;
  const used = data?.session?.retakeCountUsed ?? 0;
  const quotaLeft = Math.max(0, quota - used);

  useEffect(() => {
    if (!data) return;
    if (!data.session || !data.session.frameId) router.replace(`/kiosk/frame/${data.id}`);
    else if (data.session.hasFinal) router.replace(`/kiosk/session/${sessionId}/done`);
  }, [data, router, sessionId]);

  const retake = useCallback(
    async (shotIndex: number) => {
      if (busyRef.current || quotaLeft <= 0) return;
      busyRef.current = true;
      setNotice(null);
      setRetakeShot(shotIndex);

      for (let s = countdownSec; s >= 1; s--) {
        setCountdown(s);
        playCountdownBeep(s === 1);
        await sleep(1000);
      }

      setCountdown(0);
      const blob = await camera.capture();
      setFlash(true);
      playShutterSound();
      setTimeout(() => setFlash(false), 200);

      if (blob) {
        const form = new FormData();
        form.append("shotIndex", String(shotIndex));
        form.append("isRetake", "true");
        form.append("file", blob, `shot-${shotIndex}.jpg`);
        const res = await kioskUpload(`/api/kiosk/sessions/${sessionId}/photos`, form);
        if (!res.ok) {
          if (res.status === 409 && res.conflictStatus === "PROCESSING") {
            setNotice(copy.kiosk.review.retakeEmpty);
          } else if (res.status === 409) {
            setEnded(true);
          }
        }
      }

      setCountdown(null);
      setRetakeShot(null);
      busyRef.current = false;
      refresh();
    },
    [camera, countdownSec, quotaLeft, refresh, sessionId]
  );

  const photos = data?.session?.photos ?? [];
  const slots = Array.from({ length: 6 }, (_, i) => photos.find((p) => p.shotIndex === i + 1));

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {flash && <div className="fixed inset-0 z-[95] bg-white animate-flash" />}

      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-4 border-ink bg-white p-4 lg:p-5">
        <h1 className="font-display text-2xl uppercase tracking-tight lg:text-3xl">
          {copy.kiosk.review.title}
        </h1>
        <span
          className={[
            "border-4 border-ink px-4 py-2 font-display text-sm uppercase shadow-brut-sm lg:text-base",
            quotaLeft > 0 ? "bg-brand-yellow" : "bg-brand-red text-white",
          ].join(" ")}
        >
          {quotaLeft > 0
            ? copy.kiosk.review.retakeLeft(quotaLeft)
            : copy.kiosk.review.retakeEmpty}
        </span>
      </header>

      <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-4 md:grid-cols-3">
          {slots.map((photo, idx) => (
            <div key={idx} className="flex flex-col border-4 border-ink bg-white p-2 shadow-brut">
              <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-ink/10">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={`Foto ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-ink/30">#{idx + 1}</span>
                )}
                <span className="absolute left-1 top-1 border-2 border-ink bg-white px-2 font-mono text-xs">
                  #{idx + 1}
                </span>
              </div>
              <button
                type="button"
                disabled={quotaLeft <= 0 || retakeShot !== null}
                onClick={() => retake(idx + 1)}
                className="mt-2 border-4 border-ink bg-brand-cyan py-2 font-display text-sm uppercase shadow-brut-sm transition-transform duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:disabled-stripes disabled:cursor-not-allowed"
              >
                {copy.kiosk.review.retake}
              </button>
            </div>
          ))}
        </div>
        {notice && (
          <p className="mt-4 text-center font-display text-sm uppercase text-brand-red">{notice}</p>
        )}
      </main>

      <footer className="shrink-0 border-t-4 border-ink bg-white p-4 lg:p-5">
        <button
          type="button"
          disabled={photos.length < 6 || retakeShot !== null}
          onClick={() => router.push(editorPath)}
          className="mx-auto block w-full max-w-3xl border-4 border-ink bg-brand-green py-5 font-display text-2xl uppercase shadow-brut-lg transition-transform duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:disabled-stripes disabled:cursor-not-allowed lg:text-3xl"
        >
          {copy.kiosk.review.continue}
        </button>
      </footer>

      {/* Overlay pengambilan ulang (§7.6) */}
      {retakeShot !== null && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-ink">
          <video
            ref={camera.videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />
          {countdown !== null && countdown > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40">
              <div className="animate-pop border-8 border-ink bg-brand-yellow p-10 text-center shadow-brut-xl">
                <p className="mb-2 font-display text-2xl uppercase">
                  {copy.kiosk.review.retake} #{retakeShot}
                </p>
                <p className="font-display text-8xl leading-none lg:text-9xl">{countdown}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <ConnectingOverlay show={connection === "offline" && !ended} />
      {ended && <SessionEndedOverlay onDone={() => router.replace("/kiosk")} />}
    </div>
  );
}
