/**
 * Persistensi frame (§6.3.1): unggah, analisis ulang di server, thumbnail, slotsConfig v2.
 */
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { Frame } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SETTING_KEYS, getSetting } from "@/lib/settings";
import { isValidSlotCountForCategory, type FrameCategory } from "@/lib/constants";
import { THUMB_MAX_SIDE, suggestPrintProfile } from "./frame.config";
import {
  analyzeFrame,
  buildAnalysis,
  formatLabel,
  makeThumb,
  parseSlotsConfig,
  serializeSlotsConfig,
  FrameError,
  type FrameAnalysis,
  type PrintProfileConfig,
  type Slot,
  type SlotsConfig,
} from "./analyze";

const FRAMES_DIR = path.resolve(process.cwd(), "storage", "frames");

export function frameOverlayRelativePath(id: string): string {
  return `frames/${id}.png`;
}
export function frameThumbRelativePath(id: string): string {
  return `frames/${id}.thumb.png`;
}

/** Dimensi kamera dari `camera.maxResolution` untuk peringatan upscale (§6.3.3). */
export function cameraDims(maxResolution: string): { w: number; h: number } {
  return maxResolution === "4K" ? { w: 3840, h: 2160 } : { w: 1920, h: 1080 };
}

export async function getFrameContext(): Promise<{
  activePaper: string;
  minDpiWarn: number;
  camera: { w: number; h: number };
}> {
  const [activePaper, minDpiWarn, maxRes] = await Promise.all([
    getSetting(SETTING_KEYS.PRINT_ACTIVE_PAPER),
    getSetting(SETTING_KEYS.PRINT_MIN_DPI_WARN),
    getSetting(SETTING_KEYS.CAMERA_MAX_RESOLUTION),
  ]);
  return {
    activePaper: activePaper || "4R",
    minDpiWarn: Number(minDpiWarn) || 150,
    camera: cameraDims(maxRes || "FULL_HD"),
  };
}

export interface FrameRow {
  id: string;
  name: string;
  category: string;
  isRecommended: boolean;
  slotCount: number;
  slots: Slot[];
  print: PrintProfileConfig | null;
  canvasWidth: number;
  canvasHeight: number;
  overlayPath: string;
  thumbnailPath: string | null;
  isActive: boolean;
  sortOrder: number;
  formatLabel: string;
  overlayUrl: string;
  thumbnailUrl: string;
}

export function serializeFrame(frame: Frame): FrameRow {
  const config = parseSlotsConfig(frame.slotsConfig);
  const overlayPath = frame.overlayPath;
  const thumbnailPath = frame.thumbnailPath ?? overlayPath;
  return {
    id: frame.id,
    name: frame.name,
    category: frame.category,
    isRecommended: frame.isRecommended,
    slotCount: frame.slotCount,
    slots: config?.slots ?? [],
    print: config?.print ?? null,
    canvasWidth: frame.canvasWidth,
    canvasHeight: frame.canvasHeight,
    overlayPath,
    thumbnailPath,
    isActive: frame.isActive,
    sortOrder: frame.sortOrder,
    formatLabel: formatLabel(frame.canvasWidth, frame.canvasHeight, config?.print.paper ?? "4R"),
    overlayUrl: `/api/media/${overlayPath}`,
    thumbnailUrl: `/api/media/${thumbnailPath}`,
  };
}

export interface CreateFrameInput {
  file: Buffer;
  name: string;
  category: FrameCategory;
  isRecommended: boolean;
  /** Slot/profil yang disesuaikan operator (opsional; divalidasi terhadap hasil analisis). */
  slots?: Slot[];
  print?: PrintProfileConfig;
}

function sanitizeName(name: string): string {
  const clean = name.replace(/[<>]/g, "").trim().slice(0, 60);
  return clean || "Frame";
}

/** Analisis berkas tanpa menyimpan (§9 `/frames/analyze`). */
export async function analyzeUpload(file: Buffer, category?: FrameCategory) {
  const result = await analyzeFrame(file);
  const ctx = await getFrameContext();
  const analysis: FrameAnalysis = buildAnalysis(result, ctx.activePaper, ctx.minDpiWarn, ctx.camera);
  if (category) {
    analysis.warnings = [
      ...analysis.warnings,
      ...(isValidSlotCountForCategory(category, result.slots.length)
        ? []
        : [`Jumlah slot ${result.slots.length} tidak cocok untuk kategori ${category}`]),
    ];
  }
  return analysis;
}

export async function createFrame(input: CreateFrameInput): Promise<Frame> {
  const ctx = await getFrameContext();
  const result = await analyzeFrame(input.file);

  // Sumber kebenaran: selalu analisis ulang dan abaikan dimensi/slot klien.
  const slots = input.slots?.length ? input.slots : result.slots;
  const slotCount = slots.length;
  if (!isValidSlotCountForCategory(input.category, slotCount)) {
    throw new FrameError(
      "SLOT_MISMATCH",
      `Jumlah slot ${slotCount} tidak cocok untuk kategori ${input.category}`
    );
  }

  const shortSide = Math.min(result.width, result.height);
  const minSlotSide = 0.05 * shortSide;
  for (const s of slots) {
    const outOfBounds =
      s.x < 0 || s.y < 0 || s.x + s.w > result.width || s.y + s.h > result.height;
    if (outOfBounds || s.w < minSlotSide || s.h < minSlotSide) {
      throw new FrameError("SLOT_INVALID", "Ada slot di luar kanvas atau terlalu kecil");
    }
  }

  const id = randomUUID();
  await fs.mkdir(FRAMES_DIR, { recursive: true });
  await fs.writeFile(path.join(FRAMES_DIR, `${id}.png`), input.file);
  const thumb = await makeThumb(input.file, THUMB_MAX_SIDE);
  await fs.writeFile(path.join(FRAMES_DIR, `${id}.thumb.png`), thumb);

  const suggestion = suggestPrintProfile(
    result.width,
    result.height,
    ctx.activePaper,
    ctx.minDpiWarn
  );
  const print: PrintProfileConfig =
    input.print ?? {
      dpi: suggestion.dpi,
      paper: suggestion.paper,
      widthIn: suggestion.widthIn,
      heightIn: suggestion.heightIn,
      fit: suggestion.fit,
    };
  const config: SlotsConfig = { version: 2, slots, print };

  return prisma.frame.create({
    data: {
      id,
      name: sanitizeName(input.name),
      category: input.category,
      isRecommended: input.isRecommended,
      slotCount,
      slotsConfig: serializeSlotsConfig(config),
      overlayPath: frameOverlayRelativePath(id),
      thumbnailPath: frameThumbRelativePath(id),
      canvasWidth: result.width,
      canvasHeight: result.height,
      isActive: true,
    },
  });
}
