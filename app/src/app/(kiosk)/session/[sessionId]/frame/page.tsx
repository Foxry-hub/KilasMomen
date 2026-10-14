"use client";

import { useState, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { DEFAULT_FRAMES, Frame } from "@/lib/frames";

function FrameSelectionContent() {
  const router = useRouter();
  const params = useParams();
  const sessionId = (params?.sessionId as string) || "";

  const [selectedFrame] = useState<Frame>(DEFAULT_FRAMES[0]);

  const handleContinue = () => {
    router.push(`/session/${sessionId}/capture?frame=${selectedFrame.slug}`);
  };

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-brand-pink border-4 border-ink px-4 py-2 shadow-brut">
            <span className="font-display text-xl uppercase">LANGKAH 2 / 6</span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl uppercase tracking-tight">
            PILIH BINGKAI FOTO
          </h1>
        </div>

        <div className="bg-brand-yellow border-4 border-ink px-4 py-2 shadow-brut hidden sm:block">
          <span className="font-mono text-sm font-bold">
            SESI: {sessionId ? sessionId.slice(0, 12) + "..." : "AKTIF"}
          </span>
        </div>
      </header>

      {/* Main Grid: Frame Display & Details */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 items-center justify-center">
        {/* Left: Frame Card Preview */}
        <div className="flex-1 max-w-md w-full bg-white border-4 border-ink shadow-brut-xl p-4 flex flex-col items-center">
          <div className="w-full bg-brand-yellow border-4 border-ink px-4 py-2 mb-3 flex items-center justify-between">
            <span className="font-display text-lg uppercase tracking-tight">
              {selectedFrame.name}
            </span>
            <span className="bg-ink text-white px-2 py-0.5 font-mono text-xs font-bold uppercase">
              TERPILIH
            </span>
          </div>

          {/* SVG Frame Preview */}
          <div className="relative w-full max-w-[280px] aspect-[2/3] bg-paper border-4 border-ink shadow-brut flex items-center justify-center overflow-hidden">
            <img
              src={selectedFrame.overlayPath}
              alt={selectedFrame.name}
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          </div>

          <p className="mt-3 font-sans text-xs text-ink/60 text-center">
            Pratinjau bingkai asli resolusi 1200 × 1800 piksel
          </p>
        </div>

        {/* Right: Specifications & Choice */}
        <div className="flex-1 max-w-lg w-full flex flex-col gap-4">
          <div className="bg-white border-4 border-ink shadow-brut-lg p-6">
            <h2 className="font-display text-2xl uppercase mb-3">
              SPESIFIKASI CETAK
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-brand-cyan/20 border-4 border-ink p-3">
                <p className="font-display text-xs uppercase text-ink/60">UKURAN KERTAS</p>
                <p className="font-display text-xl uppercase mt-1">4R (10 × 15 CM)</p>
              </div>
              <div className="bg-brand-pink/20 border-4 border-ink p-3">
                <p className="font-display text-xs uppercase text-ink/60">JUMLAH FOTO</p>
                <p className="font-display text-xl uppercase mt-1">{selectedFrame.slotCount} FOTO TERBAIK</p>
              </div>
              <div className="bg-brand-green/20 border-4 border-ink p-3">
                <p className="font-display text-xs uppercase text-ink/60">RESOLUSI CANVAS</p>
                <p className="font-display text-xl uppercase mt-1">1200 × 1800 PX</p>
              </div>
              <div className="bg-brand-yellow/20 border-4 border-ink p-3">
                <p className="font-display text-xs uppercase text-ink/60">GAYA DESAIN</p>
                <p className="font-display text-xl uppercase mt-1">NEO-BRUTALISM</p>
              </div>
            </div>

            <div className="bg-paper border-4 border-ink p-4">
              <p className="font-sans text-base leading-relaxed">
                📸 Sesi foto akan mengambil <strong>5× jepretan otomatis</strong> dengan jeda timer hitung mundur. Kamu dapat memilih <strong>2 foto terbaik</strong> untuk dimasukkan ke dalam bingkai ini.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="bg-white border-4 border-ink shadow-brut-lg p-4">
            <Button
              id="btn-lanjut-kamera"
              variant="success"
              size="lg"
              className="w-full text-2xl"
              onClick={handleContinue}
            >
              LANJUT KE KAMERA ➔
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Stepper */}
      <footer className="mt-4 flex justify-center">
        <Stepper currentStep={2} />
      </footer>
    </div>
  );
}

export default function FrameSelectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border-4 border-ink shadow-brut p-8 font-display text-2xl uppercase">
            MEMUAT BINGKAI...
          </div>
        </div>
      }
    >
      <FrameSelectionContent />
    </Suspense>
  );
}
