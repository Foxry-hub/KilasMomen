/**
 * Hook startup Next.js. Menjalankan sweeper transaksi kedaluwarsa (§12.1 F0).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSweeper } = await import("./lib/sweeper");
    startSweeper();
  }
}
