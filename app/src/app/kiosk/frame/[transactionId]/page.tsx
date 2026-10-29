"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { kioskJson } from "@/components/kiosk/api";
import { useHeartbeat, useStatusPoll } from "@/components/kiosk/hooks";
import { SessionEndedOverlay } from "@/components/kiosk/ScreenOverlays";
import { deriveScreen } from "@/components/kiosk/recovery";
import type { FrameRow } from "@/components/kiosk/types";

const FILTERS = ["ALL", "TWO", "THREE", "MANY"] as const;
type Filter = (typeof FILTERS)[number];

export default function FramePage() {
  const router = useRouter();
  const params = useParams<{ transactionId: string }>();
  const transactionId = params?.transactionId ?? "";

  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const startedRef = useRef(false);

  const goSplash = useCallback(() => router.replace("/kiosk"), [router]);

  const { data } = useStatusPoll(transactionId, { onCancelled: () => setEnded(true) });
  useHeartbeat("FRAME");

  /* Pemicu T3 saat layar dibuka (§7.4). */
  useEffect(() => {
    if (startedRef.current || !transactionId) return;
    startedRef.current = true;
    kioskJson<{ sessionId: string }>(
      `/api/kiosk/transactions/${transactionId}/start-processing`,
      { method: "POST" }
    ).then((res) => {
      if (res.ok && res.data) setSessionId(res.data.sessionId);
      else if (res.status === 409) setEnded(true);
      else router.replace(`/kiosk/payment/${transactionId}`);
    });
  }, [transactionId, router]);

  /* Katalog frame (§7.4). */
  useEffect(() => {
    kioskJson<{ frames: FrameRow[] }>("/api/kiosk/frames").then((res) => {
      if (res.ok && res.data) setFrames(res.data.frames);
    });
  }, []);

  /* Sudah memilih frame → lanjutkan (§7.9). */
  useEffect(() => {
    if (data?.session?.frameId) {
      router.replace(deriveScreen(data));
    }
  }, [data, router]);

  const chooseFrame = useCallback(
    async (frameId: string) => {
      if (!sessionId || busy) return;
      setBusy(true);
      const res = await kioskJson(`/api/kiosk/sessions/${sessionId}/frame`, {
        method: "PATCH",
        body: { frameId },
      });
      setBusy(false);
      if (res.ok) router.push(`/kiosk/session/${sessionId}/capture`);
      else if (res.status === 409) setEnded(true);
    },
    [sessionId, busy, router]
  );

  const visible = filter === "ALL" ? frames : frames.filter((f) => f.category === filter);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b-4 border-ink bg-white p-4 lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl uppercase tracking-tight lg:text-3xl">
            {copy.kiosk.frame.title}
          </h1>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={[
                  "border-4 border-ink px-4 py-2 font-display text-sm uppercase shadow-brut-sm transition-transform duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
                  filter === f ? "bg-brand-yellow" : "bg-white",
                ].join(" ")}
              >
                {copy.frameCategory[f]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        {visible.length === 0 ? (
          <p className="py-16 text-center font-display text-xl uppercase text-ink/40">
            {copy.common.none}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((frame) => (
              <button
                key={frame.id}
                type="button"
                disabled={busy}
                onClick={() => chooseFrame(frame.id)}
                className="flex flex-col border-4 border-ink bg-white p-3 shadow-brut-lg transition-transform duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed"
                style={{ aspectRatio: "3 / 4" }}
              >
                <div className="relative flex min-h-0 flex-1 items-center justify-center bg-ink/5">
                  {frame.isRecommended && (
                    <span className="absolute left-1 top-1 z-10 border-2 border-ink bg-brand-green px-2 py-0.5 font-display text-[10px] uppercase shadow-brut-sm">
                      {copy.frameCategory.REKOMENDASI}
                    </span>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frame.thumbnailUrl}
                    alt={frame.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="mt-2 shrink-0 text-left">
                  <p className="truncate font-display text-sm uppercase">{frame.name}</p>
                  <p className="font-mono text-[11px] uppercase text-ink/60">
                    {frame.slotCount} • {frame.formatLabel}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {ended && <SessionEndedOverlay onDone={goSplash} />}
    </div>
  );
}
