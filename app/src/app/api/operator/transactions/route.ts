/**
 * Daftar transaksi operator (§9). Payload antrean + riwayat (§6.1).
 */
import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/operator-api";
import { listQueue } from "@/lib/operator-queue";
import { getEventInfo } from "@/lib/event-window";

export async function GET() {
  const guard = await requireOperator();
  if (guard) return guard;

  const info = await getEventInfo();
  const payload = await listQueue(info.maxHours);
  return NextResponse.json(payload);
}
