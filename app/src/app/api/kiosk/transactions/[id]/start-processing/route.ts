import { NextResponse } from "next/server";
import { fromService, requireKiosk } from "@/lib/kiosk-api";
import { startProcessing } from "@/lib/transaction-service";

/** POST /api/kiosk/transactions/[id]/start-processing — T3 PAID→PROCESSING + PhotoSession (§7.4). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const { id } = await ctx.params;
  const result = await startProcessing(id);
  if (!result.ok) return fromService(result);
  return NextResponse.json(result.data);
}
