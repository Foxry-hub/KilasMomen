"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { copy } from "@/lib/copy.id";
import { COLOR_FILTERS, SHOT_COUNT, type ColorFilter } from "@/lib/constants";
import {
  composeFrame,
  defaultAssignments,
  filterCss,
  loadImage,
  type DrawableImage,
} from "@/features/canvas/composeFrame";
import { cacheBustedPhotoUrl, kioskJson, kioskUpload } from "@/components/kiosk/api";
import { useHeartbeat, useKioskSession } from "@/components/kiosk/hooks";
import { ConnectingOverlay, SessionEndedOverlay } from "@/components/kiosk/ScreenOverlays";

/** slotIndex → shotIndex. */
type AssignmentMap = Record<number, number>;

function toArray(map: AssignmentMap) {
  return Object.entries(map).map(([slotIndex, shotIndex]) => ({
    slotIndex: Number(slotIndex),
    shotIndex,
  }));
}

export default function EditorPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";

  const [ended, setEnded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentMap>({});
  const [filter, setFilter] = useState<ColorFilter>("ORIGINAL");
  const [selectedShot, setSelectedShot] = useState<number | null>(null);
  const [imagesReady, setImagesReady] = useState(false);

  const imagesRef = useRef<Record<number, DrawableImage>>({});
  const overlayRef = useRef<DrawableImage | null>(null);
  const initializedRef = useRef(false);

  const donePath = `/kiosk/session/${sessionId}/done`;

  const { data, connection } = useKioskSession(sessionId, {
    onCancelled: () => setEnded(true),
  });
  useHeartbeat("EDITOR");

  const session = data?.session ?? null;
  const frame = session?.frame ?? null;
  const photos = session?.photos ?? [];
  const photoSignature = photos.map((p) => `${p.url}|${p.capturedAt}`).join("|");

  /* Guard layar: arahkan ke layar yang benar sesuai data (§7.9). */
  useEffect(() => {
    if (!data || !session) return;
    if (!session.frameId) {
      router.replace(`/kiosk/frame/${data.id}`);
      return;
    }
    if (session.hasFinal) {
      router.replace(donePath);
      return;
    }
    if (session.photoCount < SHOT_COUNT) {
      router.replace(`/kiosk/session/${sessionId}/capture`);
    }
  }, [data, session, router, sessionId, donePath]);

  /* Pulihkan penempatan + filter tersimpan, atau pakai default slot i ← foto i+1 (§7.7). */
  useEffect(() => {
    if (!session || initializedRef.current) return;
    initializedRef.current = true;
    setFilter((session.filterChosen as ColorFilter) ?? "ORIGINAL");
    if (session.slotAssignments?.length) {
      const map: AssignmentMap = {};
      for (const a of session.slotAssignments) map[a.slotIndex] = a.shotIndex;
      setAssignments(map);
    } else if (frame) {
      setAssignments(defaultAssignments(frame.slotCount));
    }
  }, [session, frame]);

  /* Muat foto + overlay ke memori untuk pratinjau & render akhir. */
  useEffect(() => {
    if (!frame || photos.length === 0) return;
    let cancelled = false;
    const targetFrame = frame;
    (async () => {
      const next: Record<number, DrawableImage> = {};
      await Promise.all(
        photos.map(async (p) => {
          try {
            next[p.shotIndex] = await loadImage(cacheBustedPhotoUrl(p));
          } catch {
            /* lewati foto yang gagal dimuat */
          }
        })
      );
      let overlay: DrawableImage | null = null;
      try {
        overlay = await loadImage(targetFrame.overlayUrl);
      } catch {
        /* overlay opsional */
      }
      if (cancelled) return;
      imagesRef.current = next;
      overlayRef.current = overlay;
      setImagesReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.id, frame?.overlayUrl, photoSignature]);

  /* Autosave penempatan + filter (§7.7). */
  useEffect(() => {
    if (!initializedRef.current || !sessionId) return;
    const timer = setTimeout(() => {
      kioskJson(`/api/kiosk/sessions/${sessionId}/layout`, {
        method: "PUT",
        body: { slotAssignments: toArray(assignments), filterChosen: filter },
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [assignments, filter, sessionId]);

  const photoByShot = useMemo(() => {
    const map: Record<number, string> = {};
    for (const p of photos) map[p.shotIndex] = cacheBustedPhotoUrl(p);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoSignature]);

  /* Posisi slot dalam persen agar pratinjau tetap proporsional di semua layar. */
  const previewSlots = useMemo(() => {
    if (!frame) return [];
    const cw = frame.canvasWidth || 1;
    const ch = frame.canvasHeight || 1;
    return frame.slots.map((s) => ({
      left: (s.x / cw) * 100,
      top: (s.y / ch) * 100,
      width: (s.w / cw) * 100,
      height: (s.h / ch) * 100,
    }));
  }, [frame]);

  /* Ketuk slot: tanpa pilihan → pilih foto di slot; dengan pilihan → tempatkan/tukar. */
  const tapSlot = useCallback(
    (slotIndex: number) => {
      if (selectedShot == null) {
        const current = assignments[slotIndex];
        if (current != null) setSelectedShot(current);
        return;
      }
      const next = { ...assignments };
      const fromKey = Object.keys(next).find((k) => next[Number(k)] === selectedShot);
      if (fromKey !== undefined) {
        const from = Number(fromKey);
        if (from !== slotIndex) {
          const displaced = assignments[slotIndex];
          if (displaced != null) next[from] = displaced;
          else delete next[from];
        }
      }
      next[slotIndex] = selectedShot;
      setAssignments(next);
      setSelectedShot(null);
    },
    [assignments, selectedShot]
  );

  const togglePhoto = useCallback((shotIndex: number) => {
    setSelectedShot((prev) => (prev === shotIndex ? null : shotIndex));
  }, []);

  /* Render di dimensi asli frame lalu unggah `final.jpg` (§7.8). */
  const finish = useCallback(async () => {
    if (!frame || busy || !imagesReady) return;
    setBusy(true);
    setNotice(null);
    try {
      const canvas = document.createElement("canvas");
      composeFrame(canvas, {
        width: frame.canvasWidth,
        height: frame.canvasHeight,
        slots: frame.slots,
        assignments,
        images: imagesRef.current,
        overlay: overlayRef.current,
        filter,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );
      if (!blob) {
        setNotice(copy.errors.generic);
        setBusy(false);
        return;
      }

      const form = new FormData();
      form.append("file", blob, "final.jpg");
      form.append("filterChosen", filter);
      form.append("slotAssignments", JSON.stringify(toArray(assignments)));
      const res = await kioskUpload(`/api/kiosk/sessions/${sessionId}/finalize`, form);
      if (res.ok) {
        router.replace(donePath);
      } else if (res.status === 409) {
        setEnded(true);
      } else {
        setNotice(res.error ?? copy.errors.generic);
        setBusy(false);
      }
    } catch {
      setNotice(copy.errors.generic);
      setBusy(false);
    }
  }, [frame, busy, imagesReady, assignments, filter, sessionId, router, donePath]);

  const isPortrait = (frame?.canvasHeight ?? 0) >= (frame?.canvasWidth ?? 0);
  const previewSpan = isPortrait ? "lg:col-span-5" : "lg:col-span-7";
  const gridSpan = isPortrait ? "lg:col-span-7" : "lg:col-span-5";
  const previewWidthRatio =
    ((frame?.canvasWidth ?? 4) / (frame?.canvasHeight ?? 3)) * 100;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-4 border-ink bg-brand-yellow p-4 lg:p-5">
        <h1 className="font-display text-2xl uppercase tracking-tight lg:text-3xl">
          {copy.kiosk.editor.title}
        </h1>
        <p className="font-sans text-sm text-ink/80">{copy.kiosk.editor.chooseSlot}</p>
      </header>

      <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4 lg:flex lg:overflow-hidden lg:p-0">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:grid-rows-1">
          {/* Pratinjau frame (kiri) */}
          <section
            className={`${previewSpan} [container-type:size] flex h-[60svh] min-h-0 items-center justify-center overflow-hidden p-6 lg:h-auto lg:p-8`}
          >
            <div
              className="relative max-h-full max-w-full outline outline-4 outline-ink bg-white shadow-brut-lg"
              style={{
                aspectRatio: `${frame?.canvasWidth ?? 4} / ${frame?.canvasHeight ?? 3}`,
                width: `min(100cqw, ${previewWidthRatio}cqh)`,
              }}
            >
              {previewSlots.map((rect, i) => {
                const shot = assignments[i];
                const src = shot != null ? photoByShot[shot] : undefined;
                const isActive = shot != null && shot === selectedShot;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => tapSlot(i)}
                    className={[
                      "absolute z-10 overflow-hidden",
                      isActive ? "z-20 outline outline-4 outline-brand-pink" : "",
                    ].join(" ")}
                    style={{
                      left: `${rect.left}%`,
                      top: `${rect.top}%`,
                      width: `${rect.width}%`,
                      height: `${rect.height}%`,
                    }}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={`Slot ${i + 1}`}
                        className="h-full w-full object-cover"
                        style={{ filter: filterCss(filter) }}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-ink/10 font-display text-3xl text-ink/40">
                        +
                      </span>
                    )}
                  </button>
                );
              })}

              {frame?.overlayUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={frame.overlayUrl}
                  alt=""
                  className="pointer-events-none absolute inset-0 z-30 h-full w-full"
                />
              )}
            </div>
          </section>

          {/* Grid 6 foto + filter (kanan) */}
          <section className={`${gridSpan} flex flex-col gap-4`}>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: SHOT_COUNT }, (_, i) => {
                const n = i + 1;
                const src = photoByShot[n];
                const isSelected = selectedShot === n;
                const used = Object.values(assignments).includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => togglePhoto(n)}
                    className={[
                      "relative aspect-[4/3] overflow-hidden border-4 border-ink shadow-brut-sm transition-transform duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
                      isSelected ? "bg-brand-yellow outline outline-4 outline-brand-pink" : "bg-white",
                    ].join(" ")}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={`Foto ${n}`}
                        className="h-full w-full object-cover"
                        style={{ filter: filterCss(filter) }}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-ink/30">
                        #{n}
                      </span>
                    )}
                    <span className="absolute left-1 top-1 border-2 border-ink bg-white px-1.5 font-mono text-[10px]">
                      #{n}
                    </span>
                    {used && (
                      <span className="absolute right-1 top-1 border-2 border-ink bg-brand-green px-1.5 font-mono text-[10px] uppercase">
                        OK
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div>
              <p className="mb-2 font-display text-lg uppercase">
                {copy.kiosk.editor.filterTitle}
              </p>
              <div className="flex flex-wrap gap-2">
                {COLOR_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={[
                      "border-4 border-ink px-4 py-2 font-display text-sm uppercase shadow-brut-sm transition-transform duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
                      filter === f ? "bg-brand-cyan" : "bg-white",
                    ].join(" ")}
                  >
                    {copy.filter[f]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="shrink-0 border-t-4 border-ink bg-white p-4 lg:p-5">
        {notice && (
          <p className="mb-2 text-center font-display text-sm uppercase text-brand-red">
            {notice}
          </p>
        )}
        <button
          type="button"
          disabled={busy || !imagesReady}
          onClick={finish}
          className="mx-auto block w-full max-w-3xl border-4 border-ink bg-brand-green py-5 font-display text-2xl uppercase shadow-brut-lg transition-transform duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:disabled-stripes disabled:cursor-not-allowed lg:text-3xl"
        >
          {busy ? copy.common.loading : copy.kiosk.editor.finish}
        </button>
      </footer>

      <ConnectingOverlay show={connection === "offline" && !ended} />
      {ended && <SessionEndedOverlay onDone={() => router.replace("/kiosk")} />}
    </div>
  );
}
