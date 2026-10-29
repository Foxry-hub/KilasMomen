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
  const boxRef = useRef<HTMLDivElement>(null);
  const [dispW, setDispW] = useState(0);
  const drag = useRef<DragState | null>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setDispW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width > 0 ? dispW / width : 0;
  const minSide = MIN_SIDE_RATIO * Math.min(width, height);

  const clamp = (s: Slot): Slot => {
    const w = Math.max(minSide, Math.min(s.w, width));
    const h = Math.max(minSide, Math.min(s.h, height));
    const x = Math.max(0, Math.min(s.x, width - w));
    const y = Math.max(0, Math.min(s.y, height - h));
    return { x, y, w, h };
  };

  const begin = (e: React.PointerEvent, index: number, mode: DragState["mode"]) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
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
    if (!d || scale === 0 || !onChange) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
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
      ref={boxRef}
      className="relative w-full select-none border-4 border-ink bg-[repeating-conic-gradient(#e5e5e5_0_25%,#ffffff_0_50%)] bg-[length:20px_20px]"
      style={{ aspectRatio: `${width} / ${height}`, maxHeight: "60svh" }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Overlay frame" className="h-full w-full object-contain" />
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
              left: s.x * scale,
              top: s.y * scale,
              width: s.w * scale,
              height: s.h * scale,
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
  );
}
