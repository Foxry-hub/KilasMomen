import { NextResponse } from "next/server";
import { badRequest, fromService, requireOperator } from "@/lib/operator-api";
import { confirmPayment } from "@/lib/transaction-service";
import { paymentMethodSchema } from "@/lib/constants";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireOperator();
  if (guard) return guard;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { paymentMethod?: unknown };
  const parsed = paymentMethodSchema.safeParse(body.paymentMethod);
  if (!parsed.success) return badRequest("Metode pembayaran tidak valid");

  const result = await confirmPayment(id, parsed.data);
  return fromService(result);
}
