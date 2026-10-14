import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trx = await prisma.transaction.findUnique({ where: { id } });

  if (!trx) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  // Auto-expire check
  if (trx.status === "PENDING" && new Date(trx.expiresAt) < new Date()) {
    const expired = await prisma.transaction.update({
      where: { id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json(expired);
  }

  return NextResponse.json(trx);
}
