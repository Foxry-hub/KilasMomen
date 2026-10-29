"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";
import type { RecapPayload } from "@/lib/operator-types";
import { apiJson, dayStamp, rupiah } from "./utils";

const STATUS_OPTIONS = ["", "PENDING", "PAID", "PROCESSING", "COMPLETED", "CANCELLED"];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-ink bg-white p-3 shadow-brut-sm">
      <p className="font-display text-[11px] uppercase text-ink/60">{label}</p>
      <p className="font-mono text-lg">{value}</p>
    </div>
  );
}

function avgDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}m ${total % 60}s`;
}

/** Riwayat dan Rekap dengan filter + ekspor CSV (§6.7.2). */
export function HistoryPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [q, setQ] = useState("");
  const [payload, setPayload] = useState<RecapPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    if (method) params.set("method", method);
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }, [from, to, status, method, q]);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiJson<RecapPayload>(`/api/operator/recap?${query}`);
    setLoading(false);
    if (ok) setPayload(data);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const recap = payload?.recap;

  return (
    <div className="scrollbar-brut flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex flex-wrap items-end gap-2">
        <h2 className="mr-auto font-display text-xl uppercase">{copy.operator.history.title}</h2>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-display uppercase">Dari</span>
          <input
            type="date"
            className="border-2 border-ink bg-white px-2 py-1"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-display uppercase">Sampai</span>
          <input
            type="date"
            className="border-2 border-ink bg-white px-2 py-1"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-display uppercase">Status</span>
          <select
            className="border-2 border-ink bg-white px-2 py-1"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s || copy.common.all}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-display uppercase">Metode</span>
          <select
            className="border-2 border-ink bg-white px-2 py-1"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="">{copy.common.all}</option>
            <option value="CASH">{copy.paymentMethod.CASH}</option>
            <option value="QRIS">{copy.paymentMethod.QRIS}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-display uppercase">Cari</span>
          <input
            className="border-2 border-ink bg-white px-2 py-1"
            placeholder="Kode invoice"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <a href={`/api/operator/recap?${query}${query ? "&" : ""}format=csv`}>
          <Button size="sm" variant="primary">
            {copy.operator.history.exportCsv}
          </Button>
        </a>
      </div>

      {recap && (
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatCard label={copy.operator.history.income} value={rupiah(recap.income)} />
          <StatCard label={copy.operator.history.orders} value={String(recap.orders)} />
          <StatCard label={copy.operator.history.totalPrints} value={String(recap.totalPrints)} />
          <StatCard
            label={copy.operator.history.voided}
            value={`${recap.voided.count} · ${rupiah(recap.voided.amount)}`}
          />
          <StatCard
            label="Per metode"
            value={recap.byMethod.map((m) => `${m.key}: ${m.count}`).join(" · ") || "—"}
          />
          <StatCard
            label="Per paket"
            value={recap.byPackage.map((p) => `${p.key}: ${p.count}`).join(" · ") || "—"}
          />
          <StatCard
            label={copy.operator.history.cancelledBeforePaid}
            value={`${recap.cancelledBeforePaid.total} (T:${recap.cancelledBeforePaid.TIMEOUT} I:${recap.cancelledBeforePaid.KIOSK_IDLE} O:${recap.cancelledBeforePaid.OPERATOR})`}
          />
          <StatCard label="Rata-rata durasi" value={avgDuration(recap.avgSessionMs)} />
          {recap.profitEstimate !== null && (
            <StatCard label="Estimasi keuntungan" value={rupiah(recap.profitEstimate)} />
          )}
        </section>
      )}

      <section className="min-h-0 flex-1 overflow-auto border-2 border-ink bg-white">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-brand-yellow">
            <tr className="text-left font-display uppercase">
              <th className="border-b-2 border-ink px-2 py-1">Kode</th>
              <th className="border-b-2 border-ink px-2 py-1">Status</th>
              <th className="border-b-2 border-ink px-2 py-1">Paket</th>
              <th className="border-b-2 border-ink px-2 py-1">Total</th>
              <th className="border-b-2 border-ink px-2 py-1">Metode</th>
              <th className="border-b-2 border-ink px-2 py-1">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {(payload?.items ?? []).map((item) => (
              <tr key={item.id} className="odd:bg-paper">
                <td className="border-b border-ink/20 px-2 py-1 font-mono">{item.code}</td>
                <td className="border-b border-ink/20 px-2 py-1">
                  {copy.status[item.status as keyof typeof copy.status] ?? item.status}
                  {item.cancelReason === "OPERATOR_AFTER_PAYMENT" && ` (${copy.status.VOID})`}
                </td>
                <td className="border-b border-ink/20 px-2 py-1">
                  {item.packageStripsCount}x Strip
                </td>
                <td className="border-b border-ink/20 px-2 py-1 font-mono">
                  {rupiah(item.totalAmount)}
                </td>
                <td className="border-b border-ink/20 px-2 py-1">
                  {item.paymentMethod
                    ? copy.paymentMethod[item.paymentMethod as keyof typeof copy.paymentMethod]
                    : "—"}
                </td>
                <td className="border-b border-ink/20 px-2 py-1">{dayStamp(item.createdAt)}</td>
              </tr>
            ))}
            {!loading && (payload?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-10 text-center text-ink/40">
                  {copy.operator.queue.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
