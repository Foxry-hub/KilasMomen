/**
 * Query antrean operator (§6.1) — item aktif + riwayat terbaru.
 */
import { prisma } from "./prisma";
import { TRANSACTION_STATUS } from "./constants";
import type { ProcessingStage, QueueItem, QueuePayload } from "./operator-types";

export type { ProcessingStage, QueueItem, QueuePayload };

const include = {
  session: {
    include: {
      photos: { select: { shotIndex: true }, orderBy: { shotIndex: "asc" } },
      frame: {
        select: { id: true, name: true, slotCount: true, canvasWidth: true, canvasHeight: true },
      },
    },
  },
} as const;

type Row = Awaited<ReturnType<typeof fetchRows>>[number];

function fetchRows() {
  return prisma.transaction.findMany({
    include,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

export function deriveStage(row: Row): ProcessingStage | null {
  const session = row.session;
  if (!session) return null;
  if (!session.frameId) return "FRAME";
  if (session.photos.length < 6) return "PHOTO";
  if (!session.finalImagePath) return "REVIEW";
  return "READY";
}

export function toQueueItem(row: Row, maxHours: number): QueueItem {
  const now = Date.now();
  const ageMs = now - row.createdAt.getTime();
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    totalAmount: row.totalAmount,
    packageStripsCount: row.packageStripsCount,
    paymentMethod: row.paymentMethod,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    cancelReason: row.cancelReason,
    remainingMs:
      row.status === TRANSACTION_STATUS.PENDING
        ? Math.max(0, row.expiresAt.getTime() - now)
        : null,
    stage: deriveStage(row),
    sessionId: row.session?.id ?? null,
    frameId: row.session?.frameId ?? null,
    frameName: row.session?.frame?.name ?? null,
    photoCount: row.session?.photos.length ?? 0,
    hasFinal: Boolean(row.session?.finalImagePath),
    stale: row.status === TRANSACTION_STATUS.PROCESSING && maxHours > 0 && ageMs > maxHours * 3_600_000,
  };
}

const ACTIVE: string[] = [
  TRANSACTION_STATUS.PENDING,
  TRANSACTION_STATUS.PAID,
  TRANSACTION_STATUS.PROCESSING,
];
const STATUS_ORDER: Record<string, number> = { PENDING: 0, PROCESSING: 1, PAID: 2 };

export async function listQueue(maxHours: number): Promise<QueuePayload> {
  const rows = await fetchRows();
  const active: QueueItem[] = [];
  const recent: QueueItem[] = [];
  let completed = 0;
  let cancelled = 0;

  for (const row of rows) {
    if (ACTIVE.includes(row.status)) {
      active.push(toQueueItem(row, maxHours));
    } else {
      recent.push(toQueueItem(row, maxHours));
      if (row.status === TRANSACTION_STATUS.COMPLETED) completed++;
      if (row.status === TRANSACTION_STATUS.CANCELLED) cancelled++;
    }
  }

  active.sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
      b.createdAt.localeCompare(a.createdAt)
  );

  return {
    active,
    recent: recent.slice(0, 50),
    counts: { active: active.length, completed, cancelled },
  };
}
