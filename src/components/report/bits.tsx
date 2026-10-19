import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Zap } from "lucide-react";
import { pct } from "@/lib/format";
import { STATUS_LABEL, type PromoStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/** Same quiet card the Promo Calendar uses for its stats. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  info,
}: {
  icon: typeof Zap;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** One-line definition, shown on hover */
  info?: string;
}) {
  return (
    <div className="panel p-3.5" title={info}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-eyebrow">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A % change with an arrow, green when up and red when down. */
export function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const flat = Math.abs(value) < 0.005;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular",
        flat ? "text-muted-foreground" : value > 0 ? "text-good-ink" : "text-bad-ink",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {pct(value)}
    </span>
  );
}

/** The one-glance result of a promo: GGR during vs before. */
export function ResultPill({ value, className }: { value: number | null; className?: string }) {
  if (value == null)
    return (
      <span className={cn("inline-flex rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground", className)}>
        No data yet
      </span>
    );
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular",
        up ? "border-good/30 bg-good/10 text-good-ink" : "border-bad/30 bg-bad/10 text-bad-ink",
        className,
      )}
    >
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {pct(value)}
    </span>
  );
}

const STATUS_STYLE: Record<PromoStatus, string> = {
  upcoming: "border-border text-muted-foreground",
  live: "border-primary/40 bg-primary/10 text-primary",
  measuring: "border-accent/40 bg-accent/10 text-accent",
  complete: "border-border bg-surface-raised text-muted-foreground",
};

const STATUS_HINT: Record<PromoStatus, string> = {
  upcoming: "Hasn't started yet",
  live: "Running now — numbers are so far",
  measuring: "Ended — the after period is still running, so results aren't final",
  complete: "Ended and fully measured",
};

export function StatusBadge({ status, className }: { status: PromoStatus; className?: string }) {
  return (
    <span
      title={STATUS_HINT[status]}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", STATUS_STYLE[status], className)}
    >
      {status === "live" && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Kept for places that only care about live promos. */
export function LiveBadge({ status }: { status: PromoStatus }) {
  return status === "live" ? <StatusBadge status={status} /> : null;
}

/** The headline change, marked when it is adjusted for the market trend. */
export function ChangePill({
  value,
  adjusted,
  className,
  compact = false,
}: {
  value: number | null;
  adjusted: boolean;
  className?: string;
  /** Hide the adj./raw label on phones (still in the tooltip) */
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <ResultPill value={value} />
      {value != null && (
        <span
          title={adjusted ? "Adjusted for the market trend with a comparison group" : "Before vs during only — not adjusted for the market trend"}
          className={cn("text-[10px] font-medium uppercase tracking-wide", adjusted ? "text-good-ink" : "text-muted-foreground", compact && "hidden sm:inline")}
        >
          {adjusted ? "adj." : "raw"}
        </span>
      )}
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
