import { NextResponse } from "next/server";
import { requireKiosk } from "@/lib/kiosk-api";
import { buildKioskStatus, KIOSK_TRANSACTION_INCLUDE } from "@/lib/kiosk-payload";
import { prisma } from "@/lib/prisma";
import { createPendingTransaction, getActiveTransaction } from "@/lib/transaction-service";

async function loadStatus(id: string) {
  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id },
    include: KIOSK_TRANSACTION_INCLUDE,
  });
  return buildKioskStatus(transaction);
}

/**
 * POST /api/kiosk/transactions — "Sentuh untuk Mulai" (§7.2).
 * Satu transaksi aktif per kiosk: bila sudah ada, kembalikan yang aktif (pemulihan §7.9).
 */
export async function POST(request: Request) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const existing = await getActiveTransaction();
  if (existing) {
    return NextResponse.json({ ...(await loadStatus(existing.id)), reused: true });
  }

  const result = await createPendingTransaction();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, status: result.status },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(
    { ...(await loadStatus(result.data.id)), reused: false },
    { status: 201 }
  );
}
