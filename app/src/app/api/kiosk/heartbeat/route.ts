import { NextResponse } from "next/server";
import { verifyKioskRequest } from "@/lib/auth";
import { recordHeartbeat, type KioskDeviceInfo } from "@/lib/kiosk-state";
import { publish } from "@/lib/events";

interface HeartbeatBody {
  devices?: KioskDeviceInfo[];
  activeScreen?: string | null;
  cameraStatus?: string;
}

/** POST /api/kiosk/heartbeat — daftar perangkat video, layar aktif, status kamera (§9). */
export async function POST(request: Request) {
  if (!(await verifyKioskRequest(request))) {
    return NextResponse.json({ error: "Akses kios ditolak" }, { status: 403 });
  }

  let body: HeartbeatBody = {};
  try {
    body = (await request.json()) as HeartbeatBody;
  } catch {
    body = {};
  }

  const heartbeat = recordHeartbeat({
    devices: Array.isArray(body.devices) ? body.devices : undefined,
    activeScreen: body.activeScreen ?? null,
    cameraStatus: body.cameraStatus,
  });

  publish("kiosk", { action: "heartbeat", ...heartbeat });
  return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
}
