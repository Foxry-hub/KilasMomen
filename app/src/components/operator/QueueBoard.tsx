"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";
import type { FrameRow, QueueItem, QueuePayload } from "@/lib/operator-types";
import { buildPrintHtml } from "@/features/print/printProfile";
import { QrModal } from "./QrModal";
import { apiJson, dayStamp, mmss, rupiah } from "./utils";

interface Props {
  queue: QueuePayload | null;
  reload: () => void;
  connection: "connecting" | "live" | "polling";
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-brand-yellow",
  PAID: "bg-brand-cyan",
  PROCESSING: "bg-brand-violet",
  COMPLETED: "bg-brand-green",
  CANCELLED: "bg-brand-red text-white",
};

const STAGE_TEXT: Record<string, string> = {
  FRAME: copy.processingStage.FRAME,
  REVIEW: copy.processingStage.REVIEW,
  READY: copy.processingStage.READY,
};

function StageLabel({ item }: { item: QueueItem }) {
  if (item.status !== "PROCESSING" || !item.stage) return null;
  if (item.stage === "PHOTO") {
    return <span>{copy.processingStage.PHOTO(item.photoCount)}</span>;
  }
  return <span>Tahap: {STAGE_TEXT[item.stage] ?? item.stage}</span>;
}

export function QueueBoard({ queue, reload, connection }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [activePaper, setActivePaper] = useState("4R");
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void (async () => {
      const [f, s] = await Promise.all([
        apiJson<{ frames: FrameRow[] }>("/api/operator/frames"),
        apiJson<{ settings: Record<string, string> }>("/api/operator/settings"),
      ]);
      if (f.ok) setFrames(f.data.frames ?? []);
      if (s.ok) setActivePaper(s.data.settings?.["print.activePaper"] ?? "4R");
    })();
  }, []);

  const frameById = useMemo(() => {
    const map = new Map<string, FrameRow>();
    for (const f of frames) map.set(f.id, f);
    return map;
  }, [frames]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const run = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setBusy(key);
      try {
        await fn();
        reload();
      } finally {
        setBusy(null);
      }
    },
    [reload]
  );

  const confirmPayment = (item: QueueItem, method: "CASH" | "QRIS") =>
    run(`${item.id}:${method}`, async () => {
      const { ok, data } = await apiJson(`/api/operator/transactions/${item.id}/confirm`, {
        method: "POST",
        body: { paymentMethod: method },
      });
      if (!ok) flash((data as { error?: string }).error ?? copy.errors.generic);
    });

  const cancelPending = (item: QueueItem) =>
    run(`${item.id}:cancel`, async () => {
      const { ok, data } = await apiJson(`/api/operator/transactions/${item.id}/cancel`, {
        method: "POST",
        body: {},
      });
      if (!ok) flash((data as { error?: string }).error ?? copy.errors.generic);
    });

  const cancelVoid = (item: QueueItem) => {
    if (!window.confirm(copy.operator.actions.cancelVoidDialog)) return;
    void run(`${item.id}:void`, async () => {
      const { ok, data } = await apiJson(`/api/operator/transactions/${item.id}/cancel`, {
        method: "POST",
        body: { afterPayment: true },
      });
      if (!ok) flash((data as { error?: string }).error ?? copy.errors.generic);
    });
  };

  const complete = (item: QueueItem) =>
    run(`${item.id}:done`, async () => {
      const { ok, data } = await apiJson(`/api/operator/transactions/${item.id}/complete`, {
        method: "POST",
        body: {},
      });
      if (!ok) flash((data as { error?: string }).error ?? copy.errors.generic);
    });

  const printLocal = (item: QueueItem) =>
    run(`${item.id}:print`, async () => {
      const frame = item.frameId ? frameById.get(item.frameId) : null;
      const profile = frame?.print;
      if (!profile) {
        flash("Profil cetak frame tidak ditemukan");
        return;
      }
      if (profile.paper !== activePaper) {
        if (
          !window.confirm(
            `Pastikan kertas ${profile.paper} terpasang pada printer. Lanjutkan cetak?`
          )
        ) {
          return;
        }
      }
      const src = `${window.location.origin}/api/operator/sessions/${item.sessionId}/final`;
      const html = buildPrintHtml(src, profile, item.packageStripsCount);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
      window.setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        window.setTimeout(() => iframe.remove(), 60_000);
      }, 500);

      await apiJson(`/api/operator/sessions/${item.sessionId}/output-log`, {
        method: "POST",
        body: { type: "PRINT", copies: item.packageStripsCount },
      });
    });

  const sendFotocopy = (item: QueueItem) => {
    // Tab dibuka sinkron di dalam klik agar tidak diblokir popup (§6.4).
    const tab = window.open("", "_blank");
    void run(`${item.id}:fotocopy`, async () => {
      const { ok, data } = await apiJson<{ waUrl: string | null; numberMissing: boolean }>(
        `/api/operator/sessions/${item.sessionId}/export-fotocopy`,
        { method: "POST", body: {} }
      );
      if (!ok) {
        tab?.close();
        flash((data as { error?: string }).error ?? copy.errors.generic);
        return;
      }
      if (data.numberMissing || !data.waUrl) {
        tab?.close();
        flash("Nomor WhatsApp tukang fotokopi belum diisi. Buka Pengaturan → Fotokopi.");
        return;
      }
      if (tab) tab.location.href = data.waUrl;
      else window.open(data.waUrl, "_blank");
    });
  };

  const active = queue?.active ?? [];
  const recent = queue?.recent ?? [];

  return (
    <section className="flex h-full min-h-0 flex-col border-4 border-ink bg-white shadow-brut">
      <header className="flex items-center justify-between gap-2 border-b-4 border-ink bg-brand-yellow px-3 py-2">
        <h2 className="font-display text-lg uppercase">{copy.operator.queue.title}</h2>
        <span className="font-mono text-xs">
          {connection === "live" ? "● LIVE" : copy.common.connecting}
        </span>
      </header>

      {notice && (
        <p className="border-b-2 border-ink bg-brand-red px-3 py-1.5 text-xs text-white">{notice}</p>
      )}

      <div className="scrollbar-brut min-h-0 flex-1 overflow-y-auto p-3">
        {active.length === 0 && (
          <p className="py-10 text-center font-display text-sm text-ink/40">
            {copy.operator.queue.empty}
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {active.map((item) => {
            const noPackage = item.totalAmount <= 0;
            const remaining =
              item.status === "PENDING"
                ? item.expiresAt
                  ? new Date(item.expiresAt).getTime() - now
                  : item.remainingMs
                : null;
            const isReady = item.stage === "READY";
            return (
              <li
                key={item.id}
                className="border-2 border-ink bg-paper p-3 shadow-brut-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">{item.code}</span>
                  <span
                    className={[
                      "border-2 border-ink px-1.5 text-[10px] font-display uppercase",
                      STATUS_CLASS[item.status] ?? "bg-white",
                    ].join(" ")}
                  >
                    {copy.status[item.status as keyof typeof copy.status] ?? item.status}
                  </span>
                  {item.stale && (
                    <span className="border-2 border-ink bg-ink px-1.5 text-[10px] font-display uppercase text-white">
                      {copy.status.STALE}
                    </span>
                  )}
                  {item.cancelReason === "OPERATOR_AFTER_PAYMENT" && (
                    <span className="border-2 border-ink bg-brand-red px-1.5 text-[10px] font-display uppercase text-white">
                      {copy.status.VOID}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {noPackage ? (
                    <span className="font-display text-ink/60">{copy.operator.queue.noPackage}</span>
                  ) : (
                    <>
                      <span>
                        {item.packageStripsCount}x Strip · {rupiah(item.totalAmount)}
                      </span>
                      <span className="text-ink/60">{dayStamp(item.createdAt)}</span>
                      {remaining !== null && (
                        <span className="font-mono">sisa {mmss(remaining)}</span>
                      )}
                    </>
                  )}
                </div>

                {item.status === "PAID" && (
                  <p className="mt-1 text-xs italic text-ink/70">
                    Menunggu kios membuka Frame...
                  </p>
                )}
                {item.status === "PROCESSING" && (
                  <p className="mt-1 text-xs">
                    <StageLabel item={item} />
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {item.status === "PENDING" && (
                    <>
                      <Button
                        size="xs"
                        variant="success"
                        disabled={noPackage || busy !== null}
                        onClick={() => confirmPayment(item, "CASH")}
                      >
                        {copy.operator.actions.confirmCash}
                      </Button>
                      <Button
                        size="xs"
                        variant="primary"
                        disabled={noPackage || busy !== null}
                        onClick={() => confirmPayment(item, "QRIS")}
                      >
                        {copy.operator.actions.confirmQris}
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => cancelPending(item)}
                      >
                        {copy.operator.actions.cancel}
                      </Button>
                    </>
                  )}

                  {item.status === "PROCESSING" && (
                    <>
                      <Button
                        size="xs"
                        variant="primary"
                        disabled={!isReady || !item.hasFinal}
                        onClick={() => setQrSession(item.sessionId)}
                      >
                        {copy.operator.actions.showQr}
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={!isReady || !item.hasFinal || busy !== null}
                        onClick={() => printLocal(item)}
                      >
                        {copy.operator.actions.printLocal}
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={!isReady || !item.hasFinal || busy !== null}
                        onClick={() => sendFotocopy(item)}
                      >
                        {copy.operator.actions.sendFotocopy}
                      </Button>
                      <Button
                        size="xs"
                        variant="success"
                        disabled={busy !== null}
                        onClick={() => complete(item)}
                      >
                        {copy.operator.actions.markDone}
                      </Button>
                    </>
                  )}

                  {(item.status === "PAID" || item.status === "PROCESSING") && (
                    <Button
                      size="xs"
                      variant="danger"
                      disabled={busy !== null}
                      onClick={() => cancelVoid(item)}
                    >
                      {copy.operator.actions.cancelVoid}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t-2 border-ink pt-2">
          <button
            className="font-display text-xs uppercase"
            onClick={() => setShowRecent((v) => !v)}
          >
            Riwayat: SELESAI {queue?.counts.completed ?? 0} · DIBATALKAN{" "}
            {queue?.counts.cancelled ?? 0} {showRecent ? "▲" : "▼"}
          </button>
          {showRecent && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {recent.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between border-2 border-ink/20 bg-white px-2 py-1 text-xs"
                >
                  <span className="font-mono">{item.code}</span>
                  <span className="flex items-center gap-2">
                    {item.cancelReason === "OPERATOR_AFTER_PAYMENT" && (
                      <span className="font-display uppercase text-brand-red">
                        {copy.status.VOID}
                      </span>
                    )}
                    <span className="text-ink/60">{dayStamp(item.createdAt)}</span>
                    <span
                      className={[
                        "border-2 border-ink px-1 text-[10px] font-display uppercase",
                        STATUS_CLASS[item.status] ?? "bg-white",
                      ].join(" ")}
                    >
                      {copy.status[item.status as keyof typeof copy.status] ?? item.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {qrSession && <QrModal sessionId={qrSession} onClose={() => setQrSession(null)} />}
    </section>
  );
}
