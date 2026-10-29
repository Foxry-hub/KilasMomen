import { NextResponse } from "next/server";
import { badRequest, requireOperator } from "@/lib/operator-api";
import { SETTING_KEYS, setSetting } from "@/lib/settings";
import { getHeartbeat, isKioskOnline } from "@/lib/kiosk-state";
import { getEventInfo } from "@/lib/event-window";
import { getTunnelStatus } from "@/lib/tunnel";

/** Status kiosk, event, dan tunnel untuk header panel (§6.1, §9). */
export async function GET() {
  const guard = await requireOperator();
  if (guard) return guard;

  const [event, tunnel] = await Promise.all([getEventInfo(), getTunnelStatus()]);
  const heartbeat = getHeartbeat();

  return NextResponse.json({
    kiosk: {
      online: isKioskOnline(),
      activeScreen: heartbeat?.activeScreen ?? null,
      cameraStatus: heartbeat?.cameraStatus ?? "UNKNOWN",
      devices: heartbeat?.devices ?? [],
      updatedAt: heartbeat?.updatedAt ?? null,
    },
    event: {
      status: event.status,
      openedAt: event.openedAt?.toISOString() ?? null,
      lastActivityAt: event.lastActivityAt?.toISOString() ?? null,
      maxHours: event.maxHours,
    },
    tunnel,
  });
}

/** Bantu: simpan `publicBaseUrl` manual (cadangan deteksi otomatis). */
export async function POST(request: Request) {
  const guard = await requireOperator();
  if (guard) return guard;

  const body = (await request.json().catch(() => ({}))) as { publicBaseUrl?: unknown };
  const raw = String(body.publicBaseUrl ?? "").trim();
  if (raw && !/^https:\/\//i.test(raw)) return badRequest("URL tunnel wajib memakai https");

  await setSetting(SETTING_KEYS.PUBLIC_BASE_URL, raw.replace(/\/+$/, ""));
  return NextResponse.json({ ok: true });
}
