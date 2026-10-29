/**
 * Analisis berkas frame (server / runtime Node) — §6.3.1.
 * Sumber kebenaran: validasi, dimensi, deteksi slot, thumbnail. Klien tidak dipercaya.
 */
import sharp from "sharp";
import { DETECT, FRAME_LIMITS, PAPER_PRESETS, type PrintSuggestion, isKnownPaper, suggestPrintProfile } from "./frame.config";
import type { PrintProfileConfig, Slot } from "@/lib/operator-types";

export type { PrintProfileConfig, Slot };

/** Isi `slotsConfig` versi 2 (§6.3.1). Koordinat dalam piksel kanvas asli. */
export interface SlotsConfig {
  version: 2;
  slots: Slot[];
  print: PrintProfileConfig;
}

export class FrameError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "FrameError";
  }
}

function sortReadingOrder<T extends Slot>(slots: T[]): T[] {
  const rows: T[][] = [];
  for (const s of [...slots].sort((a, b) => a.y - b.y)) {
    const row = rows.find(
      (r) => Math.abs(r[0].y + r[0].h / 2 - (s.y + s.h / 2)) < DETECT.rowToleranceRatio * r[0].h
    );
    row ? row.push(s) : rows.push([s]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

export interface AnalyzeResult {
  width: number;
  height: number;
  slots: Slot[];
  /** Peringatan per-slot: "NON_RECT" bila rasio isi < minFillRatio. */
  warnings: string[];
}

/** Validasi + deteksi slot dari kanal alpha. Melempar `FrameError` bila tidak valid. */
export async function analyzeFrame(file: Buffer): Promise<AnalyzeResult> {
  if (file.length > FRAME_LIMITS.maxBytes) throw new FrameError("TOO_BIG", "Berkas terlalu besar");

  const base = sharp(file, { limitInputPixels: FRAME_LIMITS.maxPixels });
  const meta = await base.metadata();
  if (meta.format !== "png") throw new FrameError("FORMAT", "Berkas harus PNG");
  if ((meta.pages ?? 1) > 1) throw new FrameError("ANIMATED", "PNG animasi tidak didukung");

  const width = meta.width!;
  const height = meta.height!;
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (
    Math.min(width, height) < FRAME_LIMITS.minSide ||
    Math.max(width, height) > FRAME_LIMITS.maxSide ||
    ratio > FRAME_LIMITS.maxRatio
  ) {
    throw new FrameError("BOUNDS", "Dimensi di luar batas yang didukung");
  }

  // 1 byte per piksel: kanal alpha
  const { data } = await base
    .clone()
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = new Uint8Array(width * height);
  let transparent = 0;
  for (let i = 0; i < mask.length; i++) {
    if (data[i] < DETECT.alphaTransparentBelow) {
      mask[i] = 1;
      transparent++;
    }
  }
  if (transparent === 0) throw new FrameError("NO_ALPHA", "PNG tidak memiliki area transparan");

  const shortSide = Math.min(width, height);
  const minArea = DETECT.minAreaRatio * width * height;
  const minSide = DETECT.minSlotSideRatio * shortSide;
  const queue = new Int32Array(width * height);
  const found: (Slot & { area: number })[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue;
    let head = 0;
    let tail = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    queue[tail++] = start;
    mask[start] = 2;
    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      const y = (p - x) / width;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] === 1) {
        mask[p - 1] = 2;
        queue[tail++] = p - 1;
      }
      if (x < width - 1 && mask[p + 1] === 1) {
        mask[p + 1] = 2;
        queue[tail++] = p + 1;
      }
      if (y > 0 && mask[p - width] === 1) {
        mask[p - width] = 2;
        queue[tail++] = p - width;
      }
      if (y < height - 1 && mask[p + width] === 1) {
        mask[p + width] = 2;
        queue[tail++] = p + width;
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (area >= minArea && w >= minSide && h >= minSide) {
      found.push({ x: minX, y: minY, w, h, area });
    }
  }

  const warnings = found
    .filter((s) => s.area / (s.w * s.h) < DETECT.minFillRatio)
    .map(() => "NON_RECT");

  const bleed = Math.max(1, Math.round(DETECT.bleedRatio * shortSide));
  const slots = sortReadingOrder(found).map((s) => {
    const x = Math.max(0, s.x - bleed);
    const y = Math.max(0, s.y - bleed);
    return {
      x,
      y,
      w: Math.min(width - x, s.w + 2 * bleed),
      h: Math.min(height - y, s.h + 2 * bleed),
    };
  });

  return { width, height, slots, warnings };
}

/** Thumbnail: rasio dipertahankan, tidak diperbesar (§6.3.1). */
export function makeThumb(file: Buffer, maxSide: number): Promise<Buffer> {
  return sharp(file)
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

/* --------------------------------------------------------- slotsConfig v2 */

export function parseSlotsConfig(raw: string | null | undefined): SlotsConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SlotsConfig>;
    if (!parsed || !Array.isArray(parsed.slots) || !parsed.print) return null;
    const slots = parsed.slots.filter(
      (s): s is Slot =>
        !!s && [s.x, s.y, s.w, s.h].every((n) => typeof n === "number" && Number.isFinite(n))
    );
    if (!slots.length) return null;
    return {
      version: 2,
      slots,
      print: {
        dpi: Number(parsed.print.dpi) || 300,
        paper: String(parsed.print.paper ?? "4R"),
        widthIn: Number(parsed.print.widthIn) || 4,
        heightIn: Number(parsed.print.heightIn) || 6,
        fit: parsed.print.fit === "COVER" ? "COVER" : "CONTAIN",
      },
    };
  } catch {
    return null;
  }
}

export function serializeSlotsConfig(config: SlotsConfig): string {
  return JSON.stringify(config);
}

/* -------------------------------------------------------------- Analisis UI */

export interface FrameAnalysis {
  width: number;
  height: number;
  ratio: number;
  orientation: "PORTRAIT" | "LANDSCAPE" | "SQUARE";
  megapixels: number;
  slots: Slot[];
  warnings: string[];
  printSuggestion: PrintSuggestion;
  effectiveDpi: number;
  upscale: boolean;
}

/** Faktor perbesaran per slot terhadap dimensi kamera (§6.3.3). */
export function upscaleFactor(
  slot: { w: number; h: number },
  cam: { w: number; h: number }
): number {
  const r = slot.w / slot.h;
  const cropW = cam.w / cam.h > r ? cam.h * r : cam.w;
  return slot.w / cropW;
}

/** Bangun payload analisis lengkap untuk panel operator (§9 `/frames/analyze`). */
export function buildAnalysis(
  result: AnalyzeResult,
  activePaper: string,
  minDpiWarn: number,
  camera?: { w: number; h: number }
): FrameAnalysis {
  const { width, height, slots, warnings } = result;
  const ratio = Math.max(width, height) / Math.min(width, height);
  const orientation: FrameAnalysis["orientation"] =
    Math.abs(width - height) / Math.max(width, height) < 0.02
      ? "SQUARE"
      : height > width
        ? "PORTRAIT"
        : "LANDSCAPE";

  const printSuggestion = suggestPrintProfile(width, height, activePaper, minDpiWarn);

  let upscale = false;
  if (camera && slots.length) {
    upscale = slots.some((s) => upscaleFactor(s, camera) > 1.25);
  }

  return {
    width,
    height,
    ratio: Number(ratio.toFixed(4)),
    orientation,
    megapixels: Number(((width * height) / 1_000_000).toFixed(2)),
    slots,
    warnings,
    printSuggestion,
    effectiveDpi: printSuggestion.effectiveDpi,
    upscale,
  };
}

/** Label format ringkas untuk kartu katalog (mis. "4R Lansekap", "9:16"). */
export function formatLabel(width: number, height: number, paper: string): string {
  const orientation = height >= width ? "Potret" : "Lansekap";
  const ratio = Math.max(width, height) / Math.min(width, height);
  const match = (Object.keys(PAPER_PRESETS) as (keyof typeof PAPER_PRESETS)[]).find((id) => {
    const p = PAPER_PRESETS[id];
    const presetRatio = Math.max(p.widthIn, p.heightIn) / Math.min(p.widthIn, p.heightIn);
    return Math.abs(presetRatio - ratio) / presetRatio <= 0.03;
  });
  if (match) return `${match} ${orientation}`;
  if (isKnownPaper(paper)) return `${paper} ${orientation}`;
  return `${Math.round(ratio * 100) / 100}:1 ${orientation}`;
}
