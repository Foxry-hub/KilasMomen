import { NextResponse } from "next/server";
import { verifyKioskRequest } from "@/lib/auth";
import { SETTING_KEYS, getPackages, getSettings } from "@/lib/settings";

/** GET /api/kiosk/config — profil kamera, countdown, jumlah foto, kuota retake, video splash, auto reset (§9). */
export async function GET(request: Request) {
  if (!(await verifyKioskRequest(request))) {
    return NextResponse.json({ error: "Akses kios ditolak" }, { status: 403 });
  }

  const settings = await getSettings();
  const packages = await getPackages();
  const splashVideoPath = settings[SETTING_KEYS.SPLASH_VIDEO_PATH];
  const qrisImagePath = settings[SETTING_KEYS.QRIS_IMAGE_PATH];

  return NextResponse.json({
    camera: {
      source: settings[SETTING_KEYS.CAMERA_SOURCE],
      deviceLabel: settings[SETTING_KEYS.CAMERA_DEVICE_LABEL] || null,
      deviceId: settings[SETTING_KEYS.CAMERA_DEVICE_ID] || null,
      maxResolution: settings[SETTING_KEYS.CAMERA_MAX_RESOLUTION],
    },
    countdownSec: Number(settings[SETTING_KEYS.COUNTDOWN_SEC]) || 3,
    photoCount: Number(settings[SETTING_KEYS.SHOTS_COUNT]) || 6,
    retakeQuota: Number(settings[SETTING_KEYS.RETAKE_MAX]) || 3,
    autoResetSec: Number(settings[SETTING_KEYS.KIOSK_AUTO_RESET_SEC]) || 10,
    idleCancelSec: Number(settings[SETTING_KEYS.KIOSK_IDLE_CANCEL_SEC]) || 90,
    paymentTimeoutSec: Number(settings[SETTING_KEYS.PAYMENT_TIMEOUT_SEC]) || 300,
    activePaper: settings[SETTING_KEYS.PRINT_ACTIVE_PAPER],
    filterByActivePaper: settings[SETTING_KEYS.KIOSK_FILTER_BY_ACTIVE_PAPER] === "true",
    packages,
    splashVideoUrl: splashVideoPath ? "/api/media/splash/splash.mp4" : null,
    qrisImageUrl: qrisImagePath ? "/api/media/qris/qris.png" : null,
    serverTime: new Date().toISOString(),
  });
}
