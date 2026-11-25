"use client";

import { useCallback, useEffect, useState } from "react";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";
import type { FrameRow, Slot } from "@/lib/operator-types";
import { FramePreview } from "./FramePreview";
import { FrameUploadForm } from "./FrameUploadForm";
import { apiJson } from "./utils";

const CATEGORIES = [
  { value: "TWO", label: "2 Frame (2 slot)" },
  { value: "THREE", label: "3 Frame (3 slot)" },
  { value: "MANY", label: "Frame Banyak (4–6 slot)" },
];

function FrameEditRow({
  frame,
  onSaved,
  onCancel,
}: {
  frame: FrameRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(frame.name);
  const [category, setCategory] = useState(frame.category);
  const [isRecommended, setIsRecommended] = useState(frame.isRecommended);
  const [slots, setSlots] = useState<Slot[]>(frame.slots);
  const [targetSlotCount, setTargetSlotCount] = useState(frame.slotCount >= 4 ? frame.slotCount : 4);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectSlots = async () => {
    setDetecting(true);
    setError(null);
    try {
      const imageResponse = await fetch(frame.overlayUrl);
      if (!imageResponse.ok) throw new Error("Gagal memuat gambar frame");
      const image = await imageResponse.blob();
      const form = new FormData();
      form.append("file", new File([image], `${frame.id}.png`, { type: "image/png" }));
      form.append("category", category);
      if (category === "MANY") form.append("slotCount", String(targetSlotCount));

      const response = await fetch("/api/operator/frames/analyze", {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => ({}))) as {
        slots?: Slot[];
        error?: string;
      };
      if (!response.ok || !Array.isArray(data.slots)) {
        throw new Error(data.error ?? "Gagal mendeteksi slot");
      }
      setSlots(data.slots);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal mendeteksi slot");
    } finally {
      setDetecting(false);
    }
  };

  const alignSlots = () => {
    if (!slots.length) return;
    const commonWidth = Math.max(
      1,
      Math.min(frame.canvasWidth, Math.round(slots.reduce((sum, slot) => sum + slot.w, 0) / slots.length))
    );
    const centerX =
      slots.reduce((sum, slot) => sum + slot.x + slot.w / 2, 0) / slots.length;
    const x = Math.max(0, Math.min(frame.canvasWidth - commonWidth, Math.round(centerX - commonWidth / 2)));
    setSlots(slots.map((slot) => ({ ...slot, x, w: commonWidth })));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const { ok, data } = await apiJson(`/api/operator/frames/${frame.id}`, {
      method: "PATCH",
      body: { name, category, isRecommended, slots, print: frame.print },
    });
    setBusy(false);
    if (!ok) {
      setError((data as { error?: string }).error ?? copy.errors.generic);
      return;
    }
    onSaved();
  };

  return (
    <div className="border-2 border-ink bg-paper p-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FramePreview
          imageUrl={frame.overlayUrl}
          width={frame.canvasWidth}
          height={frame.canvasHeight}
          slots={slots}
          editable
          onChange={setSlots}
        />
        <div className="flex flex-wrap items-center gap-2">
          {category === "MANY" && (
            <label className="flex items-center gap-2 font-display uppercase">
              Slot target
              <select
                className="border-2 border-ink bg-white px-2 py-1"
                value={targetSlotCount}
                onChange={(event) => setTargetSlotCount(Number(event.target.value))}
              >
                {[4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button size="xs" variant="secondary" disabled={detecting || busy} onClick={detectSlots}>
            DETEKSI ULANG SLOT
          </Button>
          <Button
            size="xs"
            variant="secondary"
            disabled={busy || slots.length === 0}
            onClick={alignSlots}
          >
            RATAKAN LEBAR & POSISI X
          </Button>
        </div>
        <div className="flex flex-col gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-display uppercase">Nama</span>
            <input
              className="border-2 border-ink bg-white px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-display uppercase">Kategori</span>
            <select
              className="border-2 border-ink bg-white px-2 py-1.5"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value === "MANY" && frame.slotCount >= 4) {
                  setTargetSlotCount(frame.slotCount);
                }
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRecommended}
              onChange={(e) => setIsRecommended(e.target.checked)}
            />
            <span className="font-display uppercase">{copy.operator.frames.recommend}</span>
          </label>
          {error && <p className="text-brand-red">{error}</p>}
          <div className="flex gap-2">
            <Button size="xs" variant="success" disabled={busy || detecting} onClick={save}>
              {copy.common.save}
            </Button>
            <Button size="xs" variant="secondary" disabled={busy} onClick={onCancel}>
              {copy.common.cancel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Manajemen frame: unggah, analisis, daftar, ubah, nonaktifkan (§6.3.1). */
export function FrameManager() {
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ frames: FrameRow[] }>("/api/operator/frames");
    if (ok) setFrames(data.frames ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const { ok, data } = await apiJson(`/api/operator/frames/${id}`, { method: "PATCH", body });
    if (!ok) {
      setNotice((data as { error?: string }).error ?? copy.errors.generic);
      window.setTimeout(() => setNotice(null), 4000);
      return;
    }
    void load();
  };

  return (
    <div className="scrollbar-brut flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl uppercase">{copy.operator.frames.title}</h2>
        <Button size="sm" variant="primary" onClick={() => setShowUpload((v) => !v)}>
          {showUpload ? copy.common.cancel : copy.operator.frames.upload}
        </Button>
      </div>

      {notice && (
        <p className="border-2 border-ink bg-brand-red px-3 py-1.5 text-xs text-white">{notice}</p>
      )}

      {showUpload && (
        <FrameUploadForm
          onSaved={() => {
            setShowUpload(false);
            void load();
          }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {frames.map((frame) => (
          <article
            key={frame.id}
            className="flex flex-col border-2 border-ink bg-white shadow-brut-sm"
          >
            {editing === frame.id ? (
              <FrameEditRow
                frame={frame}
                onSaved={() => {
                  setEditing(null);
                  void load();
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <div className="flex h-40 items-center justify-center border-b-2 border-ink bg-paper p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frame.thumbnailUrl}
                    alt={frame.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display uppercase">{frame.name}</span>
                    {frame.isRecommended && (
                      <span className="border-2 border-ink bg-brand-yellow px-1 text-[10px] font-display uppercase">
                        Rekomendasi
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-ink/70">
                    {frame.formatLabel} · {frame.slotCount} slot ·{" "}
                    {frame.canvasWidth}×{frame.canvasHeight}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button
                      className={[
                        "border-2 border-ink px-1.5 py-0.5 font-display text-[10px] uppercase",
                        frame.isActive ? "bg-brand-green" : "bg-white",
                      ].join(" ")}
                      onClick={() => patch(frame.id, { isActive: !frame.isActive })}
                    >
                      {copy.operator.frames.active}
                    </button>
                    <button
                      className="border-2 border-ink bg-white px-1.5 py-0.5 font-display text-[10px] uppercase"
                      onClick={() => patch(frame.id, { isRecommended: !frame.isRecommended })}
                    >
                      Rekomendasi
                    </button>
                    <button
                      className="border-2 border-ink bg-brand-cyan px-1.5 py-0.5 font-display text-[10px] uppercase"
                      onClick={() => setEditing(frame.id)}
                    >
                      {copy.common.edit}
                    </button>
                  </div>
                </div>
              </>
            )}
          </article>
        ))}
        {frames.length === 0 && (
          <p className="col-span-full py-10 text-center font-display text-sm text-ink/40">
            Belum ada frame. Unggah PNG transparan untuk memulai.
          </p>
        )}
      </div>
    </div>
  );
}
