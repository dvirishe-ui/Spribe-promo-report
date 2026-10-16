import { useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Clock, Coins, Minus, Table2, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { pct } from "@/lib/format";
import { VERDICT_LABEL, type PromoStatus, type Verdict } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  table,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Optional table view — every chart value stays reachable without hovering. */
  table?: () => ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={cn("panel animate-rise flex min-w-0 flex-col p-4 sm:p-5", className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base leading-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {table && (
            <div className="no-print flex rounded-md border border-border p-0.5">
              <button
                onClick={() => setView("chart")}
                aria-pressed={view === "chart"}
                aria-label="Chart view"
                className={cn("rounded px-1.5 py-1", view === "chart" ? "bg-surface-raised text-foreground" : "text-muted-foreground")}
              >
                <BarChart3 className="size-3.5" />
              </button>
              <button
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
                aria-label="Table view"
                className={cn("rounded px-1.5 py-1", view === "table" ? "bg-surface-raised text-foreground" : "text-muted-foreground")}
              >
                <Table2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="min-w-0 flex-1">{view === "table" && table ? table() : children}</div>
    </section>
  );
}

/** Direction × whether up is good → green/red ink, always with an arrow and a sign. */
export function Delta({ value, suffix, invert = false, className }: { value: number | null; suffix?: string; invert?: boolean; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const flat = Math.abs(value) < 0.005;
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular",
        flat ? "text-muted-foreground" : good ? "text-good-ink" : "text-bad-ink",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {pct(value)}
      {suffix && <span className="ml-1 font-normal text-muted-foreground">{suffix}</span>}
    </span>
  );
}

export function StatTile({
  label,
  value,
  delta,
  deltaSuffix,
  hint,
  icon: Icon,
  trend,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaSuffix?: string;
  hint?: ReactNode;
  icon?: typeof Zap;
  trend?: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("panel animate-rise relative overflow-hidden p-4", className)}>
      {accent && <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />}
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-primary" />}
        <span className="text-eyebrow">{label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {trend}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} />}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

const VERDICT_STYLE: Record<Verdict, { cls: string; icon: typeof Zap }> = {
  strong: { cls: "border-good/40 bg-good/12 text-good-ink", icon: Zap },
  positive: { cls: "border-good/30 bg-good/8 text-good-ink", icon: TrendingUp },
  unprofitable: { cls: "border-accent/40 bg-accent/10 text-accent", icon: Coins },
  flat: { cls: "border-border bg-surface-raised text-muted-foreground", icon: Minus },
  negative: { cls: "border-bad/40 bg-bad/10 text-bad-ink", icon: TrendingDown },
  pending: { cls: "border-border bg-surface-raised text-muted-foreground", icon: Clock },
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const s = VERDICT_STYLE[verdict];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", s.cls, className)}>
      <Icon className="size-3" />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function StatusBadge({ status }: { status: PromoStatus }) {
  if (status === "complete") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "live" ? "border-primary/40 bg-primary/12 text-primary" : "border-border text-muted-foreground",
      )}
    >
      {status === "live" && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
      {status === "live" ? "Live" : "Upcoming"}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: typeof Zap; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-raised">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Small table used by chart table-views. */
export function MiniTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-[360px] overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-raised text-left text-xs text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cn("px-3 py-2 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td key={j} className={cn("px-3 py-1.5", j > 0 && "text-right tabular")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-9 w-full rounded-md border border-border bg-surface-raised px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring disabled:opacity-60";
