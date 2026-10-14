"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { Badge } from "@/components/ui/Badge";

/* ================================================================
   TYPES
   ================================================================ */
interface Transaction {
  id: string;
  code: string;
  amount: number;
  paymentMethod: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
}

type PaymentMethod = "QRIS" | "CASH";

/* ================================================================
   HELPERS
   ================================================================ */

/** Format rupiah: 25000 → "Rp 25.000" */
function formatRupiah(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}

/** Calculate remaining seconds from ISO expiry */
function calcRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/** Format seconds → "MM:SS" */
function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ================================================================
   QRIS PLACEHOLDER SVG (inline, no external dependency)
   ================================================================ */
function QrisPlaceholder() {
  return (
    <div className="w-full aspect-square bg-white border-4 border-ink flex flex-col items-center justify-center p-6">
      {/* QR-like grid pattern */}
      <svg
        viewBox="0 0 200 200"
        className="w-full max-w-[240px] mb-4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Corner markers */}
        <rect x="10" y="10" width="50" height="50" rx="0" fill="black" />
        <rect x="16" y="16" width="38" height="38" rx="0" fill="white" />
        <rect x="22" y="22" width="26" height="26" rx="0" fill="black" />

        <rect x="140" y="10" width="50" height="50" rx="0" fill="black" />
        <rect x="146" y="16" width="38" height="38" rx="0" fill="white" />
        <rect x="152" y="22" width="26" height="26" rx="0" fill="black" />

        <rect x="10" y="140" width="50" height="50" rx="0" fill="black" />
        <rect x="16" y="146" width="38" height="38" rx="0" fill="white" />
        <rect x="22" y="152" width="26" height="26" rx="0" fill="black" />

        {/* Data blocks pattern */}
        {[70, 85, 100, 115, 130].map((x) =>
          [70, 85, 100, 115, 130].map((y) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="12"
              height="12"
              fill={(x + y) % 30 === 0 ? "white" : "black"}
            />
          ))
        )}
        {[70, 85, 100, 115].map((x) =>
          [10, 25, 40].map((y) => (
            <rect
              key={`d-${x}-${y}`}
              x={x}
              y={y}
              width="12"
              height="12"
              fill={(x * y) % 3 === 0 ? "black" : "white"}
            />
          ))
        )}
        {[10, 25, 40].map((x) =>
          [70, 85, 100, 115].map((y) => (
            <rect
              key={`e-${x}-${y}`}
              x={x}
              y={y}
              width="12"
              height="12"
              fill={(x + y) % 4 === 0 ? "black" : "white"}
            />
          ))
        )}
        {/* Timing pattern */}
        {[66, 78, 90, 102, 114, 126].map((pos, i) => (
          <rect
            key={`t-${pos}`}
            x={pos}
            y={64}
            width="10"
            height="3"
            fill={i % 2 === 0 ? "black" : "white"}
          />
        ))}
        {[66, 78, 90, 102, 114, 126].map((pos, i) => (
          <rect
            key={`tv-${pos}`}
            x={64}
            y={pos}
            width="3"
            height="10"
            fill={i % 2 === 0 ? "black" : "white"}
          />
        ))}

        {/* Bottom right mini marker */}
        <rect x="150" y="150" width="30" height="30" fill="black" />
        <rect x="154" y="154" width="22" height="22" fill="white" />
        <rect x="158" y="158" width="14" height="14" fill="black" />
      </svg>
      <p className="font-display text-sm text-ink/40 uppercase tracking-tight">
        QRIS PLACEHOLDER
      </p>
      <p className="text-xs text-ink/30 font-sans mt-1">
        Ganti dengan file qris.png di /public/qris/
      </p>
    </div>
  );
}

