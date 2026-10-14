"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { getFrameBySlug, DEFAULT_FRAMES, Frame } from "@/lib/frames";

/* ================================================================
   FILTER DEFINITIONS (8 Neo-Brutalism Curated Filters)
   ================================================================ */
export interface FilterConfig {
  id: string;
  name: string;
  label: string;
  description: string;
  cssFilter: string;
  tag: string;
  color: string;
}

export const FILTERS: FilterConfig[] = [
  {
    id: "original",
    name: "ORIGINAL",
    label: "Normal",
    description: "Warna asli alami tanpa manipulasi efek.",
    cssFilter: "none",
    tag: "NATURAL",
    color: "#FFFFFF",
  },
  {
    id: "bw",
    name: "B&W",
    label: "Monokrom",
    description: "Hitam putih klasik dengan kontras tinggi tegas.",
    cssFilter: "grayscale(100%) contrast(115%)",
    tag: "MONOCHROME",
    color: "#000000",
  },
  {
    id: "sepia",
    name: "SEPIA",
    label: "Retro",
    description: "Tone cokelat hangat bernuansa vintage era 70-an.",
    cssFilter: "sepia(80%) contrast(105%)",
    tag: "RETRO 70s",
    color: "#FF6BB5",
  },
  {
    id: "vintage",
    name: "VINTAGE",
    label: "Nostalgia",
    description: "Filter analog 90-an dengan desaturasi lembut estetik.",
    cssFilter: "sepia(45%) contrast(115%) saturate(85%)",
    tag: "FAVORIT ★",
    color: "#FFDE00",
  },
  {
    id: "warm",
    name: "WARM",
    label: "Hangat",
    description: "Sinar keemasan cerah menyerupai waktu senja (golden hour).",
    cssFilter: "saturate(130%) hue-rotate(-10deg) brightness(105%)",
    tag: "GOLDEN HOUR",
    color: "#4DD8FF",
  },
  {
    id: "cool",
    name: "COOL",
    label: "Sejuk",
    description: "Nuansa biru dingin modern, segar, dan futuristik.",
    cssFilter: "hue-rotate(15deg) saturate(110%) brightness(102%)",
    tag: "ARCTIC CHILL",
    color: "#3DDC84",
  },
  {
    id: "vivid",
    name: "VIVID",
    label: "Tajam",
    description: "Warna mencolok dan berani dengan saturasi tinggi.",
    cssFilter: "saturate(165%) contrast(120%)",
    tag: "HIGH POP",
    color: "#FF4D4D",
  },
  {
    id: "fade",
    name: "FADE",
    label: "Pudar",
    description: "Gaya matte sinematik lembut dengan bayangan pudar.",
    cssFilter: "contrast(85%) brightness(110%) saturate(80%)",
    tag: "CINEMATIC",
    color: "#B197FC",
  },
];

/* ================================================================
   FALLBACK DEMO PHOTOS (Inline SVG data URLs)
   Used if user navigated directly or storage is empty
   ================================================================ */
const DEMO_PHOTO_1 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700"><rect width="1000" height="700" fill="%23B197FC"/><circle cx="500" cy="270" r="160" fill="%23FFDE00" stroke="%23000000" stroke-width="12"/><rect x="340" y="440" width="320" height="260" rx="40" fill="%23FF6BB5" stroke="%23000000" stroke-width="12"/><circle cx="445" cy="250" r="24" fill="%23000000"/><circle cx="555" cy="250" r="24" fill="%23000000"/><path d="M 430 330 Q 500 390 570 330" fill="none" stroke="%23000000" stroke-width="14" stroke-linecap="round"/><rect x="80" y="60" width="220" height="60" fill="%23FFFFFF" stroke="%23000000" stroke-width="8"/><text x="190" y="102" font-family="sans-serif" font-weight="900" font-size="28" fill="%23000000" text-anchor="middle">POSE 01</text></svg>`;

