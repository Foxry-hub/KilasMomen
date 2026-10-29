import { NextResponse } from "next/server";
import { badRequest, fromService, requireKiosk } from "@/lib/kiosk-api";
import { setPackage, toStatusPayload } from "@/lib/transaction-service";

/** PATCH /api/kiosk/transactions/[id]/package — kunci paket, harga dihitung server (§7.3). */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const { id } = await ctx.params;
  let body: { strips?: unknown } = {};
  try {
    body = (await request.json()) as { strips?: unknown };
  } catch {
    return badRequest("Body tidak valid");
  }

  const strips = Number(body.strips);
  if (!Number.isInteger(strips) || strips < 1 || strips > 10) {
    return badRequest("Paket tidak valid");
  }

  const result = await setPackage(id, strips);
  if (!result.ok) return fromService(result);
  return NextResponse.json(toStatusPayload(result.data));
}
