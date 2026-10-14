import { NextResponse } from "next/server";
import { transactions } from "@/lib/store";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trx = transactions.get(id);

  if (!trx) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  if (trx.status !== "PENDING") {
    return NextResponse.json(
      { error: `Status sudah ${trx.status}, tidak bisa dibatalkan` },
      { status: 409 }
    );
  }

  trx.status = "CANCELLED";

  return NextResponse.json(trx);
}
