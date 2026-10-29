"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";
import type { KioskStatus } from "@/lib/operator-types";
import { apiJson } from "./utils";

const SOURCES = [
  { value: "DROIDCAM_USB", label: "DroidCam USB (kamera HP)" },
  { value: "REAL_CAMERA", label: "Kamera Sungguhan (webcam/DSLR)" },
];

interface Props {
  kiosk: KioskStatus | null;
  refreshKey: number;
  onSaved: () => void;
}

/** Panel pemilihan input kamera (§6.3). */
export function CameraPanel({ kiosk, refreshKey, onSaved }: Props) {
  const [source, setSource] = useState("REAL_CAMERA");
  const [label, setLabel] = useState("");
  const [maxRes, setMaxRes] = useState("FULL_HD");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { ok, data } = await apiJson<{ settings: Record<string, string> }>(
        "/api/operator/settings"
      );
      if (!ok) return;
      setSource(data.settings?.["camera.source"] ?? "REAL_CAMERA");
      setLabel(data.settings?.["camera.deviceLabel"] ?? "");
      setMaxRes(data.settings?.["camera.maxResolution"] ?? "FULL_HD");
    })();
  }, [refreshKey]);

  const apply = async () => {
    setSaving(true);
    const { ok, data } = await apiJson("/api/operator/settings", {
      method: "PUT",
      body: {
        settings: {
          "camera.source": source,
          "camera.deviceLabel": label,
          "camera.maxResolution": maxRes,
        },
      },
    });
    setSaving(false);
    setNotice(ok ? "Kamera diterapkan saat kios idle." : (data as { error?: string }).error ?? copy.errors.generic);
    if (ok) onSaved();
    window.setTimeout(() => setNotice(null), 4000);
  };

  const devices = kiosk?.devices ?? [];

  return (
    <section className="border-4 border-ink bg-white shadow-brut">
      <header className="border-b-4 border-ink bg-brand-pink px-3 py-2">
        <h3 className="font-display text-sm uppercase">Input Kamera</h3>
      </header>
      <div className="flex flex-col gap-2 p-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="font-display uppercase">Sumber</span>
          <select
            className="border-2 border-ink bg-white px-2 py-1.5"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-display uppercase">Perangkat terdeteksi kios</span>
          <select
            className="border-2 border-ink bg-white px-2 py-1.5"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          >
            <option value="">(otomatis)</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.label}>
                {d.label}
              </option>
            ))}
          </select>
          {devices.length === 0 && (
            <span className="text-ink/50">Belum ada heartbeat perangkat dari kios.</span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-display uppercase">Resolusi maksimum</span>
          <select
            className="border-2 border-ink bg-white px-2 py-1.5"
            value={maxRes}
            onChange={(e) => setMaxRes(e.target.value)}
          >
            <option value="FULL_HD">Full HD (1920×1080)</option>
            <option value="4K">4K (3840×2160)</option>
          </select>
        </label>

        <p className="text-ink/60">Status kamera: {kiosk?.cameraStatus ?? "UNKNOWN"}</p>
        {notice && <p className="text-brand-red">{notice}</p>}

        <Button size="xs" variant="primary" disabled={saving} onClick={apply}>
          Terapkan
        </Button>
      </div>
    </section>
  );
}
