"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";
import { PAPER_PRESETS } from "@/features/frames/frame.config";
import { apiJson } from "./utils";

interface PackageRow {
  strips: number;
  price: number;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-display uppercase">{label}</span>
      {children}
      {hint && <span className="text-ink/50">{hint}</span>}
    </label>
  );
}

const inputClass = "border-2 border-ink bg-white px-2 py-1.5";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-2 border-ink bg-white shadow-brut-sm">
      <header className="border-b-2 border-ink bg-brand-cyan px-3 py-1.5">
        <h3 className="font-display text-sm uppercase">{title}</h3>
      </header>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </section>
  );
}

const PAPERS = Object.keys(PAPER_PRESETS);

/** Menu Setting Operator (§6.5). */
export function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { ok, data } = await apiJson<{ settings: Record<string, string> }>(
      "/api/operator/settings"
    );
    if (!ok) return;
    setSettings(data.settings ?? {});
    try {
      const parsed = JSON.parse(data.settings?.["pricing.packages"] ?? "[]");
      if (Array.isArray(parsed)) setPackages(parsed);
    } catch {
      setPackages([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const set = (key: string, value: string) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  };

  const save = async () => {
    setBusy(true);
    const body: Record<string, unknown> = {
      settings: {
        "publicBaseUrl": settings["publicBaseUrl"] ?? "",
        "tunnel.mode": settings["tunnel.mode"] ?? "QUICK",
        "fotocopy.waNumber": settings["fotocopy.waNumber"] ?? "",
        "fotocopy.messageTemplate": settings["fotocopy.messageTemplate"] ?? "",
        "print.activePaper": settings["print.activePaper"] ?? "4R",
        "print.minDpiWarn": settings["print.minDpiWarn"] ?? "150",
        "kiosk.filterByActivePaper": settings["kiosk.filterByActivePaper"] ?? "false",
        "cost.perStrip": settings["cost.perStrip"] ?? "",
        "cost.fixed": settings["cost.fixed"] ?? "",
        "softcopy.maxHours": settings["softcopy.maxHours"] ?? "12",
        "event.gapHours": settings["event.gapHours"] ?? "4",
        "event.autoCloseAt": settings["event.autoCloseAt"] ?? "",
      },
      packages,
    };
    if (pin.trim()) body.pin = pin.trim();
    const { ok, data } = await apiJson("/api/operator/settings", { method: "PUT", body });
    setBusy(false);
    if (!ok) {
      flash((data as { error?: string }).error ?? copy.errors.generic);
      return;
    }
    setPin("");
    flash("Pengaturan disimpan");
    void load();
  };

  const upload = async (kind: "qris" | "splash", file: File) => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    const res = await fetch("/api/operator/media", { method: "POST", body: form });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      flash(data.error ?? copy.errors.generic);
      return;
    }
    flash("Aset diunggah");
    void load();
  };

  const backup = async () => {
    setBusy(true);
    const { ok, data } = await apiJson<{ file?: string }>("/api/operator/backup", {
      method: "POST",
      body: {},
    });
    setBusy(false);
    flash(ok ? `Cadangan dibuat: ${data.file ?? ""}` : copy.errors.generic);
  };

  const testWa = () => {
    const raw = (settings["fotocopy.waNumber"] ?? "").replace(/[^\d]/g, "");
    if (!raw) {
      flash("Isi nomor WhatsApp lebih dulu.");
      return;
    }
    const normalized = raw.startsWith("0") ? `62${raw.slice(1)}` : raw;
    window.open(`https://web.whatsapp.com/send?phone=${normalized}`, "_blank");
  };

  const closeEvent = async () => {
    if (!window.confirm("Akhiri event? Semua link soft copy akan langsung nonaktif.")) return;
    await apiJson("/api/operator/event/close", { method: "POST", body: {} });
    flash("Event diakhiri");
  };

  return (
    <div className="scrollbar-brut flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl uppercase">{copy.operator.settings.title}</h2>
        <Button size="sm" variant="success" disabled={busy} onClick={save}>
          {copy.common.save}
        </Button>
      </div>

      {notice && (
        <p className="border-2 border-ink bg-brand-yellow px-3 py-1.5 text-xs">{notice}</p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Group title={copy.operator.settings.pricing}>
          {packages.map((p, i) => (
            <div key={i} className="flex items-end gap-2 text-xs">
              <Field label="Strip">
                <input
                  type="number"
                  min={1}
                  max={10}
                  className={`${inputClass} w-16`}
                  value={p.strips}
                  onChange={(e) =>
                    setPackages((rows) =>
                      rows.map((r, j) =>
                        j === i ? { ...r, strips: Number(e.target.value) } : r
                      )
                    )
                  }
                />
              </Field>
              <Field label="Harga (Rp)">
                <input
                  type="number"
                  min={1}
                  className={`${inputClass} w-28`}
                  value={p.price}
                  onChange={(e) =>
                    setPackages((rows) =>
                      rows.map((r, j) =>
                        j === i ? { ...r, price: Number(e.target.value) } : r
                      )
                    )
                  }
                />
              </Field>
              <Button
                size="xs"
                variant="danger"
                onClick={() => setPackages((rows) => rows.filter((_, j) => j !== i))}
              >
                {copy.common.delete}
              </Button>
            </div>
          ))}
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setPackages((rows) => [...rows, { strips: 1, price: 10000 }])}
          >
            Tambah Paket
          </Button>
        </Group>

        <Group title={copy.operator.settings.payment}>
          <Field label="Gambar QRIS" hint="PNG/JPG maks 2 MB">
            <input
              type="file"
              accept="image/png,image/jpeg"
              className={inputClass}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("qris", f);
              }}
            />
          </Field>
          {settings["qris.imagePath"] && (
            <span className="font-mono text-[10px] text-ink/60">
              {settings["qris.imagePath"]}
            </span>
          )}
        </Group>


        <Group title={copy.operator.settings.fotocopy}>
          <Field label="Nomor WhatsApp" hint="0812… / +62 812… dinormalisasi otomatis">
            <input
              className={inputClass}
              value={settings["fotocopy.waNumber"] ?? ""}
              onChange={(e) => set("fotocopy.waNumber", e.target.value)}
            />
          </Field>
          <Field label="Template pesan" hint="Placeholder: {code}, {strips}, {paper}">
            <textarea
              className={`${inputClass} h-20`}
              value={settings["fotocopy.messageTemplate"] ?? ""}
              onChange={(e) => set("fotocopy.messageTemplate", e.target.value)}
            />
          </Field>
          <Button size="xs" variant="secondary" onClick={testWa}>
            Tes buka chat
          </Button>
        </Group>

        <Group title={copy.operator.settings.print}>
          <Field label="Kertas aktif">
            <select
              className={inputClass}
              value={settings["print.activePaper"] ?? "4R"}
              onChange={(e) => set("print.activePaper", e.target.value)}
            >
              {PAPERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ambang DPI peringatan">
            <input
              type="number"
              className={inputClass}
              value={settings["print.minDpiWarn"] ?? "150"}
              onChange={(e) => set("print.minDpiWarn", e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={settings["kiosk.filterByActivePaper"] === "true"}
              onChange={(e) =>
                set("kiosk.filterByActivePaper", e.target.checked ? "true" : "false")
              }
            />
            <span className="font-display uppercase">Saring katalog sesuai kertas aktif</span>
          </label>
        </Group>

        <Group title={copy.operator.settings.event}>
          <Field label="Ambang soft copy (jam)" hint="Pengaman masa aktif link">
            <input
              type="number"
              className={inputClass}
              value={settings["softcopy.maxHours"] ?? "12"}
              onChange={(e) => set("softcopy.maxHours", e.target.value)}
            />
          </Field>
          <Field label="Jeda sambung event (jam)">
            <input
              type="number"
              className={inputClass}
              value={settings["event.gapHours"] ?? "4"}
              onChange={(e) => set("event.gapHours", e.target.value)}
            />
          </Field>
          <Field label="Tutup otomatis (HH:MM)" hint="Opsional">
            <input
              className={inputClass}
              placeholder="21:00"
              value={settings["event.autoCloseAt"] ?? ""}
              onChange={(e) => set("event.autoCloseAt", e.target.value)}
            />
          </Field>
          <Button size="xs" variant="danger" onClick={closeEvent}>
            {copy.operator.event.close}
          </Button>
        </Group>

        <Group title="Tunnel">
          <Field label="Mode">
            <select
              className={inputClass}
              value={settings["tunnel.mode"] ?? "QUICK"}
              onChange={(e) => set("tunnel.mode", e.target.value)}
            >
              <option value="QUICK">Quick Tunnel</option>
              <option value="NAMED">Named Tunnel</option>
            </select>
          </Field>
          <Field label="URL publik" hint="Wajib https">
            <input
              className={inputClass}
              placeholder="https://xxxx.trycloudflare.com"
              value={settings["publicBaseUrl"] ?? ""}
              onChange={(e) => set("publicBaseUrl", e.target.value)}
            />
          </Field>
        </Group>

        <Group title="Kiosk">
          <Field label="Video splash" hint="MP4 H.264 maks 200 MB">
            <input
              type="file"
              accept="video/mp4"
              className={inputClass}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("splash", f);
              }}
            />
          </Field>
        </Group>

        <Group title="Biaya (estimasi keuntungan)">
          <Field label="Biaya per lembar (Rp)">
            <input
              type="number"
              className={inputClass}
              value={settings["cost.perStrip"] ?? ""}
              onChange={(e) => set("cost.perStrip", e.target.value)}
            />
          </Field>
          <Field label="Biaya tetap event (Rp)">
            <input
              type="number"
              className={inputClass}
              value={settings["cost.fixed"] ?? ""}
              onChange={(e) => set("cost.fixed", e.target.value)}
            />
          </Field>
        </Group>

        <Group title={copy.operator.settings.security}>
          <Field label="PIN baru" hint="4–6 digit. Kosongkan bila tidak diubah.">
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ""))}
            />
          </Field>
        </Group>

        <Group title={copy.operator.settings.backup}>
          <p className="text-xs text-ink/70">
            Salinan konsisten database ke <span className="font-mono">storage/backups/</span>.
          </p>
          <Button size="xs" variant="primary" disabled={busy} onClick={backup}>
            {copy.operator.settings.backup}
          </Button>
        </Group>
      </div>
    </div>
  );
}
