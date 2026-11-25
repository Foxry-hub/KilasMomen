"use client";

import { useEffect, useMemo, useState } from "react";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";
import type { FrameRow, PrintProfileConfig, Slot } from "@/lib/operator-types";
import { FramePreview } from "./FramePreview";

interface Suggestion {
  dpi: number;
  paper: string;
  widthIn: number;
  heightIn: number;
  fit: "CONTAIN" | "COVER";
  effectiveDpi: number;
  upscale: boolean;
  warnings: string[];
}

interface Analysis {
  width: number;
  height: number;
  ratio: number;
  orientation: "PORTRAIT" | "LANDSCAPE" | "SQUARE";
  megapixels: number;
  slots: Slot[];
  warnings: string[];
  printSuggestion: Suggestion;
  effectiveDpi: number;
  upscale: boolean;
}

const CATEGORIES = [
  { value: "TWO", label: "2 Frame", count: "2 slot" },
  { value: "THREE", label: "3 Frame", count: "3 slot" },
  { value: "MANY", label: "Frame Banyak", count: "4–6 slot" },
] as const;

function suggestCategory(slotCount: number): string {
  if (slotCount === 2) return "TWO";
  if (slotCount === 3) return "THREE";
  return "MANY";
}

export function FrameUploadForm({
  onSaved,
  onCancel,
}: {
  onSaved: (frame: FrameRow) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("TWO");
  const [manySlotCount, setManySlotCount] = useState(4);
  const [isRecommended, setIsRecommended] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const analyzeFile = async (
    target: File,
    targetCategory: string,
    targetSlotCount: number,
    suggestCategoryFromResult: boolean
  ) => {
    const form = new FormData();
    form.append("file", target);
    form.append("category", targetCategory);
    if (targetCategory === "MANY") form.append("slotCount", String(targetSlotCount));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/operator/frames/analyze", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as Analysis & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menganalisis berkas");
      setAnalysis(data);
      setSlots(data.slots ?? []);
      if (suggestCategoryFromResult) {
        const suggested = suggestCategory((data.slots ?? []).length);
        setCategory(suggested);
        if (suggested === "MANY" && (data.slots?.length ?? 0) >= 4) {
          setManySlotCount(Math.min(6, data.slots!.length));
        }
      }
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal menganalisis berkas");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (next: File) => {
    setError(null);
    setAnalysis(null);
    setFile(next);
    const success = await analyzeFile(next, category, manySlotCount, true);
    if (success && !name) setName(next.name.replace(/\.png$/i, "").slice(0, 40));
  };

  const printProfile: PrintProfileConfig | null = useMemo(() => {
    if (!analysis) return null;
    const s = analysis.printSuggestion;
    return { dpi: s.dpi, paper: s.paper, widthIn: s.widthIn, heightIn: s.heightIn, fit: s.fit };
  }, [analysis]);

  const save = async () => {
    if (!file || !analysis) return;
    if (!name.trim()) {
      setError("Nama frame wajib diisi");
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("name", name.trim());
    form.append("category", category);
    form.append("isRecommended", isRecommended ? "true" : "false");
    form.append("slots", JSON.stringify(slots));
    if (printProfile) form.append("print", JSON.stringify(printProfile));
    const res = await fetch("/api/operator/frames", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as FrameRow & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal menyimpan frame");
      return;
    }
    onSaved(data);
  };

  return (
    <div className="border-4 border-ink bg-paper p-3 shadow-brut">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg uppercase">{copy.operator.frames.upload}</h3>
        <button onClick={onCancel} className="font-display text-xs uppercase underline">
          {copy.common.cancel}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-display uppercase">Berkas PNG</span>
            <input
              type="file"
              accept="image/png"
              className="border-2 border-ink bg-white p-1 text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
              }}
            />
            <span className="text-ink/60">{copy.operator.frames.uploadHint}</span>
          </label>

          {imageUrl && analysis && (
            <>
              <FramePreview
                imageUrl={imageUrl}
                width={analysis.width}
                height={analysis.height}
                slots={slots}
                editable
                onChange={setSlots}
              />
              <Button
                size="xs"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (file) void analyzeFile(file, category, manySlotCount, false);
                }}
              >
                DETEKSI ULANG SLOT
              </Button>
            </>
          )}
          {busy && !analysis && <p className="text-xs">{copy.common.loading}</p>}
        </div>

        <div className="flex flex-col gap-2 text-xs">
          {analysis && (
            <>
              <dl className="grid grid-cols-2 gap-1 border-2 border-ink bg-white p-2">
                <dt className="font-display uppercase">Dimensi</dt>
                <dd className="font-mono">
                  {analysis.width}×{analysis.height} px
                </dd>
                <dt className="font-display uppercase">Orientasi</dt>
                <dd>{analysis.orientation}</dd>
                <dt className="font-display uppercase">Megapiksel</dt>
                <dd className="font-mono">{analysis.megapixels.toFixed(1)} MP</dd>
                <dt className="font-display uppercase">Slot terdeteksi</dt>
                <dd className="font-mono">{analysis.slots.length}</dd>
                <dt className="font-display uppercase">Profil cetak</dt>
                <dd className="font-mono">
                  {analysis.printSuggestion.paper} · {analysis.printSuggestion.widthIn}×
                  {analysis.printSuggestion.heightIn} in
                </dd>
                <dt className="font-display uppercase">DPI efektif</dt>
                <dd className="font-mono">{Math.round(analysis.effectiveDpi)}</dd>
              </dl>

              {analysis.upscale && (
                <p className="border-2 border-ink bg-brand-yellow px-2 py-1">
                  {copy.operator.frames.dpiWarn} — foto kamera akan di-upscale.
                </p>
              )}
              {analysis.warnings.map((w, i) => (
                <p key={i} className="border-2 border-ink bg-brand-red px-2 py-1 text-white">
                  {w}
                </p>
              ))}
            </>
          )}

          <label className="flex flex-col gap-1">
            <span className="font-display uppercase">Nama</span>
            <input
              className="border-2 border-ink bg-white px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-display uppercase">Kategori</span>
            <select
              className="border-2 border-ink bg-white px-2 py-1.5"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} ({c.count})
                </option>
              ))}
            </select>
          </label>
          {category === "MANY" && (
            <label className="flex flex-col gap-1">
              <span className="font-display uppercase">Jumlah slot target</span>
              <select
                className="border-2 border-ink bg-white px-2 py-1.5"
                value={manySlotCount}
                onChange={(event) => setManySlotCount(Number(event.target.value))}
              >
                {[4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    {count} slot
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRecommended}
              onChange={(e) => setIsRecommended(e.target.checked)}
            />
            <span className="font-display uppercase">{copy.operator.frames.recommend}</span>
          </label>

          {error && <p className="text-brand-red">{error}</p>}

          <Button
            size="sm"
            variant="success"
            disabled={!analysis || busy}
            onClick={save}
          >
            {copy.operator.frames.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
