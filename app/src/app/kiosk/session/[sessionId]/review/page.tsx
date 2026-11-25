"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { cacheBustedPhotoUrl } from "@/components/kiosk/api";
import { useConfig, useHeartbeat, useKioskSession } from "@/components/kiosk/hooks";
import { ConnectingOverlay, SessionEndedOverlay } from "@/components/kiosk/ScreenOverlays";

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";

  const { config } = useConfig();
  const [ended, setEnded] = useState(false);
  const [retakeShot, setRetakeShot] = useState<number | null>(null);
  const busyRef = useRef(false);

  const editorPath = `/kiosk/session/${sessionId}/editor`;
  const capturePath = `/kiosk/session/${sessionId}/capture`;

  const { data, connection } = useKioskSession(sessionId, {
    onCancelled: () => setEnded(true),
  });

  useHeartbeat("REVIEW");

  const quota = config?.retakeQuota ?? 3;
  const used = data?.session?.retakeCountUsed ?? 0;
  const quotaLeft = Math.max(0, quota - used);

  useEffect(() => {
    if (!data) return;
    if (!data.session || !data.session.frameId) router.replace(`/kiosk/frame/${data.id}`);
    else if (data.session.hasFinal) router.replace(`/kiosk/session/${sessionId}/done`);
  }, [data, router, sessionId]);

  const retake = useCallback(
    (shotIndex: number) => {
      if (busyRef.current || quotaLeft <= 0) return;
      busyRef.current = true;
      setRetakeShot(shotIndex);
      router.replace(`${capturePath}?retake=${shotIndex}`);
    },
    [capturePath, quotaLeft, router]
  );

  const photos = data?.session?.photos ?? [];
  const slots = Array.from({ length: 6 }, (_, i) => photos.find((p) => p.shotIndex === i + 1));

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
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
          {!data
            ? "Memuat sesi..."
            : quotaLeft > 0
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
                    src={cacheBustedPhotoUrl(photo)}
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
                disabled={
                  !data?.session?.photos.some((item) => item.shotIndex === idx + 1) ||
                  quotaLeft <= 0 ||
                  retakeShot !== null
                }
                onClick={() => retake(idx + 1)}
                className="mt-2 border-4 border-ink bg-brand-cyan py-2 font-display text-sm uppercase shadow-brut-sm transition-transform duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:disabled-stripes disabled:cursor-not-allowed"
              >
                {copy.kiosk.review.retake}
              </button>
            </div>
          ))}
        </div>
      </main>

      <footer className="shrink-0 border-t-4 border-ink bg-white p-4 lg:p-5">
        <button
          type="button"
          disabled={!data || photos.length < 6 || retakeShot !== null}
          onClick={() => router.push(editorPath)}
          className="mx-auto block w-full max-w-3xl border-4 border-ink bg-brand-green py-5 font-display text-2xl uppercase shadow-brut-lg transition-transform duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:disabled-stripes disabled:cursor-not-allowed lg:text-3xl"
        >
          {copy.kiosk.review.continue}
        </button>
      </footer>
      <ConnectingOverlay show={connection === "offline" && !ended} />
      {ended && <SessionEndedOverlay onDone={() => router.replace("/kiosk")} />}
    </div>
  );
}
