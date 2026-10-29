import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/operator-api";
import { computeRecap, listHistory, recapToCsv, type HistoryFilters } from "@/lib/recap";

function parseFilters(url: URL): HistoryFilters {
  const filters: HistoryFilters = {};
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) filters.from = new Date(from);
  if (to) filters.to = new Date(`${to}T23:59:59.999`);
  const status = url.searchParams.get("status");
  if (status) filters.status = status;
  const method = url.searchParams.get("method");
  if (method) filters.method = method;
  const q = url.searchParams.get("q");
  if (q) filters.q = q;
  return filters;
}

/** Rekap pemasukan + daftar riwayat; `?format=csv` untuk ekspor (§6.7.2, §9). */
export async function GET(request: Request) {
  const guard = await requireOperator();
  if (guard) return guard;

  const url = new URL(request.url);
  const filters = parseFilters(url);

  if (url.searchParams.get("format") === "csv") {
    const rows = await listHistory(filters);
    const csv = recapToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="happy-click-riwayat.csv"`,
      },
    });
  }

  const [recap, rows] = await Promise.all([computeRecap(filters), listHistory(filters)]);
  return NextResponse.json({
    recap,
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      totalAmount: row.totalAmount,
      packageStripsCount: row.packageStripsCount,
      paymentMethod: row.paymentMethod,
      cancelReason: row.cancelReason,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      sessionId: row.session?.id ?? null,
      hasFinal: Boolean(row.session?.finalImagePath),
    })),
  });
}