const DEMO_PHOTO_2 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700"><rect width="1000" height="700" fill="%234DD8FF"/><circle cx="380" cy="290" r="140" fill="%23FFDE00" stroke="%23000000" stroke-width="12"/><circle cx="620" cy="290" r="140" fill="%23FF6BB5" stroke="%23000000" stroke-width="12"/><rect x="250" y="440" width="260" height="260" fill="%233DDC84" stroke="%23000000" stroke-width="12"/><rect x="490" y="440" width="260" height="260" fill="%23FFDE00" stroke="%23000000" stroke-width="12"/><circle cx="340" cy="280" r="20" fill="%23000000"/><circle cx="420" cy="280" r="20" fill="%23000000"/><circle cx="580" cy="280" r="20" fill="%23000000"/><circle cx="660" cy="280" r="20" fill="%23000000"/><path d="M 340 330 Q 380 370 420 330" fill="none" stroke="%23000000" stroke-width="10" stroke-linecap="round"/><path d="M 580 330 Q 620 370 660 330" fill="none" stroke="%23000000" stroke-width="10" stroke-linecap="round"/><rect x="700" y="60" width="220" height="60" fill="%23FFDE00" stroke="%23000000" stroke-width="8"/><text x="810" y="102" font-family="sans-serif" font-weight="900" font-size="28" fill="%23000000" text-anchor="middle">POSE 02</text></svg>`;

/* ================================================================
   IMAGE DRAW HELPER (aspect cover fit for 10:7 slots)
   ================================================================ */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const imgRatio = img.width / img.height;
  const targetRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* ================================================================
   FILTER CONTENT COMPONENT
   ================================================================ */
function FilterContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const sessionId = (params?.sessionId as string) || "";
  const frameSlug = searchParams.get("frame") || "classic-duo";
  const frameConfig: Frame = getFrameBySlug(frameSlug) || DEFAULT_FRAMES[0];

  // State
  const [photos, setPhotos] = useState<string[]>([DEMO_PHOTO_1, DEMO_PHOTO_2]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterConfig>(FILTERS[3]); // Default: VINTAGE
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);

  // Hidden canvas ref for final compositing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load photos from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`chosen_${sessionId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          setPhotos([parsed[0], parsed[1]]);
          setIsDemoMode(false);
          return;
        }
      }

      // Check raw shots if chosen photos not yet isolated
      const allShots = sessionStorage.getItem(`photos_${sessionId}`);
      if (allShots) {
        const parsedShots = JSON.parse(allShots);
        if (Array.isArray(parsedShots) && parsedShots.length >= 2) {
          setPhotos([parsedShots[0], parsedShots[1]]);
          setIsDemoMode(false);
          return;
        }
      }

      // Fallback to demo mode
      setIsDemoMode(true);
    } catch {
      setIsDemoMode(true);
    }
  }, [sessionId]);

  /* ---- Render Final Image to 1200x1800 Canvas ---- */
  const handleProceedToPrint = async () => {
    if (isRendering) return;
    setIsRendering(true);
    setRenderProgress(15);

    try {
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1800;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Gagal menginisialisasi canvas");
      }

      setRenderProgress(35);

      // Helper to asynchronously load image elements
      const loadImage = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Gagal memuat gambar: " + src.slice(0, 30)));
          img.src = src;
        });

      // 1. Draw base background
      ctx.fillStyle = "#FFFBEB";
      ctx.fillRect(0, 0, 1200, 1800);

      setRenderProgress(50);

      // 2. Load images concurrently
      const [img1, img2, overlayImg] = await Promise.all([
        loadImage(photos[0]),
        loadImage(photos[1]),
        loadImage(frameConfig.overlayPath).catch(() => {
          // Fallback if overlay fails to load
          return null;
        }),
      ]);

      setRenderProgress(70);

      // 3. Apply CSS filter for photo slots
      ctx.filter = selectedFilter.cssFilter === "none" ? "none" : selectedFilter.cssFilter;

      // Slot 1: (x=100, y=100, w=1000, h=700)
      drawImageCover(ctx, img1, 100, 100, 1000, 700);

      // Slot 2: (x=100, y=850, w=1000, h=700)
      drawImageCover(ctx, img2, 100, 850, 1000, 700);

      // 4. Reset filter for overlay and borders
      ctx.filter = "none";

      if (overlayImg) {
        ctx.drawImage(overlayImg, 0, 0, 1200, 1800);
      } else {
        // Fallback outer border if SVG fails
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 24;
        ctx.strokeRect(12, 12, 1176, 1776);
      }

      setRenderProgress(90);

      // 5. Export high-res JPEG
      const finalDataUrl = canvas.toDataURL("image/jpeg", 0.95);
      sessionStorage.setItem(`finalImage_${sessionId}`, finalDataUrl);
      sessionStorage.setItem(`filter_${sessionId}`, selectedFilter.name);

      setRenderProgress(95);

      // Save to backend server for phone QR scan & download
      try {
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            imageData: finalDataUrl,
            filter: selectedFilter.name,
          }),
        });
        if (res.ok) {
          const invData = await res.json();
          if (invData.token) {
            sessionStorage.setItem(`invoiceToken_${sessionId}`, invData.token);
            sessionStorage.setItem(`invoiceNumber_${sessionId}`, invData.invoiceNumber);
          }
        }
      } catch (uploadErr) {
        console.warn("Could not sync to /api/invoices:", uploadErr);
      }

      setRenderProgress(100);

      // 6. Navigate to Step 6: Result & Print
      setTimeout(() => {
        router.push(`/session/${sessionId}/result?frame=${frameSlug}`);
      }, 500);
    } catch (err) {
      console.error("Rendering error:", err);
      // Fallback proceed even if canvas export encounters a browser glitch
      sessionStorage.setItem(`filter_${sessionId}`, selectedFilter.name);
      setTimeout(() => {
        router.push(`/session/${sessionId}/result?frame=${frameSlug}`);
      }, 500);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 lg:p-8">
      {/* Hidden canvas for final compositing */}
      <canvas ref={canvasRef} className="hidden" width={1200} height={1800} />

      {/* ============ RENDERING OVERLAY MODAL ============ */}
      {isRendering && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6 select-none">
          <div className="bg-white border-4 border-ink shadow-brut-xl p-8 max-w-lg w-full text-center">
            {/* Header banner */}
            <div className="bg-brand-yellow border-4 border-ink px-4 py-3 mb-6 shadow-brut">
              <span className="font-display text-2xl lg:text-3xl uppercase tracking-tight">
                MEMPROSES FOTOMU...
              </span>
            </div>

            <p className="font-sans text-lg font-bold text-ink mb-6">
              Menerapkan filter <span className="underline decoration-4 decoration-brand-pink">{selectedFilter.name}</span> & menyatukan bingkai 1200 × 1800 px
            </p>

            {/* Brutalist Progress Bar */}
            <div className="w-full bg-paper border-4 border-ink p-1 mb-6 shadow-brut-sm">
              <div
                className="h-8 bg-brand-green border-2 border-ink transition-all duration-300"
                style={{ width: `${renderProgress}%` }}
              />
            </div>

            <div className="flex items-center justify-between font-mono text-sm text-ink/70">
              <span>ESTIMASI: ± 2 DETIK</span>
              <span className="font-bold text-ink">{renderProgress}% SELESAI</span>
            </div>
          </div>
        </div>
      )}

      {/* ============ HEADER ============ */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-brand-violet border-4 border-ink px-4 py-2 shadow-brut">
            <span className="font-display text-xl uppercase">LANGKAH 5 / 6</span>
          </div>
          <h1 className="font-display text-2xl lg:text-3xl uppercase tracking-tight">
            PILIH FILTER FOTO
          </h1>
        </div>

        {/* Active Filter Indicator */}
        <div className="flex items-center gap-3">
          <div className="bg-brand-yellow border-4 border-ink px-4 py-2 shadow-brut flex items-center gap-2">
            <span className="font-display text-xs uppercase text-ink/60">EFEK AKTIF:</span>
            <span className="font-display text-base uppercase font-bold">
              {selectedFilter.name}
            </span>
          </div>
        </div>
      </header>

      {/* Demo Notice Banner (if photos fallback was used) */}
      {isDemoMode && (
        <div className="bg-brand-pink border-4 border-ink p-3 mb-3 shadow-brut flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg">ℹ️</span>
            <span className="font-sans text-sm font-bold">
              MODE PRATINJAU: Menggunakan foto simulasi. Foto sesi sebelumnya tidak ditemukan di memori.
            </span>
          </div>
          <Button
            variant="secondary"
            size="md"
            className="!h-10 text-xs px-3 shadow-brut-sm"
            onClick={() => router.push(`/session/${sessionId}/capture?frame=${frameSlug}`)}
          >
            ← AMBIL FOTO ULANG
          </Button>
        </div>
      )}

      {/* ============ MAIN TWO-COLUMN WORKSPACE ============ */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 items-stretch justify-center">
        {/* ============ LEFT: LIVE STRIP PREVIEW ============ */}
        <div className="flex-1 max-w-md w-full bg-white border-4 border-ink shadow-brut-xl p-4 flex flex-col items-center justify-between">
          {/* Header Strip */}
          <div className="w-full bg-brand-yellow border-4 border-ink px-4 py-2 mb-2 flex items-center justify-between">
            <span className="font-display text-base uppercase tracking-tight">
              PRATINJAU HASIL CETAK 4R
            </span>
            <span className="bg-ink text-white px-2 py-0.5 font-mono text-xs font-bold uppercase">
              LIVE PREVIEW
            </span>
          </div>

          {/* Canvas Strip Container (2:3 Aspect Ratio) */}
          <div className="relative w-full max-w-[290px] aspect-[2/3] bg-paper border-4 border-ink shadow-brut-lg overflow-hidden select-none">
            {/* Slot 1 (Top) */}
            <div
              className="absolute overflow-hidden"
              style={{
                top: "5.55%",
                left: "8.33%",
                width: "83.33%",
                height: "38.89%",
              }}
            >
              <img
                src={photos[0]}
                alt="Foto Atas"
                className="w-full h-full object-cover transition-[filter] duration-200"
                style={{ filter: selectedFilter.cssFilter }}
              />
            </div>

            {/* Slot 2 (Bottom) */}
            <div
              className="absolute overflow-hidden"
              style={{
                top: "47.22%",
                left: "8.33%",
                width: "83.33%",
                height: "38.89%",
              }}
            >
              <img
                src={photos[1]}
                alt="Foto Bawah"
                className="w-full h-full object-cover transition-[filter] duration-200"
                style={{ filter: selectedFilter.cssFilter }}
              />
            </div>

            {/* Frame Overlay on Top */}
            <img
              src={frameConfig.overlayPath}
              alt={frameConfig.name}
              className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
            />
          </div>

          {/* Specifications Caption */}
          <div className="mt-3 w-full bg-paper border-3 border-ink px-3 py-1.5 flex items-center justify-between">
            <span className="font-mono text-xs text-ink/70">1200 × 1800 PX (4R)</span>
            <span className="font-mono text-xs font-bold text-ink">300 DPI SIAP CETAK</span>
          </div>
        </div>

        {/* ============ RIGHT: FILTER SELECTION CHIPS ============ */}
        <div className="flex-1 max-w-2xl w-full flex flex-col justify-between">
          <div className="bg-white border-4 border-ink shadow-brut-xl p-5 flex-1 flex flex-col">
            {/* Title */}
            <div className="flex items-center justify-between mb-3 border-b-4 border-ink pb-2">
              <div>
                <h2 className="font-display text-2xl uppercase tracking-tight">
                  PILIH GAYA FILTER
                </h2>
                <p className="font-sans text-xs text-ink/60">
                  Sentuh kartu filter di bawah untuk melihat perubahan seketika.
                </p>
              </div>
              <span className="bg-brand-cyan border-3 border-ink px-2.5 py-1 font-mono text-xs font-bold uppercase shadow-brut-sm">
                8 PILIHAN
              </span>
            </div>

            {/* 2x4 Grid of Filter Chips (Min-height 88px for Touch Screen) */}
            <div className="grid grid-cols-2 gap-3 flex-1">
              {FILTERS.map((f) => {
                const isSelected = selectedFilter.id === f.id;

                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFilter(f)}
                    className={[
                      "border-4 border-ink p-3 flex items-center justify-between cursor-pointer select-none transition-all duration-100 min-h-[84px]",
                      isSelected
                        ? "bg-brand-yellow shadow-brut-lg translate-x-[-2px] translate-y-[-2px] ring-2 ring-ink"
                        : "bg-white shadow-brut hover:bg-paper active:translate-x-1 active:translate-y-1 active:shadow-none",
                    ].join(" ")}
                  >
                    {/* Left: Swatch Mini-Preview */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-14 border-3 border-ink shadow-brut-sm overflow-hidden flex flex-col shrink-0"
                        style={{ filter: f.cssFilter }}
                      >
                        <div className="flex-1 bg-brand-pink" />
                        <div className="flex-1 bg-brand-yellow" />
                        <div className="flex-1 bg-brand-cyan" />
                      </div>

                      {/* Filter Titles */}
                      <div className="flex flex-col">
                        <span className="font-display text-lg uppercase leading-tight tracking-tight">
                          {f.name}
                        </span>
                        <span className="font-sans text-xs text-ink/60 font-semibold">
                          {f.label}
                        </span>
                        <span className="font-mono text-[10px] text-ink/40 mt-0.5">
                          {f.tag}
                        </span>
                      </div>
                    </div>

                    {/* Right: Selected Checkmark */}
                    {isSelected && (
                      <div className="bg-ink text-brand-yellow border-2 border-ink px-2 py-1 font-display text-xs uppercase shadow-brut-sm">
                        ✓ DIPILIH
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Filter Description Card */}
            <div className="mt-3 bg-brand-cyan/20 border-4 border-ink p-3 shadow-brut-sm flex items-center justify-between">
              <div>
                <span className="font-display text-xs uppercase text-ink/60 block">
                  DESKRIPSI EFEK {selectedFilter.name}:
                </span>
                <p className="font-sans text-sm font-medium text-ink mt-0.5">
                  {selectedFilter.description}
                </p>
              </div>
              <span className="font-display text-xl ml-3">✨</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ BOTTOM ACTION BAR ============ */}
      <div className="mt-4 bg-white border-4 border-ink p-4 flex items-center justify-between shadow-brut-lg">
        {/* Back Button */}
        <Button
          variant="secondary"
          size="md"
          onClick={() => router.push(`/session/${sessionId}/select?frame=${frameSlug}`)}
          disabled={isRendering}
        >
          ← GANTI FOTO
        </Button>

        {/* Finalize & Print Button */}
        <Button
          id="btn-cetak-selesai"
          variant="success"
          size="lg"
          className="px-10 lg:px-14 text-2xl lg:text-3xl shadow-brut-xl"
          onClick={handleProceedToPrint}
          disabled={isRendering}
        >
          {isRendering ? "MEMPROSES..." : "CETAK & SELESAI (LANGKAH 6) ➔"}
        </Button>
      </div>

      {/* ============ STEPPER FOOTER ============ */}
      <footer className="mt-4 flex justify-center">
        <Stepper currentStep={5} />
      </footer>
    </div>
  );
}

export default function FilterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border-4 border-ink shadow-brut p-8 font-display text-2xl uppercase">
            MEMUAT FILTER EDITOR...
          </div>
        </div>
      }
    >
      <FilterContent />
    </Suspense>
  );
}
