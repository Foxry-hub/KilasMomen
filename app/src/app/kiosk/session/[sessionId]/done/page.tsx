"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { AUTO_RESET_SEC } from "@/lib/constants";
import { useConfig, useHeartbeat, useKioskSession } from "@/components/kiosk/hooks";
import { SessionEndedOverlay } from "@/components/kiosk/ScreenOverlays";
import { forgetTransaction } from "@/components/kiosk/recovery";

export default function DonePage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";

  const { config } = useConfig();
  const [ended, setEnded] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const initedRef = useRef(false);

  const { data } = useKioskSession(sessionId, { onCancelled: () => setEnded(true) });
  useHeartbeat("DONE");

  const goSplash = () => {
    forgetTransaction();
    router.replace("/kiosk");
  };

  /* Pemulihan: bila hasil final belum ada, kembali ke editor (§7.9). */
  useEffect(() => {
    if (!data?.session) return;
    if (!data.session.hasFinal) router.replace(`/kiosk/session/${sessionId}/editor`);
  }, [data, router, sessionId]);

  /* Auto reset ke Video Splash (§7.8). */
  useEffect(() => {
    if (initedRef.current || !config) return;
    initedRef.current = true;
    setLeft(config.autoResetSec ?? AUTO_RESET_SEC);
  }, [config]);

  useEffect(() => {
    if (ended || left === null) return;
    if (left <= 0) {
      goSplash();
      return;
    }
    const timer = setTimeout(() => setLeft((v) => (v ?? 0) - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, ended]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-brand-green p-6 text-center">
      <div className="w-full max-w-3xl border-4 border-ink bg-white p-10 shadow-brut-xl lg:p-14">
        <div className="mb-8 border-4 border-ink bg-brand-yellow p-5 shadow-brut">
          <p className="font-display text-3xl uppercase leading-tight tracking-tight lg:text-5xl">
            {copy.brand.name}
          </p>
        </div>
        <p className="font-display text-3xl uppercase leading-tight lg:text-5xl">
          {copy.kiosk.done.title}
        </p>
        {left !== null && (
          <p className="mt-8 font-display text-xl uppercase text-ink/70">
            {copy.kiosk.done.resetting} {left}
          </p>
        )}
      </div>

      {ended && <SessionEndedOverlay onDone={goSplash} />}
    </div>
  );
}