function QrisDisplay() {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return <QrisPlaceholder />;
  }

  return (
    <div className="w-full aspect-square bg-white border-4 border-ink flex flex-col items-center justify-center p-6">
      <img
        src="/qris/qris.png"
        alt="QRIS Pembayaran"
        className="w-full max-w-[240px] max-h-[240px] object-contain mb-3"
        onError={() => setImgError(true)}
      />
      <p className="font-display text-sm text-ink/70 uppercase tracking-tight">
        SCAN QRIS UNTUK MEMBAYAR
      </p>
    </div>
  );
}

/* ================================================================
   PAYMENT CONTENT COMPONENT
   ================================================================ */
function PaymentContent() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.transactionId as string;

  // State
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(180); // 3 minutes default
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("QRIS");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Fetch transaction ---- */
  const fetchTransaction = useCallback(async () => {
    try {
      const res = await fetch(`/api/transactions/${transactionId}`);
      if (!res.ok) throw new Error("Transaksi tidak ditemukan");
      const data: Transaction = await res.json();
      setTransaction(data);
      setRemaining(calcRemaining(data.expiresAt));
      setLoading(false);

      // If already expired or cancelled, redirect
      if (data.status === "EXPIRED" || data.status === "CANCELLED") {
        setTimeout(() => router.push("/"), 1500);
      }
    } catch {
      setError("Gagal memuat data transaksi");
      setLoading(false);
    }
  }, [transactionId, router]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  /* ---- Countdown timer ---- */
  useEffect(() => {
    if (!transaction || transaction.status !== "PENDING") return;

    timerRef.current = setInterval(() => {
      const secs = calcRemaining(transaction.expiresAt);
      setRemaining(secs);

      if (secs <= 0) {
        // Auto-expire
        setTransaction((prev) =>
          prev ? { ...prev, status: "EXPIRED" } : null
        );
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(() => router.push("/"), 2000);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [transaction, router]);

  /* ---- Keyboard hotkeys: F2=Confirm, Esc=Cancel ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        handleConfirm();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction, isConfirming, isCancelling]);

  /* ---- Confirm payment ---- */
  const handleConfirm = async () => {
    if (isConfirming || isCancelling) return;
    if (!transaction || transaction.status !== "PENDING") return;

    setIsConfirming(true);

    try {
      const res = await fetch(`/api/transactions/${transactionId}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal mengonfirmasi");
      }

      const data = await res.json();
      setTransaction((prev) =>
        prev ? { ...prev, status: "PAID" } : null
      );

      // Navigate to frame selection
      if (data.sessionId) {
        router.push(`/session/${data.sessionId}/frame`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setIsConfirming(false);
    }
  };

  /* ---- Cancel payment ---- */
  const handleCancel = async () => {
    if (isConfirming || isCancelling) return;
    if (!transaction || transaction.status !== "PENDING") return;

    setIsCancelling(true);

    try {
      const res = await fetch(`/api/transactions/${transactionId}/cancel`, {
        method: "PATCH",
      });

      if (!res.ok) {
        throw new Error("Gagal membatalkan transaksi");
      }

      setTransaction((prev) =>
        prev ? { ...prev, status: "CANCELLED" } : null
      );

      setTimeout(() => router.push("/"), 1000);
    } catch {
      setError("Gagal membatalkan");
      setIsCancelling(false);
    }
  };

  /* ---- Timer urgency colors ---- */
  const timerUrgent = remaining <= 30;
  const timerCritical = remaining <= 10;

  /* ================================================================
     RENDER
     ================================================================ */

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white border-4 border-ink shadow-brut-xl p-12 text-center">
          <div className="font-display text-3xl uppercase animate-pulse-brut">
            MEMUAT...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !transaction) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-brand-red border-4 border-ink shadow-brut-xl p-12 text-center max-w-md">
          <div className="font-display text-2xl uppercase mb-4">KESALAHAN</div>
          <p className="font-sans text-lg mb-6">{error}</p>
          <Button variant="secondary" onClick={() => router.push("/")}>
            KEMBALI
          </Button>
        </div>
      </div>
    );
  }

  // Expired / Cancelled overlay
  if (
    transaction &&
    (transaction.status === "EXPIRED" || transaction.status === "CANCELLED")
  ) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div
          className={[
            "border-4 border-ink shadow-brut-xl p-12 text-center max-w-lg",
            transaction.status === "EXPIRED" ? "bg-brand-pink" : "bg-brand-red",
          ].join(" ")}
        >
          <div className="font-display text-4xl uppercase mb-4">
            {transaction.status === "EXPIRED"
              ? "⏰ WAKTU HABIS"
              : "❌ DIBATALKAN"}
          </div>
          <p className="font-sans text-xl mb-2">
            {transaction.status === "EXPIRED"
              ? "Batas waktu pembayaran telah berakhir."
              : "Transaksi telah dibatalkan oleh operator."}
          </p>
          <p className="font-mono text-lg text-ink/70">
            Kembali ke halaman awal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-8">
      {/* ============ HEADER ============ */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-brand-yellow border-4 border-ink px-4 py-2 shadow-brut">
            <span className="font-display text-xl uppercase">
              LANGKAH 1 / 6
            </span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl uppercase tracking-tight">
            PEMBAYARAN
          </h1>
        </div>

        {/* Countdown Timer */}
        <div
          className={[
            "border-4 border-ink px-6 py-3 shadow-brut-lg flex items-center gap-3",
            timerCritical
              ? "bg-brand-red animate-pulse-brut"
              : timerUrgent
                ? "bg-brand-pink"
                : "bg-white",
          ].join(" ")}
        >
          <span className="font-display text-lg uppercase">SISA WAKTU</span>
          <span
            className={[
              "font-mono text-3xl font-bold tabular-nums",
              timerCritical ? "text-white" : "",
            ].join(" ")}
          >
            {formatTimer(remaining)}
          </span>
        </div>
      </header>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* ---------- LEFT: QRIS CARD ---------- */}
        <div className="flex-1 bg-white border-4 border-ink shadow-brut-lg flex flex-col">
          {/* Card header */}
          <div className="bg-brand-cyan border-b-4 border-ink px-6 py-3">
            <h2 className="font-display text-xl uppercase tracking-tight">
              SCAN QRIS
            </h2>
          </div>

          {/* QRIS image area */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-xs">
              <QrisDisplay />
            </div>

            {/* Total amount */}
            <div className="mt-6 bg-brand-yellow border-4 border-ink px-8 py-4 shadow-brut-lg text-center">
              <p className="font-display text-sm uppercase text-ink/70 mb-1">
                TOTAL PEMBAYARAN
              </p>
              <p className="font-mono text-4xl lg:text-5xl font-bold">
                {formatRupiah(transaction?.amount ?? 25000)}
              </p>
            </div>

            <p className="mt-4 font-sans text-base text-ink/60 text-center">
              atau bayar <strong className="text-ink">TUNAI</strong> ke operator
              di samping kios
            </p>
          </div>
        </div>

        {/* ---------- RIGHT: ORDER SUMMARY ---------- */}
        <div className="w-96 bg-white border-4 border-ink shadow-brut-lg flex flex-col">
          {/* Card header */}
          <div className="bg-brand-pink border-b-4 border-ink px-6 py-3">
            <h2 className="font-display text-xl uppercase tracking-tight">
              RINGKASAN
            </h2>
          </div>

          <div className="flex-1 p-6 flex flex-col">
            {/* Transaction details */}
            <div className="space-y-4 flex-1">
              {/* Code */}
              <div>
                <p className="font-display text-sm uppercase text-ink/50 mb-1">
                  KODE TRANSAKSI
                </p>
                <p className="font-mono text-xl font-bold">
                  {transaction?.code ?? "—"}
                </p>
              </div>

              {/* Payment method toggle */}
              <div>
                <p className="font-display text-sm uppercase text-ink/50 mb-2">
                  METODE BAYAR
                </p>
                <div className="flex gap-0">
                  <button
                    id="method-qris"
                    type="button"
                    onClick={() => setPaymentMethod("QRIS")}
                    className={[
                      "flex-1 h-14 border-4 border-ink font-display text-lg uppercase",
                      "select-none cursor-pointer transition-colors duration-100",
                      paymentMethod === "QRIS"
                        ? "bg-brand-cyan shadow-brut-sm"
                        : "bg-white",
                    ].join(" ")}
                  >
                    {paymentMethod === "QRIS" ? "✓ " : ""}QRIS
                  </button>
                  <button
                    id="method-cash"
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={[
                      "flex-1 h-14 border-4 border-l-0 border-ink font-display text-lg uppercase",
                      "select-none cursor-pointer transition-colors duration-100",
                      paymentMethod === "CASH"
                        ? "bg-brand-cyan shadow-brut-sm"
                        : "bg-white",
                    ].join(" ")}
                  >
                    {paymentMethod === "CASH" ? "✓ " : ""}TUNAI
                  </button>
                </div>
              </div>

              {/* Status */}
              <div>
                <p className="font-display text-sm uppercase text-ink/50 mb-2">
                  STATUS
                </p>
                <Badge status={transaction?.status ?? "PENDING"} />
              </div>

              {/* Divider */}
              <div className="border-t-4 border-ink border-dashed" />

              {/* Instructions */}
              <div className="bg-paper border-4 border-ink p-4">
                <p className="font-sans text-base leading-relaxed">
                  💰 Sudah bayar?{" "}
                  <strong>Tunggu operator</strong> mengonfirmasi pembayaranmu.
                </p>
                <p className="font-sans text-sm text-ink/60 mt-2">
                  ⏰ Waktu habis = kembali ke halaman awal secara otomatis.
                </p>
              </div>
            </div>

            {/* Hotkey hints */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-ink/40 font-mono">
              <span className="bg-ink/10 px-2 py-1 border border-ink/20">F2</span>
              <span>= Konfirmasi</span>
              <span className="bg-ink/10 px-2 py-1 border border-ink/20">Esc</span>
              <span>= Batal</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ OPERATOR ACTION BAR ============ */}
      <div className="mt-4 bg-white border-4 border-ink shadow-brut-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-sm uppercase text-ink/50 tracking-tight">
            AREA OPERATOR — Tekan tombol setelah menerima pembayaran
          </p>
          {error && (
            <span className="font-mono text-sm text-brand-red">{error}</span>
          )}
        </div>

        <div className="flex gap-4">
          {/* KONFIRMASI BAYAR */}
          <Button
            id="btn-konfirmasi-bayar"
            variant="success"
            size="lg"
            className="flex-[2]"
            onClick={handleConfirm}
            disabled={
              isConfirming ||
              isCancelling ||
              transaction?.status !== "PENDING"
            }
          >
            {isConfirming ? (
              <>
                <span className="inline-block w-6 h-6 border-4 border-ink border-t-transparent animate-spin" />
                MEMPROSES...
              </>
            ) : (
              "✅ KONFIRMASI BAYAR"
            )}
          </Button>

          {/* BATAL */}
          <Button
            id="btn-batal"
            variant="danger"
            size="lg"
            className="flex-1"
            onClick={handleCancel}
            disabled={
              isConfirming ||
              isCancelling ||
              transaction?.status !== "PENDING"
            }
          >
            {isCancelling ? "MEMBATALKAN..." : "❌ BATAL"}
          </Button>
        </div>
      </div>

      {/* ============ STEPPER FOOTER ============ */}
      <footer className="mt-4 flex justify-center">
        <Stepper currentStep={1} />
      </footer>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border-4 border-ink shadow-brut-xl p-12 text-center">
            <div className="font-display text-3xl uppercase animate-pulse-brut">
              MEMUAT...
            </div>
          </div>
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}
