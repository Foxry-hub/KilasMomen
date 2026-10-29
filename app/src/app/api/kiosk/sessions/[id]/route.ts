import { NextResponse } from "next/server";
import { notFound, requireKiosk } from "@/lib/kiosk-api";
import { buildKioskStatus, KIOSK_TRANSACTION_INCLUDE } from "@/lib/kiosk-payload";
import { prisma } from "@/lib/prisma";

/** GET /api/kiosk/sessions/[id] — state sesi + transaksi untuk pemulihan & polling (§7.9). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireKiosk(_request);
  if (guard) return guard;

  const { id } = await ctx.params;
  const session = await prisma.photoSession.findUnique({ where: { id } });
  if (!session) return notFound("Sesi tidak ditemukan");

  const transaction = await prisma.transaction.findUnique({
    where: { id: session.transactionId },
    include: KIOSK_TRANSACTION_INCLUDE,
  });
  if (!transaction) return notFound("Transaksi tidak ditemukan");

  return NextResponse.json(buildKioskStatus(transaction));
}
