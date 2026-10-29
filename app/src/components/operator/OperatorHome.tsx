"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";
import type { FrameRow } from "@/lib/operator-types";
import { CameraPanel } from "./CameraPanel";
import { QueueBoard } from "./QueueBoard";
import { apiJson } from "./utils";
import { useKioskStatus } from "./useKioskStatus";
import { useOperatorStream } from "./useOperatorStream";

/** Halaman utama operator: antrean (col-span-8) + panel samping (col-span-4) (§6.2). */
export function OperatorHome() {
  const { queue, connection, reload } = useOperatorStream();
  const { status } = useKioskStatus();
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [eventKey, setEventKey] = useState(0);

  useEffect(() => {
    void (async () => {
      const { ok, data } = await apiJson<{ frames: FrameRow[] }>("/api/operator/frames");
      if (ok) setFrames(data.frames ?? []);
    })();
  }, [eventKey]);

  const counts = useMemo(() => {
    const c = { TWO: 0, THREE: 0, MANY: 0 };
    for (const f of frames) {
      if (f.category === "TWO") c.TWO++;
      else if (f.category === "THREE") c.THREE++;
      else c.MANY++;
    }
    return c;
  }, [frames]);

  const closeEvent = async () => {
    if (!window.confirm("Akhiri event? Semua link soft copy akan langsung nonaktif.")) return;
    await apiJson("/api/operator/event/close", { method: "POST", body: {} });
    setEventKey((k) => k + 1);
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-12">
      <div className="min-h-0 lg:col-span-8">
        <QueueBoard queue={queue} reload={reload} connection={connection} />
      </div>
      <aside className="scrollbar-brut flex min-h-0 flex-col gap-3 overflow-y-auto lg:col-span-4">
        <CameraPanel kiosk={status?.kiosk ?? null} refreshKey={eventKey} onSaved={reload} />

        <section className="border-4 border-ink bg-white shadow-brut">
          <header className="border-b-4 border-ink bg-brand-cyan px-3 py-2">
            <h3 className="font-display text-sm uppercase">Template Frame</h3>
          </header>
          <div className="p-3 text-xs">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ["TWO", "2 Frame"],
                  ["THREE", "3 Frame"],
                  ["MANY", "Banyak"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="border-2 border-ink bg-paper py-1.5">
                  <dt className="font-display uppercase">{label}</dt>
                  <dd className="font-mono text-lg">{counts[key]}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/operator/frames"
                className="border-2 border-ink bg-brand-yellow px-3 py-2 text-center font-display text-xs uppercase shadow-brut-sm"
              >
                Kelola Frame
              </Link>
              <Link
                href="/operator/riwayat"
                className="border-2 border-ink bg-white px-3 py-2 text-center font-display text-xs uppercase shadow-brut-sm"
              >
                Riwayat &amp; Rekap
              </Link>
            </div>
          </div>
        </section>

        {status?.event.status === "OPEN" && (
          <Button size="sm" variant="danger" onClick={closeEvent}>
            {copy.operator.event.close}
          </Button>
        )}
      </aside>
    </div>
  );
}
