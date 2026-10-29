import { NextResponse } from "next/server";
import { requireKiosk } from "@/lib/kiosk-api";
import { buildKioskStatus, KIOSK_TRANSACTION_INCLUDE } from "@/lib/kiosk-payload";
import { prisma } from "@/lib/prisma";
import { getActiveTransaction } from "@/lib/transaction-service";

/** GET /api/kiosk/active — pemulihan: transaksi aktif milik kiosk (§7.9). */
export async function GET(request: Request) {
  const guard = await requireKiosk(request);
  if (guard) return guard;

  const active = await getActiveTransaction();
  if (!active) {
    return NextResponse.json({ transaction: null });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: active.id },
    include: KIOSK_TRANSACTION_INCLUDE,
  });
  if (!transaction) {
    return NextResponse.json({ transaction: null });
  }

  return NextResponse.json({ transaction: buildKioskStatus(transaction) });
}
