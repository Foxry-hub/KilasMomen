"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy.id";

/** "Sesi Berakhir" saat operator membatalkan sesi (§7.10) — tampil ±3 detik lalu reset. */
export function SessionEndedOverlay({
  seconds = 3,
  onDone,
}: {
  seconds?: number;
  onDone: () => void;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, onDone]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/70 p-6">
      <div className="w-full max-w-xl border-4 border-ink bg-white p-10 text-center shadow-brut-xl">
        <div className="mb-6 border-4 border-ink bg-brand-red p-4 shadow-brut">
          <p className="font-display text-3xl uppercase text-white">
            {copy.kiosk.sessionEnded}
          </p>
        </div>
        <p className="font-sans text-lg text-ink/70">
          {copy.kiosk.done.resetting} {left}
        </p>
      </div>
    </div>
  );
}

/** Overlay "Menghubungkan ulang..." setelah 3 polling gagal (§7.3). */
export function ConnectingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-6">
      <div className="border-4 border-ink bg-brand-yellow px-8 py-6 shadow-brut-lg">
        <p className="font-display text-2xl uppercase">{copy.common.connecting}</p>
      </div>
    </div>
  );
}

/** Peringatan idle 15 detik terakhir (§7.3). */
export function IdleWarning({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[85] flex justify-center p-4">
      <div className="animate-pulse-brut border-4 border-ink bg-brand-pink px-6 py-4 shadow-brut">
        <p className="font-display text-xl uppercase">{copy.kiosk.idleWarning}</p>
      </div>
    </div>
  );
}

/** Pemberitahuan ramah di Splash bila API gagal (§7.2). */
export function NoticeBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[85] flex justify-center p-4">
      <div className="border-4 border-ink bg-brand-red px-6 py-3 shadow-brut">
        <p className="font-display text-lg uppercase text-white">{message}</p>
      </div>
    </div>
  );
}
