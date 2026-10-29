/**
 * Perakitan akhir di browser (§7.7, §7.8): foto cover-fit per slot, filter warna pada
 * layer foto, lalu overlay PNG di atasnya. Digambar pada DIMENSI ASLI frame.
 */
import type { ColorFilter } from "@/lib/constants";
import type { Slot } from "@/lib/operator-types";

const FILTER_CSS: Record<ColorFilter, string> = {
  ORIGINAL: "none",
  BW: "grayscale(1)",
  VIVID: "saturate(1.5) contrast(1.1)",
  SEPIA: "sepia(0.85)",
  VINTAGE: "sepia(0.4) saturate(0.9) contrast(1.15) brightness(0.95)",
  WARM: "saturate(1.15) hue-rotate(-12deg)",
  COOL: "saturate(1.1) hue-rotate(12deg)",
  FADE: "saturate(0.75) contrast(0.9) brightness(1.08)",
};

/** Nilai CSS `filter` untuk sebuah filter warna. */
export function filterCss(filter: ColorFilter): string {
  return FILTER_CSS[filter] ?? "none";
}

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Crop tengah (cover-fit, tanpa distorsi) dari sumber ke tujuan. */
export function coverRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): SourceRect {
  if (srcW <= 0 || srcH <= 0) return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    // sumber lebih lebar → potong kiri/kanan
    const sw = srcH * dstRatio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  // sumber lebih tinggi → potong atas/bawah
  const sh = srcW / dstRatio;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

export type DrawableImage = HTMLImageElement | ImageBitmap;

function imageSize(img: DrawableImage): { w: number; h: number } {
  if (img instanceof HTMLImageElement) {
    return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
  }
  return { w: img.width, h: img.height };
}

/** Default: slot ke-i ← foto ke-(i+1) (§7.7). */
export function defaultAssignments(slotCount: number): Record<number, number> {
  const map: Record<number, number> = {};
  for (let i = 0; i < slotCount; i++) map[i] = i + 1;
  return map;
}

export interface ComposeOptions {
  width: number;
  height: number;
  slots: Slot[];
  /** slotIndex → shotIndex (1..6). */
  assignments: Record<number, number>;
  /** shotIndex → gambar. */
  images: Record<number, DrawableImage>;
  overlay?: DrawableImage | null;
  filter: ColorFilter;
}

/** Gambar hasil akhir ke `canvas` (dimensi asli frame). */
export function composeFrame(canvas: HTMLCanvasElement, opts: ComposeOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = opts.width;
  canvas.height = opts.height;
  ctx.clearRect(0, 0, opts.width, opts.height);

  ctx.save();
  ctx.filter = filterCss(opts.filter);
  for (let i = 0; i < opts.slots.length; i++) {
    const slot = opts.slots[i];
    const shot = opts.assignments[i];
    const img = shot != null ? opts.images[shot] : undefined;
    if (!img) continue;
    const { w, h } = imageSize(img);
    if (!w || !h) continue;
    const r = coverRect(w, h, slot.w, slot.h);
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, slot.x, slot.y, slot.w, slot.h);
  }
  ctx.restore();

  // Overlay PNG di atas, TANPA filter (§6.3.3).
  if (opts.overlay) {
    ctx.drawImage(opts.overlay, 0, 0, opts.width, opts.height);
  }
}

/** Muat gambar; resolusi asli dipertahankan. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`));
    img.src = src;
  });
}
