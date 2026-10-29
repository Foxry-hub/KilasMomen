/**
 * Riwayat dan rekap (§6.7.2).
 */
import { prisma } from "./prisma";
import { CANCEL_REASON, TRANSACTION_STATUS } from "./constants";
import { SETTING_KEYS, getSettings } from "./settings";

export interface HistoryFilters {
  from?: Date;
  to?: Date;
  status?: string;
  method?: string;
  q?: string;
}

function buildWhere(filters: HistoryFilters) {
  const where: Record<string, unknown> = {};
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.status) where.status = filters.status;
  if (filters.method) where.paymentMethod = filters.method;
  if (filters.q) where.code = { contains: filters.q };
  return where;
}

export async function listHistory(filters: HistoryFilters) {
  return prisma.transaction.findMany({
    where: buildWhere(filters),
    include: { session: { select: { id: true, finalImagePath: true, frameId: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
}

export interface RecapByKey {
  key: string;
  count: number;
  amount: number;
}

export interface Recap {
  income: number;
  orders: number;
  byMethod: RecapByKey[];
  byPackage: RecapByKey[];
  totalPrints: number;
  cancelledBeforePaid: { total: number; TIMEOUT: number; KIOSK_IDLE: number; OPERATOR: number };
  voided: { count: number; amount: number };
  avgSessionMs: number | null;
  profitEstimate: number | null;
  costPerStrip: number | null;
  costFixed: number | null;
}

export async function computeRecap(filters: HistoryFilters): Promise<Recap> {
  const rows = await prisma.transaction.findMany({ where: buildWhere(filters) });
  const settings = await getSettings();

  let income = 0;
  let orders = 0;
  let totalPrints = 0;
  let durationSum = 0;
  let durationCount = 0;
  const byMethod = new Map<string, RecapByKey>();
  const byPackage = new Map<string, RecapByKey>();
  const cancelledBeforePaid = { total: 0, TIMEOUT: 0, KIOSK_IDLE: 0, OPERATOR: 0 };
  const voided = { count: 0, amount: 0 };

  for (const row of rows) {
    const paid = row.paidAt !== null;
    if (paid) {
      income += row.totalAmount;
      orders++;
      const mKey = row.paymentMethod ?? "UNKNOWN";
      const m = byMethod.get(mKey) ?? { key: mKey, count: 0, amount: 0 };
      m.count++;
      m.amount += row.totalAmount;
      byMethod.set(mKey, m);

      const pKey = String(row.packageStripsCount);
      const p = byPackage.get(pKey) ?? { key: pKey, count: 0, amount: 0 };
      p.count++;
      p.amount += row.totalAmount;
      byPackage.set(pKey, p);
    }

    if (row.status === TRANSACTION_STATUS.COMPLETED) {
      totalPrints += row.packageStripsCount;
      if (row.paidAt && row.completedAt) {
        durationSum += row.completedAt.getTime() - row.paidAt.getTime();
        durationCount++;
      }
    }

    if (row.status === TRANSACTION_STATUS.CANCELLED) {
      if (row.cancelReason === CANCEL_REASON.OPERATOR_AFTER_PAYMENT) {
        voided.count++;
        voided.amount += row.totalAmount;
      } else if (!paid) {
        cancelledBeforePaid.total++;
        if (row.cancelReason === CANCEL_REASON.TIMEOUT) cancelledBeforePaid.TIMEOUT++;
        else if (row.cancelReason === CANCEL_REASON.KIOSK_IDLE) cancelledBeforePaid.KIOSK_IDLE++;
        else cancelledBeforePaid.OPERATOR++;
      }
    }
  }

  const perStripRaw = settings[SETTING_KEYS.COST_PER_STRIP];
  const fixedRaw = settings[SETTING_KEYS.COST_FIXED];
  const costPerStrip = perStripRaw ? Number(perStripRaw) : null;
  const costFixed = fixedRaw ? Number(fixedRaw) : null;
  const profitEstimate =
    costPerStrip !== null && Number.isFinite(costPerStrip)
      ? income - totalPrints * costPerStrip - (costFixed ?? 0)
      : null;

  return {
    income,
    orders,
    byMethod: [...byMethod.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byPackage: [...byPackage.values()].sort((a, b) => Number(a.key) - Number(b.key)),
    totalPrints,
    cancelledBeforePaid,
    voided,
    avgSessionMs: durationCount ? Math.round(durationSum / durationCount) : null,
    profitEstimate,
    costPerStrip,
    costFixed,
  };
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recapToCsv(
  rows: Awaited<ReturnType<typeof listHistory>>
): string {
  const header = [
    "Kode",
    "Dibuat",
    "Status",
    "Metode",
    "Jumlah Strip",
    "Total",
    "Dibayar",
    "Alasan Batal",
    "Selesai",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.code),
        csvCell(row.createdAt.toISOString()),
        csvCell(row.status),
        csvCell(row.paymentMethod),
        csvCell(row.packageStripsCount),
        csvCell(row.totalAmount),
        csvCell(row.paidAt?.toISOString() ?? null),
        csvCell(row.cancelReason),
        csvCell(row.completedAt?.toISOString() ?? null),
      ].join(",")
    );
  }
  // BOM agar Excel membaca UTF-8 dengan benar.
  return `\uFEFF${lines.join("\r\n")}`;
}
