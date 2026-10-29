/**
 * Sweeper transaksi PENDING yang kedaluwarsa (§5.4 T5) dan shutdown halus (§6.7.1).
 * Dijalankan sekali saat server start dari `instrumentation.ts`.
 */
import { prisma } from "./prisma";
import { sweepExpiredTransactions } from "./transaction-service";

const SWEEP_INTERVAL_MS = 5000;

const globalForSweeper = globalThis as unknown as {
  __happyClickSweeper?: ReturnType<typeof setInterval>;
  __happyClickShutdownHooked?: boolean;
};

async function sweep(): Promise<void> {
  try {
    await sweepExpiredTransactions();
  } catch (error) {
    console.error("Sweeper failed:", error);
  }
}

/** Checkpoint WAL sebelum keluar agar database rapi (§6.7.1). */
async function gracefulShutdown(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch (error) {
    console.warn("WAL checkpoint on shutdown failed:", error);
  }
}

export function startSweeper(): void {
  if (globalForSweeper.__happyClickSweeper) return;

  void sweep();
  globalForSweeper.__happyClickSweeper = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  // Interval tidak boleh menahan proses tetap hidup.
  globalForSweeper.__happyClickSweeper.unref?.();

  if (!globalForSweeper.__happyClickShutdownHooked) {
    globalForSweeper.__happyClickShutdownHooked = true;
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      process.on(signal, () => {
        void gracefulShutdown().finally(() => process.exit(0));
      });
    }
  }
}
