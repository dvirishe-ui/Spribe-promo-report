import { linear } from "./core";

/** Tiny trend line for stat tiles: de-emphasised history, the latest point in the accent. */
export function Sparkline({
  values,
  width = 96,
  height = 30,
  color = "var(--color-primary)",
}: {
  values: Array<number | null>;
  width?: number;
  height?: number;
  color?: string;
}) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return null;
  const vs = pts.map((p) => p[1]);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const x = linear(0, values.length - 1, 3, width - 5);
  const y = linear(min, max === min ? min + 1 : max, height - 4, 4);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0])},${y(p[1])}`).join("");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke="var(--color-muted-foreground)" strokeOpacity={0.6} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(last[0])} cy={y(last[1])} r={3.5} fill={color} stroke="var(--viz-surface)" strokeWidth={1.5} />
    </svg>
  );
}
