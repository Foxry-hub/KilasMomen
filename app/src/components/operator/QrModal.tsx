"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";
import { apiJson } from "./utils";

interface QrPayload {
  publicUrl: string | null;
  tunnelOnline: boolean;
  tunnelMode: string;
  publicBaseUrl: string | null;
  code: string;
  hasFinal: boolean;
}

/** Modal QR soft copy; QR dibuat lokal di browser (§6.4). */
export function QrModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [data, setData] = useState<QrPayload | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { ok, data: payload } = await apiJson<QrPayload>(
        `/api/operator/sessions/${sessionId}/qr`
      );
      if (!alive) return;
      if (!ok) {
        setFailed(true);
        return;
      }
      setData(payload);
      if (payload.publicUrl) {
        try {
          setQr(await QRCode.toDataURL(payload.publicUrl, { width: 320, margin: 1 }));
        } catch {
          setFailed(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const tunnelOffline = data ? !data.tunnelOnline : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border-4 border-ink bg-paper shadow-brut-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-4 border-ink bg-brand-cyan px-4 py-3">
          <h2 className="font-display text-lg uppercase">
            {copy.operator.actions.showQr}
          </h2>
          <button
            onClick={onClose}
            aria-label={copy.common.close}
            className="border-2 border-ink bg-white px-2 font-display text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="max-h-[70svh] overflow-y-auto p-4 text-center">
          {failed && <p className="text-sm text-brand-red">{copy.errors.generic}</p>}

          {tunnelOffline && (
            <p className="mb-3 border-2 border-ink bg-brand-red px-3 py-2 text-sm text-white">
              {copy.operator.tunnel.warning}
            </p>
          )}

          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR soft copy" className="mx-auto border-4 border-ink bg-white" />
          ) : (
            !failed && <p className="py-8 text-sm">{copy.common.loading}</p>
          )}

          <p className="mt-3 font-mono text-sm">{data?.code ?? ""}</p>
          <p className="mt-1 text-xs">Scan dan unduh sekarang. Link hanya aktif selama jam event.</p>
          {data?.publicUrl && (
            <p className="mt-2 break-all text-[10px] text-ink/60">{data.publicUrl}</p>
          )}
        </div>

        <div className="border-t-4 border-ink p-3">
          <Button size="sm" variant="secondary" className="w-full" onClick={onClose}>
            {copy.common.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
