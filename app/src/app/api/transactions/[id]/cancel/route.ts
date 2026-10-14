import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trx = await prisma.transaction.findUnique({ where: { id } });

  if (!trx) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  if (trx.status !== "PENDING") {
    return NextResponse.json(
      { error: `Status sudah ${trx.status}, tidak bisa dibatalkan` },
      { status: 409 }
    );
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json(updated);
}
