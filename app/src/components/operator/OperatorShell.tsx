"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { apiJson } from "./utils";
import { StatusHeader } from "./StatusHeader";
import { useKioskStatus } from "./useKioskStatus";

const NAV = [
  { href: "/operator", label: copy.operator.nav.queue },
  { href: "/operator/frames", label: copy.operator.nav.frames },
  { href: "/operator/riwayat", label: copy.operator.nav.history },
  { href: "/operator/pengaturan", label: copy.operator.nav.settings },
];

/** Kerangka panel operator: brand, status, navigasi (§6.2). */
export function OperatorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useKioskStatus();

  const logout = async () => {
    await apiJson("/api/operator/logout", { method: "POST", body: {} });
    window.location.href = "/operator/login";
  };

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="shrink-0 border-b-4 border-ink bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl uppercase leading-none">
              {copy.brand.name}
            </span>
            <span className="font-mono text-xs uppercase text-ink/60">/ Operator</span>
          </div>
          <StatusHeader status={status} />
        </div>
        <nav className="flex flex-wrap items-center gap-2 border-t-2 border-ink px-4 py-1.5">
          {NAV.map((item) => {
            const active =
              item.href === "/operator"
                ? pathname === "/operator"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "border-2 border-ink px-3 py-1 font-display text-xs uppercase",
                  active ? "bg-brand-yellow shadow-brut-sm" : "bg-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="ml-auto border-2 border-ink bg-brand-red px-3 py-1 font-display text-xs uppercase text-white"
          >
            {copy.operator.nav.logout}
          </button>
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
