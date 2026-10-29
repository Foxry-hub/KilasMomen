"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy.id";

interface InvoiceData {
  code: string;
  filter: string;
}

/** Halaman unduh soft copy untuk pengunjung (mobile-first) (§6.4). */
export default function InvoiceClient({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/public/invoice/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (!alive) return;
        if (!res.ok) {
          setExpired(true);
          return;
        }
        setInvoice((await res.json()) as InvoiceData);
      } catch {
        if (alive) setExpired(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const filterLabel =
    invoice && invoice.filter in copy.filter
      ? copy.filter[invoice.filter as keyof typeof copy.filter]
      : invoice?.filter;

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col bg-paper p-4 sm:p-6">
      <div className="overflow-hidden border-4 border-ink bg-white shadow-brut-xl">
        <header className="flex items-center justify-between gap-3 border-b-4 border-ink bg-brand-yellow p-4">
          <div className="flex items-center gap-3">
            <span className="border-2 border-ink bg-ink px-2 py-1 font-display text-lg text-brand-yellow">
              {copy.brand.short}
            </span>
            <div>
              <h1 className="font-display text-xl uppercase leading-none">
                {copy.brand.name}
              </h1>
              <p className="font-mono text-[10px] uppercase">{copy.brand.tagline}</p>
            </div>
          </div>
          {invoice && (
            <span className="border-2 border-ink bg-white px-2 py-1 font-mono text-[10px] font-bold shadow-brut-sm">
              {invoice.code}
            </span>
          )}
        </header>

        <section className="p-5 sm:p-7">
          {loading && !expired && !invoice ? (
            <p className="py-10 text-center font-display uppercase text-ink/50">
              {copy.common.loading}
            </p>
          ) : expired ? (
            <div className="border-4 border-ink bg-brand-red p-5 text-center shadow-brut">
              <p className="font-display text-xl uppercase text-white">
                {copy.invoice.expired}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 border-4 border-ink bg-brand-green p-4 shadow-brut">
                <h2 className="font-display text-2xl uppercase leading-tight">
                  {copy.invoice.ready}
                </h2>
                <p className="mt-2 font-sans text-sm">{copy.invoice.choose}</p>
              </div>

              <div className="flex flex-col gap-4">
                <a
                  href={`/api/public/invoice/${encodeURIComponent(token)}/image?download=1`}
                  download
                  className="block border-4 border-ink bg-brand-cyan px-4 py-5 text-center font-display text-lg uppercase shadow-brut transition-transform duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {copy.invoice.downloadFramed}
                </a>

                <a
                  href={`/api/public/invoice/${encodeURIComponent(token)}/raw-photos`}
                  download
                  className="block border-4 border-ink bg-brand-yellow px-4 py-5 text-center font-display text-lg uppercase shadow-brut transition-transform duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {copy.invoice.downloadRaw}
                </a>
              </div>
            </>
          )}

          <p className="mt-6 border-t-4 border-ink pt-4 text-center font-sans text-xs text-ink/70">
            {copy.invoice.reminder}
          </p>
          {filterLabel && (
            <p className="mt-2 text-center font-mono text-[10px] uppercase text-ink/50">
              {copy.kiosk.editor.filterTitle}: {filterLabel}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
