import { NextResponse } from "next/server";
import { notFound, requireKiosk } from "@/lib/kiosk-api";
import { buildKioskStatus, KIOSK_TRANSACTION_INCLUDE } from "@/lib/kiosk-payload";
import { prisma } from "@/lib/prisma";

/** GET /api/kiosk/transactions/[id]/status — polling 2 detik (§7.3, §7.10). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(_request);
  if (guard) return guard;

  const { id } = await ctx.params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: KIOSK_TRANSACTION_INCLUDE,
  });
  if (!transaction) return notFound("Transaksi tidak ditemukan");

  return NextResponse.json(buildKioskStatus(transaction));
}
