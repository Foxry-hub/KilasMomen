import { NextResponse } from "next/server";
import {
  transactions,
  generateTransactionId,
  generateTransactionCode,
  type Transaction,
} from "@/lib/store";

export { transactions };

export async function POST() {
  const id = generateTransactionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 60 * 1000); // 3 minutes

  const transaction: Transaction = {
    id,
    code: generateTransactionCode(),
    amount: 25000,
    paymentMethod: null,
    status: "PENDING",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    confirmedAt: null,
  };

  transactions.set(id, transaction);

  return NextResponse.json(transaction, { status: 201 });
}
