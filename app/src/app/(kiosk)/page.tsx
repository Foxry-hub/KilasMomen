"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";

export default function LandingPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleStart = async () => {
    if (isCreating) return; // debounce
    setIsCreating(true);

    try {
      const res = await fetch("/api/transactions", { method: "POST" });
      if (!res.ok) throw new Error("Gagal membuat transaksi");
      const data = await res.json();
      router.push(`/payment/${data.id}`);
    } catch {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl uppercase tracking-tight">
          📸 PHOTOBOOTH KIOS
        </h1>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-8 max-w-5xl w-full">
          {/* Hero Card */}
          <div className="flex-1 bg-white border-4 border-ink shadow-brut-xl p-10 flex flex-col items-center justify-center text-center">
            <h2 className="font-display text-5xl uppercase tracking-tight mb-4">
              ABADIKAN MOMENMU
            </h2>
            <h3 className="font-display text-4xl uppercase tracking-tight text-brand-pink mb-6">
              DALAM 3 MENIT!
            </h3>

            <div className="flex items-center gap-4 mb-4 text-lg font-sans">
              <span className="bg-brand-cyan border-3 border-ink px-3 py-1 shadow-brut-sm font-display">
                5× JEPRET
              </span>
              <span className="text-ink/50">→</span>
              <span className="bg-brand-pink border-3 border-ink px-3 py-1 shadow-brut-sm font-display">
                PILIH 2
              </span>
              <span className="text-ink/50">→</span>
              <span className="bg-brand-green border-3 border-ink px-3 py-1 shadow-brut-sm font-display">
                CETAK
              </span>
            </div>

            <p className="font-mono text-3xl font-bold mb-8">
              Rp 25.000 <span className="text-lg text-ink/60">/ sesi</span>
            </p>

            <Button
              size="xl"
              variant="primary"
              onClick={handleStart}
              disabled={isCreating}
              id="btn-mulai-foto"
              className="animate-wiggle hover:animate-none"
            >
              {isCreating ? "MEMBUAT SESI..." : "MULAI FOTO →"}
            </Button>
          </div>

          {/* Sample result card */}
          <div className="w-80 bg-white border-4 border-ink shadow-brut-lg p-6 flex flex-col">
            <div className="bg-brand-yellow border-4 border-ink px-4 py-2 mb-4 shadow-brut-sm">
              <h3 className="font-display text-lg uppercase">CONTOH HASIL</h3>
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex-1 bg-brand-violet/20 border-4 border-ink border-dashed flex items-center justify-center">
                <span className="font-display text-ink/30 text-xl">FOTO 1</span>
              </div>
              <div className="flex-1 bg-brand-violet/20 border-4 border-ink border-dashed flex items-center justify-center">
                <span className="font-display text-ink/30 text-xl">FOTO 2</span>
              </div>
            </div>
            <p className="font-display text-center text-sm mt-4 uppercase tracking-tight text-ink/60">
              PHOTOBOOTH 2026
            </p>
          </div>
        </div>
      </div>

      {/* Stepper + Consent */}
      <footer className="mt-6 flex flex-col items-center gap-3">
        <Stepper currentStep={0} />
        <p className="text-sm text-ink/50 font-sans text-center">
          Dengan menekan MULAI FOTO, Anda setuju foto disimpan sementara untuk
          keperluan cetak.
        </p>
      </footer>
    </div>
  );
}
