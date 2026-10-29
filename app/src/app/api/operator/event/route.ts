import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/operator-api";
import { getEventInfo, hasAnyTransaction } from "@/lib/event-window";

/** Status Jendela Event (§6.6). */
export async function GET() {
  const guard = await requireOperator();
  if (guard) return guard;

  const info = await getEventInfo();
  return NextResponse.json({
    status: info.status,
    openedAt: info.openedAt?.toISOString() ?? null,
    lastActivityAt: info.lastActivityAt?.toISOString() ?? null,
    gapHours: info.gapHours,
    maxHours: info.maxHours,
    hasHistory: await hasAnyTransaction(),
  });
}
