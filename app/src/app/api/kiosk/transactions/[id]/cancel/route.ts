import { NextResponse } from "next/server";
import { fromService, requireKiosk } from "@/lib/kiosk-api";
import { cancelByKiosk } from "@/lib/transaction-service";

/**
 * POST /api/kiosk/transactions/[id]/cancel — T8 idle 90 detik (§7.3).
 * Server hanya menerima bila status `PENDING` dan `totalAmount = 0`.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const { id } = await ctx.params;
  const result = await cancelByKiosk(id);
  if (!result.ok) return fromService(result);
  return NextResponse.json({
    status: result.data.status,
    cancelReason: result.data.cancelReason,
  });
}
