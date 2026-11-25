"use client";

import { useEffect, useRef, useState } from "react";
import type { Slot } from "@/lib/operator-types";

interface Props {
  imageUrl: string;
  width: number;
  height: number;
  slots: Slot[];
  editable?: boolean;
  onChange?: (slots: Slot[]) => void;
}

interface DragState {
  index: number;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origin: Slot;
}

const MIN_SIDE_RATIO = 0.05; // 5% sisi terpendek (§6.3.1)

/** Pratinjau overlay + penyesuaian slot di browser operator (§6.3.1). */
export function FramePreview({ imageUrl, width, height, slots, editable, onChange }: Props) {
  const boundsRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const drag = useRef<DragState | null>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = boundsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        setBounds({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale =
    width > 0 && height > 0
      ? Math.min(bounds.width / width, bounds.height / height)
      : 0;
  const minSide = Math.ceil(MIN_SIDE_RATIO * Math.min(width, height));

  const clamp = (s: Slot): Slot => {
    const w = Math.round(Math.max(minSide, Math.min(s.w, width)));
    const h = Math.round(Math.max(minSide, Math.min(s.h, height)));
    const x = Math.round(Math.max(0, Math.min(s.x, width - w)));
    const y = Math.round(Math.max(0, Math.min(s.y, height - h)));
    return { x, y, w, h };
  };

  const begin = (e: React.PointerEvent, index: number, mode: DragState["mode"]) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    boxRef.current?.setPointerCapture(e.pointerId);
    drag.current = {
      index,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...slots[index] },
    };
    setActive(index);
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!d || !rect || rect.width === 0 || rect.height === 0 || !onChange) return;
    const dx = ((e.clientX - d.startX) * width) / rect.width;
    const dy = ((e.clientY - d.startY) * height) / rect.height;
    const next = slots.map((s, i) => {
      if (i !== d.index) return s;
      if (d.mode === "move") {
        return clamp({ ...d.origin, x: d.origin.x + dx, y: d.origin.y + dy });
      }
      return clamp({ ...d.origin, w: d.origin.w + dx, h: d.origin.h + dy });
    });
    onChange(next);
  };

  const end = () => {
    drag.current = null;
    setActive(null);
  };

  return (
    <div
      ref={boundsRef}
      className={[
        "flex w-full items-center justify-center",
        editable ? "h-[min(70svh,520px)] min-h-[420px]" : "h-[60svh] max-h-[60svh]",
      ].join(" ")}
    >
      <div
        ref={boxRef}
        className="relative shrink-0 select-none touch-none outline outline-4 outline-ink bg-[repeating-conic-gradient(#e5e5e5_0_25%,#ffffff_0_50%)] bg-[length:20px_20px]"
        style={{ aspectRatio: `${width} / ${height}`, width: width * scale, height: height * scale }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Overlay frame" className="absolute inset-0 h-full w-full object-contain" />
        {scale > 0 &&
          slots.map((s, i) => (
            <div
              key={i}
              className={[
                "absolute border-2 border-brand-red bg-brand-red/10",
                editable ? "cursor-move" : "",
                active === i ? "border-brand-cyan bg-brand-cyan/20" : "",
              ].join(" ")}
              style={{
                left: `${(s.x / width) * 100}%`,
                top: `${(s.y / height) * 100}%`,
                width: `${(s.w / width) * 100}%`,
                height: `${(s.h / height) * 100}%`,
              }}
              onPointerDown={(e) => begin(e, i, "move")}
            >
              <span className="absolute left-0 top-0 bg-brand-red px-1 font-mono text-[10px] text-white">
                {i + 1}
              </span>
              {editable && (
                <span
                  className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize border-2 border-ink bg-brand-cyan"
                  onPointerDown={(e) => begin(e, i, "resize")}
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
