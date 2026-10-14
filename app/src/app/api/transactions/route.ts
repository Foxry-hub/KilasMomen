import { NextResponse } from "next/server";
import {
  generateTransactionId,
} from "@/lib/store";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const id = generateTransactionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 60 * 1000); // 3 minutes
  const count = await prisma.transaction.count();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const transaction = await prisma.transaction.create({
    data: {
      id,
      code: `TRX-${dateStr}-${String(count + 1).padStart(4, "0")}`,
      amount: 25000,
      expiresAt,
    },
  });

  return NextResponse.json(transaction, { status: 201 });
}
