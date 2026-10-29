/**
 * Jendela Event otomatis (§6.6): masa aktif soft copy.
 * Event dibuka otomatis oleh transaksi pertama (T1) dan ditutup saat operator menekan "Akhiri Event".
 */
import { prisma } from "./prisma";
import { SETTING_KEYS, getSettings, setSetting } from "./settings";
import { EVENT_STATUS } from "./constants";
import { publish } from "./events";

export interface EventInfo {
  status: string;
  openedAt: Date | null;
  lastActivityAt: Date | null;
  gapHours: number;
  maxHours: number;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getEventInfo(): Promise<EventInfo> {
  const settings = await getSettings();
  return {
    status: settings[SETTING_KEYS.EVENT_STATUS] ?? EVENT_STATUS.CLOSED,
    openedAt: parseDate(settings[SETTING_KEYS.EVENT_OPENED_AT]),
    lastActivityAt: parseDate(settings[SETTING_KEYS.EVENT_LAST_ACTIVITY_AT]),
    gapHours: Number(settings[SETTING_KEYS.EVENT_GAP_HOURS]) || 4,
    maxHours: Number(settings[SETTING_KEYS.SOFTCOPY_MAX_HOURS]) || 12,
  };
}

/**
 * Buka event bila belum ada; lanjutkan event yang sama bila masih dalam `gapHours`.
 * Dipanggil saat transaksi pertama dibuat (T1).
 */
export async function ensureEventOpen(): Promise<{ opened: boolean }> {
  const info = await getEventInfo();
  const now = new Date();
  const withinGap =
    !info.lastActivityAt ||
    now.getTime() - info.lastActivityAt.getTime() <= info.gapHours * 3_600_000;

  if (info.status === EVENT_STATUS.OPEN && withinGap) {
    await touchEvent();
    return { opened: false };
  }

  await setSetting(SETTING_KEYS.EVENT_STATUS, EVENT_STATUS.OPEN);
  await setSetting(SETTING_KEYS.EVENT_OPENED_AT, now.toISOString());
  await setSetting(SETTING_KEYS.EVENT_LAST_ACTIVITY_AT, now.toISOString());
  publish("transaction", { action: "event-opened", at: now.toISOString() });
  return { opened: true };
}

/** Perbarui `lastActivityAt` selama event aktif. */
export async function touchEvent(): Promise<void> {
  const info = await getEventInfo();
  if (info.status !== EVENT_STATUS.OPEN) return;
  await setSetting(SETTING_KEYS.EVENT_LAST_ACTIVITY_AT, new Date().toISOString());
}

/** Tutup event: semua link soft copy langsung 404 seragam. */
export async function closeEvent(): Promise<void> {
  await setSetting(SETTING_KEYS.EVENT_STATUS, EVENT_STATUS.CLOSED);
  publish("transaction", { action: "event-closed", at: new Date().toISOString() });
}

/** Aturan validitas link publik (§6.6). */
export function isPublicLinkValid(
  transaction: {
    status: string;
    createdAt: Date;
    session: { finalImagePath: string | null } | null;
  },
  info: EventInfo
): boolean {
  if (info.status !== EVENT_STATUS.OPEN) return false;
  if (transaction.status !== "PROCESSING" && transaction.status !== "COMPLETED") return false;
  if (!transaction.session?.finalImagePath) return false;
  if (info.openedAt && transaction.createdAt.getTime() < info.openedAt.getTime()) return false;
  if (info.maxHours > 0) {
    const ageMs = Date.now() - transaction.createdAt.getTime();
    if (ageMs > info.maxHours * 3_600_000) return false;
  }
  return true;
}

/** Apakah ada transaksi sama sekali (event belum pernah dibuka). */
export async function hasAnyTransaction(): Promise<boolean> {
  const count = await prisma.transaction.count();
  return count > 0;
}
