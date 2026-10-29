/**
 * Akses `Setting` (key/value) dengan nilai default terpusat (§6.5, §8.4).
 */
import { prisma } from "./prisma";
import { DEFAULT_PACKAGES, type PackageOption } from "./constants";

export const SETTING_KEYS = {
  EVENT_STATUS: "event.status",
  EVENT_OPENED_AT: "event.openedAt",
  EVENT_LAST_ACTIVITY_AT: "event.lastActivityAt",
  EVENT_GAP_HOURS: "event.gapHours",
  EVENT_AUTO_CLOSE_AT: "event.autoCloseAt",
  SOFTCOPY_MAX_HOURS: "softcopy.maxHours",

  TUNNEL_MODE: "tunnel.mode",
  PUBLIC_BASE_URL: "publicBaseUrl",

  OPERATOR_PIN_HASH: "operator.pinHash",
  PRICING_PACKAGES: "pricing.packages",
  QRIS_IMAGE_PATH: "qris.imagePath",

  CAMERA_SOURCE: "camera.source",
  CAMERA_DEVICE_LABEL: "camera.deviceLabel",
  CAMERA_MAX_RESOLUTION: "camera.maxResolution",
  CAMERA_DEVICE_ID: "camera.deviceId",

  FOTOCOPY_WA_NUMBER: "fotocopy.waNumber",
  FOTOCOPY_MESSAGE_TEMPLATE: "fotocopy.messageTemplate",

  PRINT_ACTIVE_PAPER: "print.activePaper",
  PRINT_MIN_DPI_WARN: "print.minDpiWarn",
  KIOSK_FILTER_BY_ACTIVE_PAPER: "kiosk.filterByActivePaper",

  COST_PER_STRIP: "cost.perStrip",
  COST_FIXED: "cost.fixed",

  SPLASH_VIDEO_PATH: "splash.videoPath",

  SHOTS_COUNT: "shots.count",
  COUNTDOWN_SEC: "countdown.sec",
  RETAKE_MAX: "retake.max",
  PAYMENT_TIMEOUT_SEC: "payment.timeoutSec",
  KIOSK_IDLE_CANCEL_SEC: "kiosk.idleCancelSec",
  KIOSK_AUTO_RESET_SEC: "kiosk.autoResetSec",

  KIOSK_API_KEY: "kiosk.apiKey",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Nilai default (dipakai bila baris belum ada di database). */
export const DEFAULT_SETTINGS: Record<string, string> = {
  [SETTING_KEYS.EVENT_STATUS]: "CLOSED",
  [SETTING_KEYS.EVENT_GAP_HOURS]: "4",
  [SETTING_KEYS.SOFTCOPY_MAX_HOURS]: "12",

  [SETTING_KEYS.TUNNEL_MODE]: "QUICK",

  [SETTING_KEYS.PRICING_PACKAGES]: JSON.stringify(DEFAULT_PACKAGES),

  [SETTING_KEYS.CAMERA_SOURCE]: "REAL_CAMERA",
  [SETTING_KEYS.CAMERA_MAX_RESOLUTION]: "FULL_HD",

  [SETTING_KEYS.FOTOCOPY_MESSAGE_TEMPLATE]:
    "Halo, tolong cetak foto berikut ({code}, {strips} strip, kertas {paper}). Terima kasih!",

  [SETTING_KEYS.PRINT_ACTIVE_PAPER]: "4R",
  [SETTING_KEYS.PRINT_MIN_DPI_WARN]: "150",
  [SETTING_KEYS.KIOSK_FILTER_BY_ACTIVE_PAPER]: "false",

  [SETTING_KEYS.SPLASH_VIDEO_PATH]: "storage/splash/splash.mp4",

  [SETTING_KEYS.SHOTS_COUNT]: "6",
  [SETTING_KEYS.COUNTDOWN_SEC]: "3",
  [SETTING_KEYS.RETAKE_MAX]: "3",
  [SETTING_KEYS.PAYMENT_TIMEOUT_SEC]: "300",
  [SETTING_KEYS.KIOSK_IDLE_CANCEL_SEC]: "90",
  [SETTING_KEYS.KIOSK_AUTO_RESET_SEC]: "10",
};

/** Ambil satu nilai Setting (fallback ke default bila belum ada). */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (row) return row.value;
  return DEFAULT_SETTINGS[key] ?? null;
}

/** Ambil banyak nilai Setting sekaligus. */
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) result[row.key] = row.value;
  return result;
}

/** Tulis satu nilai Setting (upsert). */
export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Tulis banyak nilai Setting sekaligus. */
export async function setSettings(entries: Record<string, string>): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  );
}

/** Daftar paket harga aktif (dapat diubah operator). */
export async function getPackages(): Promise<PackageOption[]> {
  const raw = await getSetting(SETTING_KEYS.PRICING_PACKAGES);
  if (!raw) return DEFAULT_PACKAGES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PACKAGES;
    const cleaned = parsed
      .filter(
        (p): p is PackageOption =>
          p && Number.isInteger(p.strips) && p.strips >= 1 && p.strips <= 10 &&
          Number.isInteger(p.price) && p.price > 0
      )
      .sort((a, b) => a.strips - b.strips);
    return cleaned.length ? cleaned : DEFAULT_PACKAGES;
  } catch {
    return DEFAULT_PACKAGES;
  }
}

/** Harga untuk jumlah strip tertentu, atau null bila paket tidak dikenal. */
export async function getPackagePrice(strips: number): Promise<number | null> {
  const packages = await getPackages();
  return packages.find((p) => p.strips === strips)?.price ?? null;
}
