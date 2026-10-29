import { NextResponse } from "next/server";
import { badRequest, requireOperator } from "@/lib/operator-api";
import { SETTING_KEYS, getSettings, setSettings } from "@/lib/settings";
import { publish } from "@/lib/events";
import { hashPin } from "@/lib/auth";
import { normalizePhone } from "@/lib/session-output";
import { isKnownPaper } from "@/features/frames/frame.config";
import type { PackageOption } from "@/lib/constants";

/** Kunci yang boleh diubah operator lewat UI (§6.5). */
const EDITABLE_KEYS = new Set<string>([
  SETTING_KEYS.PUBLIC_BASE_URL,
  SETTING_KEYS.TUNNEL_MODE,
  SETTING_KEYS.QRIS_IMAGE_PATH,
  SETTING_KEYS.SPLASH_VIDEO_PATH,
  SETTING_KEYS.CAMERA_SOURCE,
  SETTING_KEYS.CAMERA_DEVICE_LABEL,
  SETTING_KEYS.CAMERA_MAX_RESOLUTION,
  SETTING_KEYS.CAMERA_DEVICE_ID,
  SETTING_KEYS.FOTOCOPY_WA_NUMBER,
  SETTING_KEYS.FOTOCOPY_MESSAGE_TEMPLATE,
  SETTING_KEYS.PRINT_ACTIVE_PAPER,
  SETTING_KEYS.PRINT_MIN_DPI_WARN,
  SETTING_KEYS.KIOSK_FILTER_BY_ACTIVE_PAPER,
  SETTING_KEYS.COST_PER_STRIP,
  SETTING_KEYS.COST_FIXED,
  SETTING_KEYS.SOFTCOPY_MAX_HOURS,
  SETTING_KEYS.EVENT_GAP_HOURS,
  SETTING_KEYS.EVENT_AUTO_CLOSE_AT,
  SETTING_KEYS.KIOSK_API_KEY,
]);

export async function GET() {
  const guard = await requireOperator();
  if (guard) return guard;

  const settings = await getSettings();
  // PIN tidak pernah dikirim ke klien.
  delete settings[SETTING_KEYS.OPERATOR_PIN_HASH];
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const guard = await requireOperator();
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as {
    settings?: Record<string, unknown>;
    packages?: unknown;
    pin?: unknown;
  };

  const updates: Record<string, string> = {};

  if (body.settings && typeof body.settings === "object") {
    for (const [key, value] of Object.entries(body.settings)) {
      if (!EDITABLE_KEYS.has(key)) continue;

      if (key === SETTING_KEYS.PUBLIC_BASE_URL) {
        const raw = String(value).trim().replace(/\/+$/, "");
        if (raw && !/^https:\/\//i.test(raw)) {
          return badRequest("URL tunnel wajib memakai https");
        }
        updates[key] = raw;
        continue;
      }

      if (key === SETTING_KEYS.PRINT_ACTIVE_PAPER) {
        const paper = String(value);
        if (!isKnownPaper(paper)) return badRequest("Kertas tidak dikenal");
        updates[key] = paper;
        continue;
      }

      if (key === SETTING_KEYS.FOTOCOPY_WA_NUMBER) {
        const raw = String(value).trim();
        if (!raw) {
          updates[key] = "";
          continue;
        }
        const normalized = normalizePhone(raw);
        if (!normalized) return badRequest("Nomor WhatsApp tidak valid");
        updates[key] = normalized;
        continue;
      }

      if (key === SETTING_KEYS.TUNNEL_MODE) {
        const mode = String(value).toUpperCase();
        if (mode !== "QUICK" && mode !== "NAMED") return badRequest("Mode tunnel tidak valid");
        updates[key] = mode;
        continue;
      }

      updates[key] = String(value);
    }
  }

  if (body.packages !== undefined) {
    if (!Array.isArray(body.packages)) return badRequest("Daftar paket tidak valid");
    const cleaned: PackageOption[] = [];
    const seen = new Set<number>();
    for (const item of body.packages) {
      const strips = Number((item as PackageOption)?.strips);
      const price = Number((item as PackageOption)?.price);
      if (!Number.isInteger(strips) || strips < 1 || strips > 10) {
        return badRequest("Jumlah strip harus bilangan bulat 1–10");
      }
      if (!Number.isInteger(price) || price <= 0) {
        return badRequest("Harga harus bilangan bulat lebih dari 0");
      }
      if (seen.has(strips)) return badRequest("Jumlah strip harus unik");
      seen.add(strips);
      cleaned.push({ strips, price });
    }
    if (!cleaned.length) return badRequest("Minimal satu paket");
    cleaned.sort((a, b) => a.strips - b.strips);
    updates[SETTING_KEYS.PRICING_PACKAGES] = JSON.stringify(cleaned);
  }

  if (body.pin !== undefined) {
    const pin = String(body.pin);
    if (!/^\d{4,6}$/.test(pin)) return badRequest("PIN harus 4–6 digit angka");
    updates[SETTING_KEYS.OPERATOR_PIN_HASH] = hashPin(pin);
  }

  if (Object.keys(updates).length === 0) return badRequest("Tidak ada perubahan");

  await setSettings(updates);

  // Notify kiosk and operator if camera settings changed (§6.3).
  const cameraKeys = [
    SETTING_KEYS.CAMERA_SOURCE,
    SETTING_KEYS.CAMERA_DEVICE_LABEL,
    SETTING_KEYS.CAMERA_DEVICE_ID,
    SETTING_KEYS.CAMERA_MAX_RESOLUTION,
  ];
  if (cameraKeys.some((k) => k in updates)) {
    publish("settings", { scope: "camera", updated: Object.keys(updates) });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(updates) });
}
