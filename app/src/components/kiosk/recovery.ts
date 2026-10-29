"use client";

import { SHOT_COUNT } from "@/lib/constants";
import type { KioskStatusView } from "./types";

/**
 * Turunkan layar dari data transaksi (§7.9) — bukan dari kolom `step`.
 * Mengembalikan path kios yang sesuai.
 */
export function deriveScreen(s: KioskStatusView): string {
  if (s.status === "PENDING") return `/kiosk/payment/${s.id}`;
  if (s.status === "PAID") return `/kiosk/frame/${s.id}`;

  if (s.status === "PROCESSING") {
    const sess = s.session;
    if (!sess || !sess.frameId) return `/kiosk/frame/${s.id}`;
    if (sess.hasFinal) return `/kiosk/session/${sess.id}/done`;
    if (sess.photoCount < SHOT_COUNT) return `/kiosk/session/${sess.id}/capture`;
    return `/kiosk/session/${sess.id}/editor`;
  }

  return "/kiosk";
}

const KEY = "happychip.kiosk.transactionId";

export function rememberTransaction(id: string): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* sessionStorage tidak tersedia */
  }
}

export function forgetTransaction(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* diabaikan */
  }
}
