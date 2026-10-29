/**
 * TransactionService — mesin status 5 state (T1–T8, §5).
 * Semua transisi memakai update bersyarat (`updateMany`) agar idempoten dan bebas race condition.
 */
import { randomBytes } from "crypto";
import type { Transaction } from "@prisma/client";
import { prisma } from "./prisma";
import {
  CANCEL_REASON,
  TRANSACTION_STATUS,
  TRANSACTION_TIMEOUT_MS,
  type PaymentMethod,
} from "./constants";
import { getPackagePrice } from "./settings";
import { ensureEventOpen, touchEvent } from "./event-window";
import { publish } from "./events";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; httpStatus: number; error: string; status?: string };

function conflict(status: string, error: string): ServiceResult<never> {
  return { ok: false, httpStatus: 409, error, status };
}

/** Token acak untuk URL soft copy (bukan kode berurutan, §8.3 G1). */
export function generatePublicToken(): string {
  return randomBytes(24).toString("base64url");
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, "0");
}

/** Kode invoice harian `INV-YYYYMMDD-XXXX`. */
async function generateDailyCode(): Promise<string> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  const count = await prisma.transaction.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  });
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}`;
  return `INV-${dateStr}-${pad(count + 1, 4)}`;
}

async function loadOrFail(id: string): Promise<Transaction | null> {
  return prisma.transaction.findUnique({ where: { id } });
}

/* ------------------------------------------------------------------ T1 */

/** T1: buat transaksi PENDING. Membuka Jendela Event bila belum ada. */
export async function createPendingTransaction(): Promise<ServiceResult<Transaction>> {
  await ensureEventOpen();
  const now = new Date();
  const code = await generateDailyCode();
  const transaction = await prisma.transaction.create({
    data: {
      code,
      publicToken: generatePublicToken(),
      status: TRANSACTION_STATUS.PENDING,
      totalAmount: 0,
      packageStripsCount: 1,
      expiresAt: new Date(now.getTime() + TRANSACTION_TIMEOUT_MS),
    },
  });
  publish("transaction", { action: "created", id: transaction.id, code: transaction.code });
  return { ok: true, data: transaction };
}

/* --------------------------------------------------------------- Paket */

/** Set paket (hanya saat PENDING). Harga dihitung server. */
export async function setPackage(
  id: string,
  strips: number
): Promise<ServiceResult<Transaction>> {
  const price = await getPackagePrice(strips);
  if (price === null) {
    return { ok: false, httpStatus: 400, error: "Paket tidak dikenal" };
  }

  const updated = await prisma.transaction.updateMany({
    where: { id, status: TRANSACTION_STATUS.PENDING },
    data: { packageStripsCount: strips, totalAmount: price },
  });
  if (updated.count === 0) {
    const current = await loadOrFail(id);
    if (!current) return { ok: false, httpStatus: 404, error: "Transaksi tidak ditemukan" };
    return conflict(current.status, "Paket hanya dapat diubah saat menunggu bayar");
  }

  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  publish("transaction", { action: "package-set", id, strips, totalAmount: price });
  return { ok: true, data: transaction };
}

/* ------------------------------------------------------------------ T2 */

/** T2: operator konfirmasi bayar PENDING → PAID. */
export async function confirmPayment(
  id: string,
  method: PaymentMethod
): Promise<ServiceResult<Transaction>> {
  const now = new Date();
  const updated = await prisma.transaction.updateMany({
    where: {
      id,
      status: TRANSACTION_STATUS.PENDING,
      expiresAt: { gt: now },
      totalAmount: { gt: 0 },
    },
    data: {
      status: TRANSACTION_STATUS.PAID,
      paymentMethod: method,
      paidAt: now,
    },
  });

  if (updated.count === 0) {
    const current = await loadOrFail(id);
    if (!current) return { ok: false, httpStatus: 404, error: "Transaksi tidak ditemukan" };

    // Transaksi tepat kedaluwarsa: bawa ke CANCELLED(TIMEOUT) agar konsisten dengan sweeper.
    if (current.status === TRANSACTION_STATUS.PENDING && current.expiresAt <= now) {
      await prisma.transaction.updateMany({
        where: { id, status: TRANSACTION_STATUS.PENDING, expiresAt: { lte: now } },
        data: {
          status: TRANSACTION_STATUS.CANCELLED,
          cancelReason: CANCEL_REASON.TIMEOUT,
          cancelledAt: now,
        },
      });
      publish("transaction", { action: "timeout", id });
      return conflict(TRANSACTION_STATUS.CANCELLED, "Waktu pembayaran habis");
    }
    if (current.status === TRANSACTION_STATUS.PENDING && current.totalAmount === 0) {
      return { ok: false, httpStatus: 400, error: "Paket belum dipilih" };
    }
    return conflict(current.status, "Konfirmasi tidak dapat dilakukan");
  }

  await touchEvent();
  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  publish("transaction", { action: "paid", id, method });
  return { ok: true, data: transaction };
}

/* ------------------------------------------------------------------ T3 */

/** T3: PAID → PROCESSING + buat PhotoSession (idempoten). */
export async function startProcessing(
  id: string
): Promise<ServiceResult<{ sessionId: string }>> {
  const now = new Date();
  const current = await prisma.transaction.findUnique({
    where: { id },
    include: { session: true },
  });
  if (!current) return { ok: false, httpStatus: 404, error: "Transaksi tidak ditemukan" };

  if (current.status === TRANSACTION_STATUS.CANCELLED) {
    return conflict(TRANSACTION_STATUS.CANCELLED, "Transaksi sudah dibatalkan");
  }
  if (current.status === TRANSACTION_STATUS.COMPLETED) {
    return conflict(TRANSACTION_STATUS.COMPLETED, "Transaksi sudah selesai");
  }
  if (current.status === TRANSACTION_STATUS.PROCESSING && current.session) {
    return { ok: true, data: { sessionId: current.session.id } };
  }
  if (current.status === TRANSACTION_STATUS.PENDING) {
    return conflict(TRANSACTION_STATUS.PENDING, "Pembayaran belum dikonfirmasi");
  }

  await prisma.transaction.updateMany({
    where: { id, status: TRANSACTION_STATUS.PAID },
    data: { status: TRANSACTION_STATUS.PROCESSING, processingAt: now },
  });

  const session = await prisma.photoSession.upsert({
    where: { transactionId: id },
    update: {},
    create: { transactionId: id },
  });

  publish("transaction", { action: "processing", id });
  publish("session", { action: "started", sessionId: session.id });
  return { ok: true, data: { sessionId: session.id } };
}

/* ------------------------------------------------------------------ T4 */

/** T4: PROCESSING → COMPLETED. */
export async function completeTransaction(
  id: string
): Promise<ServiceResult<Transaction>> {
  const now = new Date();
  const updated = await prisma.transaction.updateMany({
    where: { id, status: TRANSACTION_STATUS.PROCESSING },
    data: { status: TRANSACTION_STATUS.COMPLETED, completedAt: now },
  });
  if (updated.count === 0) {
    const current = await loadOrFail(id);
    if (!current) return { ok: false, httpStatus: 404, error: "Transaksi tidak ditemukan" };
    return conflict(current.status, "Transaksi belum dalam tahap diproses");
  }

  await touchEvent();
  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  publish("transaction", { action: "completed", id });
  return { ok: true, data: transaction };
}

/* --------------------------------------------------------------- T6/T7 */

/** T6/T7: pembatalan oleh operator (opsional setelah bayar = hangus). */
export async function cancelByOperator(
  id: string,
  afterPayment: boolean
): Promise<ServiceResult<Transaction>> {
  const now = new Date();
  const where = afterPayment
    ? { id, status: { in: [TRANSACTION_STATUS.PAID, TRANSACTION_STATUS.PROCESSING] } }
    : { id, status: TRANSACTION_STATUS.PENDING };

  const updated = await prisma.transaction.updateMany({
    where,
    data: {
      status: TRANSACTION_STATUS.CANCELLED,
      cancelReason: afterPayment ? CANCEL_REASON.OPERATOR_AFTER_PAYMENT : CANCEL_REASON.OPERATOR,
      cancelledAt: now,
    },
  });
  if (updated.count === 0) {
    const current = await loadOrFail(id);
    if (!current) return { ok: false, httpStatus: 404, error: "Transaksi tidak ditemukan" };
    return conflict(current.status, "Pembatalan tidak dapat dilakukan pada status ini");
  }

  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  publish("transaction", { action: afterPayment ? "voided" : "cancelled", id });
  return { ok: true, data: transaction };
}

/* ------------------------------------------------------------------ T8 */

/** T8: pembatalan oleh kios (idle 90 detik). Hanya PENDING tanpa paket terpilih. */
export async function cancelByKiosk(id: string): Promise<ServiceResult<Transaction>> {
  const now = new Date();
  const updated = await prisma.transaction.updateMany({
    where: { id, status: TRANSACTION_STATUS.PENDING, totalAmount: 0 },
    data: {
      status: TRANSACTION_STATUS.CANCELLED,
      cancelReason: CANCEL_REASON.KIOSK_IDLE,
      cancelledAt: now,
    },
  });
  if (updated.count === 0) {
    const current = await loadOrFail(id);
    if (!current) return { ok: false, httpStatus: 404, error: "Transaksi tidak ditemukan" };
    return conflict(current.status, "Tidak dapat dibatalkan oleh kios");
  }

  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  publish("transaction", { action: "idle-cancelled", id });
  return { ok: true, data: transaction };
}

/* ------------------------------------------------------------------ T5 */

/** T5: sweeper — PENDING kedaluwarsa → CANCELLED(TIMEOUT). Kembalikan jumlah yang diubah. */
export async function sweepExpiredTransactions(now: Date = new Date()): Promise<number> {
  const result = await prisma.transaction.updateMany({
    where: { status: TRANSACTION_STATUS.PENDING, expiresAt: { lte: now } },
    data: {
      status: TRANSACTION_STATUS.CANCELLED,
      cancelReason: CANCEL_REASON.TIMEOUT,
      cancelledAt: now,
    },
  });
  if (result.count > 0) {
    publish("transaction", { action: "swept", count: result.count });
  }
  return result.count;
}

/* ------------------------------------------------------- Query kios/operator */

/** Transaksi aktif terbaru untuk pemulihan kios (§7.9). */
export async function getActiveTransaction(): Promise<Transaction | null> {
  return prisma.transaction.findFirst({
    where: {
      status: {
        in: [TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.PAID, TRANSACTION_STATUS.PROCESSING],
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Ringkasan status untuk polling kios. */
export function toStatusPayload(transaction: Transaction) {
  return {
    id: transaction.id,
    code: transaction.code,
    status: transaction.status,
    totalAmount: transaction.totalAmount,
    packageStripsCount: transaction.packageStripsCount,
    paymentMethod: transaction.paymentMethod,
    expiresAt: transaction.expiresAt,
    serverTime: new Date().toISOString(),
  };
}
