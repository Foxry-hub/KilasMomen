"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface InvoiceData {
  invoiceNumber: string;
  token: string;
  sessionId: string;
  filter: string;
  createdAt: string;
  expiresAt: string;
  imageUrl: string;
  downloadUrl: string;
}

export default function PublicInvoicePage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [metaLoading, setMetaLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [downloadClicked, setDownloadClicked] = useState<boolean>(false);

  // The image URL is always deterministic from the token - no need to wait for metadata
  const imageSrc = token ? `/api/public/invoice/${token}/image` : null;
  const downloadUrl = `/api/public/invoice/${token}/image?download=1`;
  const downloadFileName = `PHOTOBOOTH_${invoice?.invoiceNumber || token || "4R"}.jpg`;

  // Fetch metadata (non-blocking for image display)
  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    async function fetchMeta() {
      try {
        const res = await fetch(`/api/public/invoice/${token}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: InvoiceData = await res.json();
          setInvoice(data);
        }
        // If not ok, we still try to show the image directly
      } catch (err) {
        // Timeout or network error - still try to display image
        console.warn("Metadata fetch failed (image may still load):", err);
      }
      setMetaLoading(false);
    }

    fetchMeta();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [token]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
    setErrorMsg("Foto tidak ditemukan atau sesi telah berakhir.");
  }, []);

  // Retry loading image
  const retryLoad = useCallback(() => {
    setImageError(false);
    setImageLoaded(false);
    setErrorMsg(null);
    // Force re-fetch by appending cache buster
    const imgEl = document.querySelector<HTMLImageElement>("#photo-preview");
    if (imgEl && imageSrc) {
      imgEl.src = imageSrc + (imageSrc.includes("?") ? "&" : "?") + "t=" + Date.now();
    }
  }, [imageSrc]);

  // Show loading state: we're loading until either image loaded OR error
  const showLoading = !imageLoaded && !imageError;

  return (
    <div className="min-h-screen bg-paper font-sans text-ink flex flex-col items-center justify-between p-4 sm:p-6 select-none">
      {/* Light dot grid background */}
      <style jsx global>{`
        body {
          background-color: #FFFBEB;
          background-image: radial-gradient(#00000020 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        }
      `}</style>

      {/* Fullscreen Photo Lightbox Modal */}
      {isFullScreen && imageSrc && imageLoaded && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsFullScreen(false)}
        >
          <div className="relative max-h-[90vh] max-w-[95vw] flex flex-col items-center">
            <img
              src={imageSrc}
              alt="Pratinjau Layar Penuh"
              className="max-h-[80vh] max-w-full object-contain border-4 border-white shadow-2xl"
            />
            <span className="mt-4 bg-brand-yellow text-ink border-2 border-ink px-4 py-2 font-display text-sm uppercase shadow-brut">
              ✕ KETUK DI MANA SAJA UNTUK TUTUP
            </span>
          </div>
        </div>
      )}

      {/* Main Container: Mobile-First Neo-Brutalism Card */}
      <main className="w-full max-w-md bg-white border-4 border-ink shadow-brut-xl flex flex-col overflow-hidden my-auto">
        {/* ============ BRANDING HEADER ============ */}
        <header className="bg-brand-yellow border-b-4 border-ink p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-ink text-brand-yellow border-2 border-ink px-2 py-0.5 font-display text-base tracking-tighter">
              PB
            </div>
            <div>
              <h1 className="font-display text-xl uppercase tracking-tight leading-none">
                PHOTOBOOTH KIOS
              </h1>
              <p className="font-mono text-[10px] text-ink/70 mt-0.5">
                HASIL FOTO DIGITAL 4R
              </p>
            </div>
          </div>

          <span className="bg-white border-2 border-ink px-2 py-1 font-mono text-xs font-bold uppercase shadow-brut-sm">
            {invoice?.invoiceNumber || "FOTO 4R"}
          </span>
        </header>

        {/* ============ ERROR STATE (only when image failed to load) ============ */}
        {imageError && errorMsg && (
          <div className="p-6 text-center">
            <div className="bg-brand-red text-white border-4 border-ink p-4 shadow-brut mb-4">
              <span className="font-display text-2xl uppercase block mb-1">FOTO TIDAK TERSEDIA</span>
              <p className="font-sans text-xs">{errorMsg}</p>
            </div>
            <button
              onClick={retryLoad}
              className="bg-brand-yellow border-3 border-ink px-6 py-3 font-display text-sm uppercase shadow-brut active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer mb-3"
            >
              🔄 COBA LAGI
            </button>
            <p className="font-sans text-xs text-ink/70">
              Pastikan Anda masih terhubung ke Wi-Fi photobooth yang sama.
            </p>
          </div>
        )}

        {/* ============ PHOTO PREVIEW ============ */}
        {!imageError && (
          <div className="p-4 flex flex-col items-center bg-paper/50">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="font-display text-xs uppercase text-ink/70">
                PRATINJAU HASIL CETAK
              </span>
              <span className="bg-brand-violet border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
                EFEK: {invoice?.filter || "—"}
              </span>
            </div>

            {/* Photo Frame Container (2:3 Aspect Ratio) */}
            <div
              onClick={() => imageLoaded && setIsFullScreen(true)}
              className="relative w-full max-w-[280px] aspect-[2/3] bg-paper border-4 border-ink shadow-brut overflow-hidden cursor-pointer active:scale-98 transition-transform group"
            >
              {/* Always render the img tag so it can start loading immediately */}
              {imageSrc && (
                <img
                  id="photo-preview"
                  src={imageSrc}
                  alt="Hasil Foto Photobooth"
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    imageLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              )}

              {/* Loading overlay */}
              {showLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-paper">
                  <span className="inline-block w-8 h-8 border-4 border-ink border-t-transparent animate-spin mb-3" />
                  <span className="font-display text-sm uppercase">MEMUAT FOTO...</span>
                  <p className="font-sans text-[10px] text-ink/50 mt-2">
                    Mengambil dari server kios...
                  </p>
                </div>
              )}

              {/* Fullscreen hint */}
              {imageLoaded && (
                <div className="absolute bottom-2 right-2 bg-ink/80 text-white px-2 py-1 font-display text-[10px] uppercase group-hover:bg-ink">
                  🔍 KETUK UNTUK PERBESAR
                </div>
              )}
            </div>

            <p className="font-sans text-[11px] text-ink/60 text-center mt-2">
              Format Cetak 4R (1200 × 1800 px • 300 DPI Resolusi Asli)
            </p>
          </div>
        )}

        {/* ============ DOWNLOAD SUCCESS NOTIFICATION ============ */}
        {downloadClicked && (
          <div className="mx-4 mt-2 bg-brand-green border-3 border-ink p-2.5 shadow-brut-sm flex items-center gap-2 animate-pulse">
            <span className="text-xl">✅</span>
            <span className="font-display text-xs uppercase text-ink">
              FOTO SEDANG DIUNDUH KE HP ANDA!
            </span>
          </div>
        )}

        {/* ============ DOWNLOAD ACTIONS ============ */}
        {!imageError && (
          <div className="p-4 flex flex-col gap-3">
            {/* DIRECT NATIVE HTML DOWNLOAD LINK (Bypasses mobile async popup blocks) */}
            <a
              href={downloadUrl}
              download={downloadFileName}
              onClick={() => {
                setDownloadClicked(true);
                setTimeout(() => setDownloadClicked(false), 5000);
              }}
              className="w-full min-h-[64px] bg-brand-green border-4 border-ink shadow-brut-lg font-display text-2xl uppercase tracking-tight flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none text-ink no-underline select-none cursor-pointer"
            >
              <span>📥</span>
              <span>UNDUH FOTO KE HP</span>
            </a>

            {/* DIRECT VIEW FULL RESOLUTION LINK */}
            <a
              href={imageSrc || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[46px] bg-white border-3 border-ink shadow-brut font-display text-sm uppercase tracking-tight flex items-center justify-center gap-2 text-ink no-underline active:translate-x-0.5 active:translate-y-0.5"
            >
              <span>🔍</span>
              <span>BUKA FOTO DI TAB BARU</span>
            </a>

            {/* MOBILE LONG-PRESS HINT */}
            <div className="bg-brand-yellow/30 border-2 border-ink p-2 text-center font-sans text-xs text-ink">
              💡 <strong>Tips Tambahan:</strong> Anda juga bisa <strong>menekan &amp; menahan (tahan sentuh)</strong> foto di atas, lalu pilih <strong>&quot;Simpan Gambar&quot;</strong> atau <strong>&quot;Save to Photos&quot;</strong>.
            </div>

            {/* TRANSACTION METADATA */}
            <div className="bg-paper border-3 border-ink p-3 space-y-1 mt-1 font-mono text-xs">
              <div className="flex justify-between border-b border-ink/20 pb-1">
                <span className="text-ink/60">KODE TRANSAKSI:</span>
                <span className="font-bold text-ink">
                  {invoice?.invoiceNumber || "INV-" + token.slice(-6).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between border-b border-ink/20 pb-1">
                <span className="text-ink/60">STATUS:</span>
                <span className="font-bold text-brand-green bg-ink px-1.5 py-0.2">
                  ✓ LUNAS (PAID)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">UKURAN RESOLUSI:</span>
                <span className="font-bold text-ink">1200 × 1800 PX (4R)</span>
              </div>
            </div>
          </div>
        )}

        {/* ============ FOOTER NOTE ============ */}
        <footer className="bg-paper border-t-3 border-ink p-3 text-center">
          <p className="font-sans text-[11px] text-ink/60 leading-tight">
            🔒 Foto ini disimpan secara lokal di mesin photobooth. Simpan segera ke galeri ponsel Anda.
          </p>
        </footer>
      </main>
    </div>
  );
}
