"use client";

import { copy } from "@/lib/copy.id";
import type { OperatorStatus } from "@/lib/operator-types";
import { clock } from "./utils";

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 border-2 border-ink px-2 py-0.5 text-xs font-display uppercase",
        ok ? "bg-brand-green" : "bg-brand-red text-white",
      ].join(" ")}
    >
      <span className="h-2 w-2 rounded-full bg-ink" />
      {label}
    </span>
  );
}

/** Header status: KIOS, TUNNEL, EVENT (§6.1, §6.6). */
export function StatusHeader({ status }: { status: OperatorStatus | null }) {
  const kioskOnline = status?.kiosk.online ?? false;
  const tunnelOnline = status?.tunnel.online ?? false;
  const eventOpen = status?.event.status === "OPEN";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill ok={kioskOnline} label={`KIOS: ${kioskOnline ? "AKTIF" : "OFFLINE"}`} />
      <Pill ok={tunnelOnline} label={`TUNNEL: ${tunnelOnline ? "AKTIF" : "OFFLINE"}`} />
      <span
        className={[
          "inline-flex items-center gap-2 border-2 border-ink px-2 py-0.5 text-xs font-display uppercase",
          eventOpen ? "bg-brand-cyan" : "bg-white",
        ].join(" ")}
      >
        {eventOpen
          ? copy.operator.event.active(clock(status?.event.openedAt ?? null))
          : copy.operator.event.inactive}
      </span>
    </div>
  );
}
