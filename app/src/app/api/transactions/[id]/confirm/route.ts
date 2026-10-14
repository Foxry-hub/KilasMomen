import { NextResponse } from "next/server";
import { transactions } from "@/lib/store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trx = transactions.get(id);

  if (!trx) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  // Check expired
  if (new Date(trx.expiresAt) < new Date()) {
    trx.status = "EXPIRED";
    return NextResponse.json(
      { error: "Transaksi sudah kedaluwarsa" },
      { status: 409 }
    );
  }

  // Only PENDING can be confirmed
  if (trx.status !== "PENDING") {
    return NextResponse.json(
      { error: `Status transaksi sudah ${trx.status}, tidak bisa dikonfirmasi` },
      { status: 409 }
    );
  }

  // Read optional paymentMethod from body
  let paymentMethod = "QRIS";
  try {
    const body = await request.json();
    if (body.paymentMethod) {
      paymentMethod = body.paymentMethod;
    }
  } catch {
    // If no body, default to QRIS
  }

  // Update to PAID
  trx.status = "PAID";
  trx.paymentMethod = paymentMethod;
  trx.confirmedAt = new Date().toISOString();

  // Generate a mock session ID
  const sessionId =
    "ses_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 8);

  return NextResponse.json({
    ...trx,
    sessionId,
  });
}
