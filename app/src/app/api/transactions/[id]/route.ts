import { NextResponse } from "next/server";
import { transactions } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trx = transactions.get(id);

  if (!trx) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  // Auto-expire check
  if (trx.status === "PENDING" && new Date(trx.expiresAt) < new Date()) {
    trx.status = "EXPIRED";
  }

  return NextResponse.json(trx);
}
