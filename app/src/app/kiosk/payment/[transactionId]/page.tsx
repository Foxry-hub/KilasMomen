"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { kioskJson } from "@/components/kiosk/api";
import { useConfig, useDeadline, useHeartbeat, useStatusPoll } from "@/components/kiosk/hooks";
import {
  ConnectingOverlay,
  IdleWarning,
  SessionEndedOverlay,
} from "@/components/kiosk/ScreenOverlays";
import type { KioskStatusView } from "@/components/kiosk/types";

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function PaymentPage() {
  const router = useRouter();
  const params = useParams<{ transactionId: string }>();
  const transactionId = params?.transactionId ?? "";

  const { config } = useConfig();
  const [ended, setEnded] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [touchAt, setTouchAt] = useState(() => Date.now());
  const [idleLeft, setIdleLeft] = useState(0);
  const cancellingRef = useRef(false);

  const goSplash = useCallback(() => router.replace("/kiosk"), [router]);

  const { data, connection } = useStatusPoll(transactionId, {
    onCancelled: () => setEnded(true),
  });

  useHeartbeat("PAYMENT");

  const stage: "PACKAGE" | "WAITING" = data && data.totalAmount > 0 ? "WAITING" : "PACKAGE";
  const remainingMs = useDeadline(data?.expiresAt ?? null, data?.serverTime ?? null);
  const idleSec = config?.idleCancelSec ?? 90;

  /* PAID → layar pemilihan frame (§7.3). */
  useEffect(() => {
    if (data?.status === "PAID") router.replace(`/kiosk/frame/${transactionId}`);
  }, [data?.status, transactionId, router]);

  /* Idle 90 detik — hanya di tahap (a) Pilih Paket (§7.3). */
  useEffect(() => {
    if (stage !== "PACKAGE" || ended) return;
    const timer = setInterval(() => {
      const left = touchAt + idleSec * 1000 - Date.now();
      setIdleLeft(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0 && !cancellingRef.current) {
        cancellingRef.current = true;
        kioskJson(`/api/kiosk/transactions/${transactionId}/cancel`, { method: "POST" }).then(
          (res) => {
            cancellingRef.current = false;
            if (res.ok) goSplash();
            else setTouchAt(Date.now());
          }
        );
      }
    }, 500);
    return () => clearInterval(timer);
  }, [stage, ended, touchAt, idleSec, transactionId, goSplash]);

  const waitForPayment = useCallback(async () => {
    if (selected == null || submitting) return;
    setSubmitting(true);
    const res = await kioskJson(`/api/kiosk/transactions/${transactionId}/package`, {
      method: "PATCH",
      body: { strips: selected },
    });
    setSubmitting(false);
    if (!res.ok) setNotice(res.error ?? copy.errors.generic);
    else setNotice(null);
  }, [selected, submitting, transactionId]);

  const packages = config?.packages ?? [];
  const idleWarning = stage === "PACKAGE" && idleLeft > 0 && idleLeft <= 15;
  const busy = useMemo(() => connection === "offline", [connection]);

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      onPointerDown={() => setTouchAt(Date.now())}
    >
      <header className="flex shrink-0 items-center justify-between border-b-4 border-ink bg-white p-4 lg:p-5">
        <div className="flex items-center gap-4">
          <span className="border-4 border-ink bg-brand-cyan px-3 py-1 font-display text-lg uppercase shadow-brut-sm">
            {copy.brand.name}
          </span>
          <h1 className="font-display text-2xl uppercase tracking-tight lg:text-3xl">
            {stage === "PACKAGE" ? copy.kiosk.package.title : copy.kiosk.payment.title}
          </h1>
        </div>
        {data?.code && (
          <span className="font-mono text-sm font-bold lg:text-base">{data.code}</span>
        )}
      </header>

      <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4 lg:p-8">
        {stage === "PACKAGE" ? (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <p className="font-sans text-base text-ink/70 lg:text-lg">
              {copy.kiosk.package.perPackage}
            </p>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {packages.map((pkg) => {
                const isActive = selected === pkg.strips;
                return (
                  <button
                    key={pkg.strips}
                    type="button"
                    onClick={() => setSelected(pkg.strips)}
                    className={[
                      "flex flex-col items-center gap-3 border-4 border-ink p-6 shadow-brut-lg transition-transform duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none",
                      isActive ? "bg-brand-yellow" : "bg-white",
                    ].join(" ")}
                  >
                    <span className="font-display text-4xl uppercase leading-none">
                      {copy.kiosk.package.strips(pkg.strips)}
                    </span>
                    <span className="font-mono text-2xl font-bold">{rupiah(pkg.price)}</span>
                    <span className="text-xs uppercase tracking-wide text-ink/60">
                      Cetakan 4R + Soft Copy
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center">
            <div className="w-full border-4 border-ink bg-white p-6 shadow-brut-lg">
              <div className="flex items-center justify-between border-b-4 border-ink pb-3">
                <span className="font-display text-xl uppercase">
                  {copy.kiosk.package.strips(data?.packageStripsCount ?? 1)}
                </span>
                <span className="font-mono text-2xl font-bold">
                  {rupiah(data?.totalAmount ?? 0)}
                </span>
              </div>

              <div className="mt-5 flex flex-col items-center gap-4">
                {config?.qrisImageUrl ? (
                  <>
                    <p className="font-sans text-base font-semibold">
                      {copy.kiosk.payment.scanQris}
                    </p>
                    {/* QRIS statis lokal */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={config.qrisImageUrl}
                      alt="QRIS"
                      className="size-64 border-4 border-ink bg-white object-contain shadow-brut"
                    />
                  </>
                ) : (
                  <p className="font-sans text-lg font-semibold">
                    {copy.kiosk.payment.cashNote}
                  </p>
                )}
              </div>
            </div>

            <div className="w-full border-4 border-ink bg-brand-pink p-5 shadow-brut-lg">
              <p className="font-display text-2xl uppercase lg:text-3xl">
                {copy.kiosk.payment.instruction}
              </p>
            </div>

            <div className="flex w-full items-center justify-between gap-4">
              <span className="font-display text-xl uppercase">
                {copy.kiosk.payment.waiting}
              </span>
              <span className="border-4 border-ink bg-white px-4 py-2 font-mono text-2xl font-bold shadow-brut-sm">
                {mmss(remainingMs)}
              </span>
            </div>
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t-4 border-ink bg-white p-4 lg:p-5">
        {stage === "PACKAGE" ? (
          <div className="mx-auto flex w-full max-w-5xl items-center gap-4">
            <span className="hidden font-mono text-lg font-bold lg:block">
              {copy.kiosk.payment.remaining} {mmss(idleLeft * 1000)}
            </span>
            <button
              type="button"
              disabled={selected == null || submitting}
              onClick={waitForPayment}
              className="w-full border-4 border-ink bg-brand-green py-5 font-display text-2xl uppercase shadow-brut-lg transition-transform duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:disabled-stripes disabled:cursor-not-allowed lg:text-3xl"
            >
              {copy.kiosk.package.continue}
            </button>
          </div>
        ) : (
          <p className="text-center font-sans text-sm text-ink/60">
            {copy.kiosk.payment.waiting}
          </p>
        )}
        {notice && (
          <p className="mt-2 text-center font-display text-sm uppercase text-brand-red">
            {notice}
          </p>
        )}
      </footer>

      <IdleWarning show={idleWarning && !ended} />
      <ConnectingOverlay show={busy && !ended} />
      {ended && <SessionEndedOverlay onDone={goSplash} />}
    </div>
  );
}
