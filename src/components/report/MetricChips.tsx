import { useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ChipOption {
  key: string;
  label: string;
  /** What this metric tells you, in a few words */
  hint?: string;
}

/**
 * Pick one or more metrics. The chosen ones sit in the box as chips (× to
 * remove); the dropdown has a search box and every option as a chip with a
 * tick when chosen and a one-line hint explaining what it's for.
 */
export function MetricChips({
  options,
  value,
  onChange,
  max = 4,
  label = "Metrics",
  className,
}: {
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  label?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const chosen = value.map((k) => options.find((o) => o.key === k)).filter((o): o is ChipOption => !!o);
  const shown = options.filter((o) => !q || `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const full = value.length >= max;
  const toggle = (k: string) => {
    if (value.includes(k)) {
      if (value.length > 1) onChange(value.filter((v) => v !== k));
    } else if (!full) onChange([...value, k]);
  };

  return (
    <Popover onOpenChange={(o) => !o && setQ("")}>
      <div
        className={cn(
          "flex min-h-8 min-w-0 max-w-full items-center gap-1 rounded-md border border-border bg-surface py-0.5 pl-1 pr-0.5 transition-colors focus-within:border-primary/60",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {chosen.map((o) => (
            <span key={o.key} className="inline-flex max-w-[11rem] items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium">
              <span className="truncate">{o.label}</span>
              {chosen.length > 1 && (
                <button aria-label={`Remove ${o.label}`} onClick={() => toggle(o.key)} className="press -mr-0.5 rounded-full text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        <PopoverTrigger asChild>
          <button aria-label={`Choose ${label.toLowerCase()}`} className="press grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-surface-raised hover:text-foreground">
            <ChevronDown className="size-4" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {shown.map((o) => {
            const on = value.includes(o.key);
            const disabled = (!on && full) || (on && value.length === 1);
            return (
              <button
                key={o.key}
                onClick={() => toggle(o.key)}
                disabled={!on && full}
                title={on && value.length === 1 ? "Keep at least one" : undefined}
                className={cn("flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-raised disabled:opacity-40", disabled && "cursor-default")}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium", on ? "bg-primary/15 text-foreground" : "bg-surface-raised")}>{o.label}</span>
                  {o.hint && <span className="mt-0.5 block truncate px-1 text-[11px] text-muted-foreground">{o.hint}</span>}
                </span>
                {on && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
          {!shown.length && <p className="px-2 py-4 text-center text-xs text-muted-foreground">No match</p>}
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>
            {value.length} of up to {max} chosen
          </span>
          {value.length > 1 && (
            <button onClick={() => onChange(value.slice(0, 1))} className="hover:text-foreground">
              Keep only first
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
