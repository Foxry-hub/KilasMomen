/**
 * Konstanta domain Happy Click 2.0.
 * Nilai di database/API tetap memakai kode bahasa Inggris; label UI ada di `copy.id.ts`.
 */
import { z } from "zod";

/* ---------------------------------------------------------------- Status */

export const TRANSACTION_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type TransactionStatus =
  (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

export const transactionStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
]);

/* ----------------------------------------------------- Alasan pembatalan */

export const CANCEL_REASON = {
  TIMEOUT: "TIMEOUT",
  OPERATOR: "OPERATOR",
  KIOSK_IDLE: "KIOSK_IDLE",
  OPERATOR_AFTER_PAYMENT: "OPERATOR_AFTER_PAYMENT",
} as const;

export type CancelReason = (typeof CANCEL_REASON)[keyof typeof CANCEL_REASON];

export const cancelReasonSchema = z.enum([
  "TIMEOUT",
  "OPERATOR",
  "KIOSK_IDLE",
  "OPERATOR_AFTER_PAYMENT",
]);

/* ------------------------------------------------------ Metode pembayaran */

export const PAYMENT_METHOD = { CASH: "CASH", QRIS: "QRIS" } as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
export const paymentMethodSchema = z.enum(["CASH", "QRIS"]);

/* ------------------------------------------------------------------ Frame */

export const FRAME_CATEGORY = {
  TWO: "TWO",
  THREE: "THREE",
  MANY: "MANY",
} as const;
export type FrameCategory = (typeof FRAME_CATEGORY)[keyof typeof FRAME_CATEGORY];
export const frameCategorySchema = z.enum(["TWO", "THREE", "MANY"]);

/** Filter katalog kios: ALL + kategori. */
export const FRAME_FILTER = {
  ALL: "ALL",
  TWO: "TWO",
  THREE: "THREE",
  MANY: "MANY",
} as const;
export type FrameFilter = (typeof FRAME_FILTER)[keyof typeof FRAME_FILTER];

/** Rentang slotCount yang sah untuk tiap kategori (§6.3.1). */
export function isValidSlotCountForCategory(
  category: FrameCategory,
  slotCount: number
): boolean {
  if (category === FRAME_CATEGORY.TWO) return slotCount === 2;
  if (category === FRAME_CATEGORY.THREE) return slotCount === 3;
  return slotCount >= 4 && slotCount <= 6;
}

/* ------------------------------------------------------------- Filter foto */

export const COLOR_FILTERS = [
  "ORIGINAL",
  "BW",
  "VIVID",
  "SEPIA",
  "VINTAGE",
  "WARM",
  "COOL",
  "FADE",
] as const;
export type ColorFilter = (typeof COLOR_FILTERS)[number];
export const colorFilterSchema = z.enum(COLOR_FILTERS);

/* -------------------------------------------------------------- Output log */

export const OUTPUT_TYPE = { PRINT: "PRINT", QR: "QR", FOTOCOPY: "FOTOCOPY" } as const;
export type OutputType = (typeof OUTPUT_TYPE)[keyof typeof OUTPUT_TYPE];

/* ------------------------------------------------------------------ Event */

export const EVENT_STATUS = { OPEN: "OPEN", CLOSED: "CLOSED" } as const;
export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

/* ------------------------------------------------------------------ Tetap */

export const SHOT_COUNT = 6;
export const MAX_RETAKE_PER_SESSION = 3;
export const TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000;
export const KIOSK_IDLE_MS = 90 * 1000;
export const AUTO_RESET_SEC = 10;

/** Paket default (dapat diubah operator lewat Setting). */
export const DEFAULT_PACKAGES: { strips: number; price: number }[] = [
  { strips: 1, price: 10000 },
  { strips: 2, price: 15000 },
  { strips: 3, price: 20000 },
];

export interface PackageOption {
  strips: number;
  price: number;
}
