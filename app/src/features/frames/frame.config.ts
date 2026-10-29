/**
 * Konfigurasi frame: batas validasi, ambang deteksi proporsional, preset kertas (§6.3.1, §6.3.2).
 * Berisi ANGKA KEBIJAKAN, bukan ukuran kanvas. Dimensi kanvas selalu dibaca dari berkas PNG.
 */

export const FRAME_LIMITS = {
  minSide: 300,
  maxSide: 6000,
  maxPixels: 24_000_000,
  minRatio: 1 / 4,
  maxRatio: 4,
  maxBytes: 20 * 1024 * 1024,
} as const;

export const DETECT = {
  alphaTransparentBelow: 10,
  minAreaRatio: 0.01,
  minSlotSideRatio: 0.05,
  bleedRatio: 0.002,
  rowToleranceRatio: 0.5,
  minFillRatio: 0.9,
} as const;

export const THUMB_MAX_SIDE = 480;

/** Preset kertas dalam potret (inci). Orientasi disesuaikan dengan frame saat dipakai. */
export const PAPER_PRESETS = {
  "4R": { widthIn: 4, heightIn: 6 },
  "5R": { widthIn: 5, heightIn: 7 },
  "6R": { widthIn: 6, heightIn: 8 },
  "2x6": { widthIn: 2, heightIn: 6 },
  "8x10": { widthIn: 8, heightIn: 10 },
  A6: { widthIn: 4.13, heightIn: 5.83 },
} as const;

export type PaperId = keyof typeof PAPER_PRESETS;

export const DEFAULT_PAPER: PaperId = "4R";

export interface PrintProfile {
  dpi: number;
  paper: string;
  widthIn: number;
  heightIn: number;
  fit: "CONTAIN" | "COVER";
}

export interface PrintSuggestion extends PrintProfile {
  effectiveDpi: number;
  upscale: boolean;
  warnings: string[];
}

export function isKnownPaper(id: string): id is PaperId {
  return Object.prototype.hasOwnProperty.call(PAPER_PRESETS, id);
}

/** Rasio panjang:pendek dari sebuah preset. */
export function paperRatio(id: PaperId): number {
  const p = PAPER_PRESETS[id];
  return p.heightIn / p.widthIn;
}

/** DPI efektif untuk frame pada kertas tertentu (orientasi mengikuti frame). */
export function effectiveDpi(
  frameWidth: number,
  frameHeight: number,
  paper: PaperId
): number {
  const preset = PAPER_PRESETS[paper];
  const portrait = frameHeight >= frameWidth;
  const physWidthIn = portrait ? preset.widthIn : preset.heightIn;
  const physHeightIn = portrait ? preset.heightIn : preset.widthIn;
  return Math.min(frameWidth / physWidthIn, frameHeight / physHeightIn);
}

/**
 * Tentukan profil cetak default (§6.3.2):
 * preset dengan rasio cocok (≤3%) dan DPI memadai, kertas aktif diutamakan; selain itu
 * kertas aktif dengan `fit = CONTAIN` dan peringatan margin.
 */
export function suggestPrintProfile(
  frameWidth: number,
  frameHeight: number,
  activePaper: string,
  minDpiWarn = 150
): PrintSuggestion {
  const active: PaperId = isKnownPaper(activePaper) ? activePaper : DEFAULT_PAPER;
  const frameRatio = Math.max(frameWidth, frameHeight) / Math.min(frameWidth, frameHeight);

  const candidates = (Object.keys(PAPER_PRESETS) as PaperId[]).filter((id) => {
    const ratioDiff = Math.abs(paperRatio(id) - frameRatio) / paperRatio(id);
    if (ratioDiff > 0.03) return false;
    return effectiveDpi(frameWidth, frameHeight, id) >= minDpiWarn;
  });

  const chosen: PaperId = candidates.includes(active) ? active : candidates[0] ?? active;
  const preset = PAPER_PRESETS[chosen];
  const portrait = frameHeight >= frameWidth;

  const warnings: string[] = [];

  // Margin putih bila rasio frame tidak pas dengan kertas terpilih.
  const ratioDiff = Math.abs(paperRatio(chosen) - frameRatio) / paperRatio(chosen);
  const hasMargins = ratioDiff > 0.03;
  if (hasMargins) warnings.push("Ada margin putih pada kertas ini");

  const dpi = effectiveDpi(frameWidth, frameHeight, chosen);
  if (dpi < minDpiWarn) warnings.push("Resolusi rendah untuk kertas ini");

  const widthIn = portrait ? preset.widthIn : preset.heightIn;
  const heightIn = portrait ? preset.heightIn : preset.widthIn;

  return {
    dpi: Math.round(dpi),
    paper: chosen,
    widthIn,
    heightIn,
    // Muat seluruh gambar bila ada margin putih, penuh bila rasio sudah pas.
    fit: hasMargins ? "CONTAIN" : "COVER",
    effectiveDpi: Math.round(dpi),
    // Printer akan melakukan upscale bila DPI di bawah 300.
    upscale: dpi < 300,
    warnings,
  };
}
