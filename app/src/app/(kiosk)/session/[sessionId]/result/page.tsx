"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";

/* ================================================================
   RESULT CONTENT COMPONENT
   ================================================================ */
function ResultContent() {
  const router = useRouter();
  const params = useParams();
  const sessionId = (params?.sessionId as string) || "";

  // Data states
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [activeFilterName, setActiveFilterName] = useState<string>("VINTAGE");
  const [invoiceCode, setInvoiceCode] = useState<string>("INV-20261014-0001");
  const [invoiceToken, setInvoiceToken] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Network & URL states
  const [baseHostUrl, setBaseHostUrl] = useState<string>("");
  const [detectedIps, setDetectedIps] = useState<string[]>([]);
  const [customHostInput, setCustomHostInput] = useState<string>("");
  const [showNetworkSettings, setShowNetworkSettings] = useState<boolean>(false);
  const [isZoomQr, setIsZoomQr] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Print states: "queued" -> "printing" -> "printed"
  const [printStatus, setPrintStatus] = useState<"queued" | "printing" | "printed">("printing");
  const [printProgress, setPrintProgress] = useState<number>(30);

  // Auto reset countdown (starts at 60s to give ample time to scan & download)
  const [countdown, setCountdown] = useState<number>(60);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Current computed full invoice URL
  const currentInvoiceUrl = baseHostUrl && invoiceToken ? `${baseHostUrl}/invoice/${invoiceToken}` : "";

  // Function to generate high-contrast scannable QR Code
  const generateQr = useCallback(async (targetUrl: string) => {
    if (!targetUrl) return;
    try {
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 380,
        margin: 4, // ISO standard quiet zone
        errorCorrectionLevel: "M",
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("QR Code generation error:", err);
    }
  }, []);

  // Initialize and synchronize invoice & QR Code
  useEffect(() => {
    let storedImage: string | null = null;
    let storedFilter = "VINTAGE";
    let token = "";

    try {
      storedImage = sessionStorage.getItem(`finalImage_${sessionId}`);
      if (storedImage) {
        setFinalImage(storedImage);
      }
      storedFilter = sessionStorage.getItem(`filter_${sessionId}`) || "VINTAGE";
      setActiveFilterName(storedFilter);

      token = sessionStorage.getItem(`invoiceToken_${sessionId}`) || "";
      const storedInvNum = sessionStorage.getItem(`invoiceNumber_${sessionId}`);
      if (storedInvNum) {
        setInvoiceCode(storedInvNum);
      }
    } catch {
      // Storage fallback
    }

    async function initNetworkAndInvoice() {
      let finalHost = "";
      const allDetected: string[] = [];

      // Check saved custom base URL from localStorage
      try {
        const savedBase = localStorage.getItem("kiosk_custom_base_url");
        if (savedBase) {
          finalHost = savedBase;
        }
      } catch {
        // Fallback
      }

      // If no custom host saved, fetch local network IP from API
      if (!finalHost) {
        try {
          const netRes = await fetch("/api/network");
          if (netRes.ok) {
            const netData = await netRes.json();
            if (netData.allIps && Array.isArray(netData.allIps)) {
              allDetected.push(...netData.allIps);
              setDetectedIps(netData.allIps);
            }
            if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
              finalHost = window.location.origin;
            } else if (netData.baseUrl) {
              finalHost = netData.baseUrl;
            }
          }
        } catch (e) {
          console.warn("Network check error:", e);
        }
      }

      if (!finalHost) {
        finalHost = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      }

      setBaseHostUrl(finalHost);
      setCustomHostInput(finalHost);

      // Ensure invoice is persisted to backend
      let finalToken = token;
      if (!finalToken && storedImage) {
        try {
          const invRes = await fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              imageData: storedImage,
              filter: storedFilter,
            }),
          });
          if (invRes.ok) {
            const invData = await invRes.json();
            finalToken = invData.token;
            setInvoiceCode(invData.invoiceNumber);
            sessionStorage.setItem(`invoiceToken_${sessionId}`, invData.token);
            sessionStorage.setItem(`invoiceNumber_${sessionId}`, invData.invoiceNumber);
          }
        } catch (e) {
          console.warn("Invoice sync error:", e);
        }
      }

      const activeToken = finalToken || sessionId || "demo";
      setInvoiceToken(activeToken);

      const targetUrl = `${finalHost}/invoice/${activeToken}`;
      generateQr(targetUrl);
    }

    initNetworkAndInvoice();
  }, [sessionId, generateQr]);

  // Regenerate QR when baseHostUrl or invoiceToken changes
  useEffect(() => {
    if (baseHostUrl && invoiceToken) {
      generateQr(`${baseHostUrl}/invoice/${invoiceToken}`);
    }
  }, [baseHostUrl, invoiceToken, generateQr]);

  // Simulate print job progress
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setPrintProgress(65);
      setPrintStatus("printing");
    }, 1500);

    const timer2 = setTimeout(() => {
      setPrintProgress(100);
      setPrintStatus("printed");
    }, 3800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Countdown timer to auto-reset back to landing
  useEffect(() => {
    if (isPaused) return;

    if (countdown <= 0) {
      router.push("/");
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, router, isPaused]);

  // Manual Trigger Print
  const handlePrint = () => {
    setPrintStatus("printing");
    setPrintProgress(50);
    if (typeof window !== "undefined") {
      window.print();
    }
    setTimeout(() => {
      setPrintStatus("printed");
      setPrintProgress(100);
    }, 2000);
  };

  // Download local copy on kiosk laptop
  const handleDownload = () => {
    if (!finalImage) return;
    const link = document.createElement("a");
    link.href = finalImage;
    link.download = `photobooth_${invoiceCode || sessionId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save custom base URL (e.g. Tunnel URL or specific Wi-Fi IP)
  const handleSaveCustomHost = () => {
    let clean = customHostInput.trim().replace(/\/+$/, "");
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "http://" + clean;
    }
    setBaseHostUrl(clean);
    try {
      localStorage.setItem("kiosk_custom_base_url", clean);
    } catch {
      // Fallback
    }
    setShowNetworkSettings(false);
  };

  // Copy link
  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && currentInvoiceUrl) {
      navigator.clipboard.writeText(currentInvoiceUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 lg:p-8 select-none">
      {/* Hidden printable strip container for window.print() */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
            background: white;
          }
        }
      `}</style>

      {finalImage && (
        <div id="print-area" className="hidden">
          <img src={finalImage} alt="Print Strip 4R" className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {/* ============ LARGE QR CODE MODAL ZOOM ============ */}
      {isZoomQr && qrDataUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6 cursor-pointer"
          onClick={() => {
            setIsZoomQr(false);
            setIsPaused(false);
          }}
        >
          <div
            className="bg-white border-4 border-ink shadow-brut-xl p-8 max-w-md w-full flex flex-col items-center text-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full bg-brand-yellow border-4 border-ink px-4 py-2 mb-4 shadow-brut">
              <span className="font-display text-2xl uppercase tracking-tight">
                SCAN QR CODE DARI HP
              </span>
            </div>

            {/* High-Contrast Large QR Container */}
            <div className="p-4 bg-white border-4 border-ink shadow-brut-lg mb-4">
              <img
                src={qrDataUrl}
                alt="QR Code Zoom"
                className="w-72 h-72 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>

            <p className="font-mono text-sm font-bold text-ink mb-2">
              {currentInvoiceUrl}
            </p>

            <p className="font-sans text-xs text-ink/70 mb-4 leading-relaxed">
              Pastikan HP Anda terhubung ke jaringan Wi-Fi yang sama dengan laptop.
            </p>

            <Button
              variant="primary"
              size="md"
              className="w-full !h-12 text-sm shadow-brut-sm"
              onClick={() => {
                setIsZoomQr(false);
                setIsPaused(false);
              }}
            >
              ✕ TUTUP PRATINJAU QR
            </Button>
          </div>
        </div>
      )}

      {/* ============ HEADER ============ */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-brand-green border-4 border-ink px-4 py-2 shadow-brut">
            <span className="font-display text-xl uppercase">LANGKAH 6 / 6</span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl uppercase tracking-tight">
            FOTO SELESAI & CETAK
          </h1>
        </div>

        {/* Invoice Code */}
        <div className="bg-white border-4 border-ink px-4 py-2 shadow-brut flex items-center gap-2">
          <span className="font-display text-xs uppercase text-ink/60">KODE TRANSAKSI:</span>
          <span className="font-mono text-base font-bold text-ink">{invoiceCode}</span>
        </div>
      </header>

      {/* ============ 3-COLUMN MAIN LAYOUT ============ */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5 min-h-0 items-stretch">
        {/* ============ COL 1: FINAL STRIP PREVIEW ============ */}
        <div className="bg-white border-4 border-ink shadow-brut-xl p-4 flex flex-col items-center justify-between">
          <div className="w-full bg-brand-violet border-4 border-ink px-4 py-2 mb-3 flex items-center justify-between">
            <span className="font-display text-base uppercase tracking-tight text-ink">
              HASIL FOTOMU
            </span>
            <span className="bg-ink text-white px-2 py-0.5 font-mono text-xs font-bold uppercase">
              {activeFilterName}
            </span>
          </div>

          {/* Strip Image Container */}
          <div className="relative w-full max-w-[220px] aspect-[2/3] bg-paper border-4 border-ink shadow-brut overflow-hidden select-none">
            {finalImage ? (
              <img
                src={finalImage}
                alt="Hasil Foto Final"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                <span className="font-display text-4xl mb-2">📸</span>
                <span className="font-display text-base uppercase">STRIP 4R SIAP</span>
              </div>
            )}
          </div>

          {/* Download Button */}
          <Button
            variant="secondary"
            size="md"
            className="w-full mt-3 !h-12 text-sm shadow-brut-sm"
            onClick={handleDownload}
            disabled={!finalImage}
          >
            💾 UNDUH DI LAPTOP (.JPG)
          </Button>
        </div>

        {/* ============ COL 2: HIGH-CONTRAST SCANNABLE QR CODE FOR MOBILE ============ */}
        <div className="bg-white border-4 border-ink shadow-brut-xl p-4 flex flex-col items-center justify-between">
          <div className="w-full bg-brand-cyan border-4 border-ink px-4 py-2 mb-2 flex items-center justify-between">
            <span className="font-display text-base uppercase tracking-tight text-ink">
              SCAN DARI HP KAMU
            </span>
            <span className="bg-brand-green border-2 border-ink text-ink px-2 py-0.5 font-mono text-xs font-bold uppercase">
              ONLINE
            </span>
          </div>

          {/* Real Scannable QR Code Box (Extra White Margin for Camera Optical Recognition) */}
          <div
            onClick={() => {
              setIsZoomQr(true);
              setIsPaused(true);
            }}
            className="w-full max-w-[250px] aspect-square bg-white border-4 border-ink p-3 shadow-brut flex flex-col items-center justify-center cursor-pointer group hover:bg-paper/40 transition-colors"
          >
            {qrDataUrl ? (
              <>
                <img
                  src={qrDataUrl}
                  alt="QR Code Unduh Foto"
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-display text-[10px] uppercase text-ink/60 mt-1 group-hover:text-ink">
                  🔍 KETUK UNTUK PERBESAR
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-4">
                <span className="font-display text-xs uppercase animate-pulse">
                  MEMBUAT QR CODE...
                </span>
              </div>
            )}
          </div>

          {/* Network URL & Actions */}
          <div className="mt-2 text-center w-full">
            <p className="font-sans text-xs text-ink/80 leading-snug">
              📱 Arahkan kamera HP ke kode QR di atas untuk membuka & mengunduh foto ke galeri.
            </p>

            {/* Display exact URL */}
            <div className="mt-2 bg-paper border-3 border-ink p-1.5 flex items-center justify-between gap-1 shadow-brut-sm">
              <span className="font-mono text-[10px] text-ink font-bold truncate flex-1 text-left px-1">
                {currentInvoiceUrl || "Memuat tautan..."}
              </span>
              <button
                onClick={handleCopyLink}
                className="bg-brand-yellow border-2 border-ink px-2 py-0.5 font-display text-[10px] uppercase active:translate-x-0.5 active:translate-y-0.5 shrink-0"
              >
                {copySuccess ? "✓ TERSALIN" : "SALIN"}
              </button>
            </div>

            {/* Wi-Fi Status Tag */}
            <div className="mt-2 flex items-center justify-center gap-2 text-xs font-mono text-ink/70">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse" />
              <span>WI-FI LOKAL AKTIF</span>
            </div>
          </div>
        </div>

        {/* ============ COL 3: PRINT STATUS & ACTIONS ============ */}
        <div className="bg-white border-4 border-ink shadow-brut-xl p-4 flex flex-col justify-between">
          <div className="w-full bg-brand-yellow border-4 border-ink px-4 py-2 mb-3 flex items-center justify-between">
            <span className="font-display text-base uppercase tracking-tight text-ink">
              STATUS PENCETAKAN
            </span>
            <span className="bg-ink text-white px-2 py-0.5 font-mono text-xs font-bold uppercase">
              4R (10×15 CM)
            </span>
          </div>

          {/* Printing Progress Card */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-paper border-4 border-ink shadow-brut mb-3 text-center">
            <span className="font-display text-4xl mb-3">
              {printStatus === "printed" ? "🖨️✨" : "🖨️⏳"}
            </span>

            <span className="font-display text-xl uppercase mb-2">
              {printStatus === "printed" ? "CETAKAN SELESAI!" : "SEDANG MENCETAK..."}
            </span>

            {/* Brutalist Progress Bar */}
            <div className="w-full bg-white border-3 border-ink p-1 mb-3">
              <div
                className={[
                  "h-5 border-2 border-ink transition-all duration-300",
                  printStatus === "printed" ? "bg-brand-green" : "bg-brand-yellow",
                ].join(" ")}
                style={{ width: `${printProgress}%` }}
              />
            </div>

            <p className="font-sans text-sm text-ink/80">
              {printStatus === "printed"
                ? "Silakan ambil kertas foto Anda di slot baki printer sekarang."
                : "Mengirim dokumen resolusi tinggi ke printer. Tunggu sebentar..."}
            </p>
          </div>

          {/* Print Trigger Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              className="w-full !h-14 text-lg shadow-brut-sm"
              onClick={handlePrint}
            >
              🖨️ CETAK / PRINT ULANG
            </Button>
          </div>
        </div>
      </div>

      {/* ============ BOTTOM BAR & RESET COUNTDOWN ============ */}
      <div className="mt-4 bg-white border-4 border-ink p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-brut-lg">
        {/* Countdown notice */}
        <div className="flex items-center gap-3">
          <div className="bg-brand-pink border-4 border-ink px-4 py-2 shadow-brut font-mono text-xl font-bold">
            00:{countdown.toString().padStart(2, "0")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm uppercase">RESET OTOMATIS</span>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="bg-paper border border-ink px-1.5 font-mono text-[10px] font-bold"
              >
                {isPaused ? "▶ LANJUTKAN" : "⏸ JEDA TIMER"}
              </button>
            </div>
            <span className="font-sans text-xs text-ink/60">
              Layar akan kembali ke beranda untuk sesi pengunjung berikutnya.
            </span>
          </div>
        </div>

        {/* Finish Button */}
        <Button
          variant="success"
          size="lg"
          className="px-10 text-2xl shadow-brut-xl"
          onClick={() => router.push("/")}
        >
          SELESAI & KEMBALI KE AWAL ➔
        </Button>
      </div>

      {/* ============ STEPPER FOOTER ============ */}
      <footer className="mt-4 flex justify-center">
        <Stepper currentStep={6} />
      </footer>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border-4 border-ink shadow-brut p-8 font-display text-2xl uppercase">
            MEMUAT HASIL...
          </div>
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
