"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { kioskJson } from "@/components/kiosk/api";
import { useConfig, useHeartbeat } from "@/components/kiosk/hooks";
import { useCamera } from "@/components/kiosk/useCamera";
import { NoticeBanner } from "@/components/kiosk/ScreenOverlays";
import { deriveScreen, rememberTransaction } from "@/components/kiosk/recovery";
import type { KioskStatusView } from "@/components/kiosk/types";

const ACTIVE_SCREEN = "SPLASH";

export default function SplashPage() {
  const router = useRouter();
  /** Polling config tiap 10 detik saat idle agar perubahan operator (misal ganti kamera) segera diterapkan (§6.3). */
  const { config } = useConfig(10000);
  const [notice, setNotice] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const busyRef = useRef(false);
  const lastTouchRef = useRef(0);
  const checkedRef = useRef(false);

  /** Inisialisasi kamera di latar belakang untuk memantau status & perangkat (§6.1). */
  const camera = useCamera({
    source: config?.camera.source,
    deviceLabel: config?.camera.deviceLabel,
    deviceId: config?.camera.deviceId,
    maxResolution: config?.camera.maxResolution,
    enabled: true,
  });

  useHeartbeat(ACTIVE_SCREEN, {
    devices: camera.devices,
    cameraStatus: camera.error ? "ERROR" : camera.active ? "ACTIVE" : "IDLE",
  });

  /* Pemulihan otomatis (§7.9): lanjutkan transaksi aktif bila ada. */
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    kioskJson<{ transaction: KioskStatusView | null }>("/api/kiosk/active").then((res) => {
      const t = res.data?.transaction;
      if (!t) return;
      // Final sudah ada → sesi tuntas; biarkan Splash (operator menandai selesai).
      if (t.status === "PROCESSING" && t.session?.hasFinal) return;
      rememberTransaction(t.id);
      router.replace(deriveScreen(t));
    });
  }, [router]);

  const handleStart = useCallback(async () => {
    const now = Date.now();
    if (now - lastTouchRef.current < 400) return; // debounce 400 ms (§7.2)
    lastTouchRef.current = now;
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* fullscreen bukan syarat wajib */
    }

    const res = await kioskJson<KioskStatusView>("/api/kiosk/transactions", { method: "POST" });
    if (!res.ok || !res.data) {
      busyRef.current = false;
      setNotice(copy.errors.generic);
      return;
    }

    rememberTransaction(res.data.id);
    router.push(deriveScreen(res.data));
  }, [router]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-ink">
      {/* Video looping latar (§7.2) */}
      {config?.splashVideoUrl ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={config.splashVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          onCanPlay={() => setVideoReady(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-brand-yellow" />
      )}

      <div className="absolute inset-0 bg-ink/45" />

      <NoticeBanner message={notice} />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 p-8 text-center">
        <div className="border-4 border-ink bg-brand-yellow px-8 py-5 shadow-brut-xl">
          <h1 className="font-display text-6xl uppercase leading-none tracking-tight xl:text-7xl">
            {copy.brand.name}
          </h1>
        </div>

        <p className="font-display text-3xl uppercase text-white drop-shadow-[4px_4px_0_#000] xl:text-4xl">
          {copy.kiosk.splash.subtitle}
        </p>

        <button
          type="button"
          onClick={handleStart}
          className="animate-wiggle w-full max-w-2xl border-4 border-ink bg-brand-pink px-10 py-8 font-display text-4xl uppercase leading-none tracking-tight shadow-brut-xl transition-transform duration-100 hover:animate-none active:translate-x-1 active:translate-y-1 active:shadow-none xl:text-5xl"
        >
          {copy.kiosk.splash.start}
        </button>

        {!videoReady && config?.splashVideoUrl && (
          <p className="font-mono text-xs uppercase text-white/60">{copy.common.loading}</p>
        )}
      </div>
    </div>
  );
}
