/**
 * Bentuk payload status kios yang dipakai bersama oleh `/api/kiosk/*` (§7.3, §7.9, §7.10).
 * Kios menurunkan layar dari data ini, bukan dari kolom `step`.
 */
import type { Prisma } from "@prisma/client";

export type KioskTransaction = Prisma.TransactionGetPayload<{
  include: { session: { include: { frame: true; photos: true } } };
}>;

export interface KioskPhotoRef {
  shotIndex: number;
  url: string;
}

export interface KioskSessionView {
  id: string;
  frameId: string | null;
  frame: {
    id: string;
    name: string;
    category: string;
    slotCount: number;
    canvasWidth: number;
    canvasHeight: number;
    slots: { x: number; y: number; w: number; h: number }[];
    overlayUrl: string;
    print: { dpi: number; paper: string; widthIn: number; heightIn: number; fit: string } | null;
  } | null;
  photoCount: number;
  photos: KioskPhotoRef[];
  retakeCountUsed: number;
  filterChosen: string;
  slotAssignments: { slotIndex: number; shotIndex: number }[] | null;
  hasFinal: boolean;
}

export interface KioskStatusView {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  packageStripsCount: number;
  paymentMethod: string | null;
  expiresAt: string;
  serverTime: string;
  session: KioskSessionView | null;
}

function parseAssignments(raw: string | null): { slotIndex: number; shotIndex: number }[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed
      .filter(
        (s): s is { slotIndex: number; shotIndex: number } =>
          !!s &&
          typeof (s as { slotIndex?: unknown }).slotIndex === "number" &&
          typeof (s as { shotIndex?: unknown }).shotIndex === "number"
      )
      .map((s) => ({ slotIndex: s.slotIndex, shotIndex: s.shotIndex }));
    return items.length ? items : null;
  } catch {
    return null;
  }
}

export interface KioskSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KioskPrintProfile {
  dpi: number;
  paper: string;
  widthIn: number;
  heightIn: number;
  fit: string;
}

function parseSlotsConfig(raw: string): {
  slots: KioskSlot[];
  print: KioskPrintProfile | null;
} {
  try {
    const parsed = JSON.parse(raw) as { slots?: unknown; print?: unknown };
    const slots = Array.isArray(parsed?.slots)
      ? (parsed.slots as KioskSlot[]).filter(
          (s) => s && [s.x, s.y, s.w, s.h].every((n) => typeof n === "number" && Number.isFinite(n))
        )
      : [];
    const p = parsed?.print as Partial<KioskPrintProfile> | undefined;
    const print =
      p && typeof p.dpi === "number" && typeof p.paper === "string"
        ? {
            dpi: p.dpi,
            paper: p.paper,
            widthIn: Number(p.widthIn) || 0,
            heightIn: Number(p.heightIn) || 0,
            fit: typeof p.fit === "string" ? p.fit : "CONTAIN",
          }
        : null;
    return { slots, print };
  } catch {
    return { slots: [], print: null };
  }
}

/** Bangun payload status lengkap untuk polling kios. */
export function buildKioskStatus(t: KioskTransaction): KioskStatusView {
  const s = t.session;
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    totalAmount: t.totalAmount,
    packageStripsCount: t.packageStripsCount,
    paymentMethod: t.paymentMethod,
    expiresAt: t.expiresAt.toISOString(),
    serverTime: new Date().toISOString(),
    session: s
      ? (() => {
          const cfg = parseSlotsConfig(s.frame?.slotsConfig ?? "");
          return {
            id: s.id,
            frameId: s.frameId,
            frame: s.frame
              ? {
                  id: s.frame.id,
                  name: s.frame.name,
                  category: s.frame.category,
                  slotCount: s.frame.slotCount,
                  canvasWidth: s.frame.canvasWidth,
                  canvasHeight: s.frame.canvasHeight,
                  slots: cfg.slots,
                  overlayUrl: `/api/media/${s.frame.overlayPath}`,
                  print: cfg.print,
                }
              : null,
            photoCount: s.photos.length,
            photos: [...s.photos]
              .sort((a, b) => a.shotIndex - b.shotIndex)
              .map((p) => ({ shotIndex: p.shotIndex, url: `/api/media/${p.filePath}` })),
            retakeCountUsed: s.retakeCountUsed,
            filterChosen: s.filterChosen ?? "ORIGINAL",
            slotAssignments: parseAssignments(s.slotAssignments),
            hasFinal: Boolean(s.finalImagePath),
          };
        })()
      : null,
  };
}

export const KIOSK_TRANSACTION_INCLUDE = {
  session: { include: { frame: true, photos: true } },
} as const;
