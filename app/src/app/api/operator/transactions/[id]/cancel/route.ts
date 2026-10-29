import { NextResponse } from "next/server";
import { badRequest, conflict, fromService, notFound, requireOperator } from "@/lib/operator-api";
import { cancelByOperator } from "@/lib/transaction-service";
import { prisma } from "@/lib/prisma";
import { TRANSACTION_STATUS } from "@/lib/constants";

/**
 * T6/T7. Bila status `PAID`/`PROCESSING` wajib `afterPayment: true`
 * (konfirmasi hangus, Q19).
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireOperator();
  if (guard) return guard;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { afterPayment?: unknown };

  const current = await prisma.transaction.findUnique({ where: { id } });
  if (!current) return notFound("Transaksi tidak ditemukan");

  if (current.status === TRANSACTION_STATUS.PENDING) {
    return fromService(await cancelByOperator(id, false));
  }

  if (
    current.status === TRANSACTION_STATUS.PAID ||
    current.status === TRANSACTION_STATUS.PROCESSING
  ) {
    if (body.afterPayment !== true) {
      return badRequest("Pembayaran akan hangus. Konfirmasi diperlukan.");
    }
    return fromService(await cancelByOperator(id, true));
  }

  return conflict(current.status);
}
