import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Width of an element, tracked with ResizeObserver, so SVG charts are crisp at any size. */
export function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

export function linear(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** Round, human tick values ("nice numbers") covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    if (min === 0) return [0, 1];
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  const span = max - min;
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return ticks;
}

/** Path for a column whose data-end is rounded (4px) and whose baseline end is square. */
export function columnPath(x: number, w: number, yBase: number, yEnd: number, r = 4): string {
  const h = Math.abs(yEnd - yBase);
  const rr = Math.min(r, w / 2, h);
  if (h < 0.5) return "";
  if (yEnd <= yBase) {
    // grows up
    return `M${x},${yBase}V${yEnd + rr}Q${x},${yEnd} ${x + rr},${yEnd}H${x + w - rr}Q${x + w},${yEnd} ${x + w},${yEnd + rr}V${yBase}Z`;
  }
  // grows down (negative)
  return `M${x},${yBase}V${yEnd - rr}Q${x},${yEnd} ${x + rr},${yEnd}H${x + w - rr}Q${x + w},${yEnd} ${x + w},${yEnd - rr}V${yBase}Z`;
}

/** Same as columnPath but for horizontal bars: rounded at the data end, square at the zero line. */
export function barPath(xBase: number, xEnd: number, y: number, h: number, r = 4): string {
  const w = Math.abs(xEnd - xBase);
  const rr = Math.min(r, h / 2, w);
  if (w < 0.5) return "";
  if (xEnd >= xBase) {
    return `M${xBase},${y}H${xEnd - rr}Q${xEnd},${y} ${xEnd},${y + rr}V${y + h - rr}Q${xEnd},${y + h} ${xEnd - rr},${y + h}H${xBase}Z`;
  }
  return `M${xBase},${y}H${xEnd + rr}Q${xEnd},${y} ${xEnd},${y + rr}V${y + h - rr}Q${xEnd},${y + h} ${xEnd + rr},${y + h}H${xBase}Z`;
}

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

/** Floating tooltip positioned inside the chart's relative container, flipped to stay in view. */
export function Tooltip({ tip, width }: { tip: TipState | null; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width * 0.62;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-40 max-w-72 rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-panel backdrop-blur"
      style={{
        left: flip ? undefined : tip.x + 14,
        right: flip ? width - tip.x + 14 : undefined,
        top: Math.max(0, tip.y - 12),
      }}
    >
      {tip.content}
    </div>
  );
}

export function TipRow({ color, label, value, strong }: { color?: string; label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {color && <span className="size-2 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className={cn("tabular", strong ? "font-semibold text-foreground" : "text-foreground")}>{value}</span>
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  shape?: "square" | "dot" | "line";
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {it.shape === "line" ? (
            <span className="h-0.5 w-4 rounded-full" style={{ background: it.color }} />
          ) : (
            <span
              className={cn("size-2.5", it.shape === "dot" ? "rounded-full" : "rounded-[3px]")}
              style={{ background: it.color }}
            />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Truncate a label to fit roughly `px` pixels at ~6.2px per character (11px UI sans). */
export function fit(label: string, px: number, charPx = 6.2): string {
  const max = Math.max(3, Math.floor(px / charPx));
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export const PHASE_COLORS = {
  before: "var(--series-before)",
  during: "var(--series-during)",
  after: "var(--series-after)",
} as const;

export const PHASES = [
  { key: "before", label: "Before", color: PHASE_COLORS.before },
  { key: "during", label: "During", color: PHASE_COLORS.during },
  { key: "after", label: "After", color: PHASE_COLORS.after },
] as const;
