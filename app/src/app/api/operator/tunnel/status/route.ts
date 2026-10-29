import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/operator-api";
import { getTunnelStatus } from "@/lib/tunnel";

/** `{ mode, online, publicBaseUrl }` untuk lencana tunnel (§9). */
export async function GET() {
  const guard = await requireOperator();
  if (guard) return guard;
  return NextResponse.json(await getTunnelStatus());
}
