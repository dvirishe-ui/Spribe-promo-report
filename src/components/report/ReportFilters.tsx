import { RotateCcw, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { marketLabel } from "@/lib/markets";
import type { PromoMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export interface FilterState {
  q: string;
  market: string;
  aggregator: string;
  operator: string;
  type: string;
  game: string;
}

export const emptyFilters: FilterState = { q: "", market: "all", aggregator: "all", operator: "all", type: "all", game: "all" };

export function applyFilters(list: PromoMetrics[], f: FilterState): PromoMetrics[] {
  const q = f.q.trim().toLowerCase();
  return list.filter(({ promo: p }) => {
    if (f.market !== "all" && p.market !== f.market) return false;
    if (f.aggregator !== "all" && (p.aggregator || "—") !== f.aggregator) return false;
    if (f.operator !== "all" && p.operator !== f.operator) return false;
    if (f.type !== "all" && p.type !== f.type) return false;
    if (f.game !== "all" && !p.games.includes(f.game)) return false;
    if (q && ![p.name, p.operator, p.aggregator, p.market, p.type, ...p.games].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
}

export function filterCount(f: FilterState): number {
  return (f.q.trim() ? 1 : 0) + (["market", "aggregator", "operator", "type", "game"] as const).filter((k) => f[k] !== "all").length;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  display = (o) => o,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  display?: (o: string) => string;
}) {
  return (
    <div>
      <div className="text-eyebrow mb-1.5">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn("h-9 w-full bg-surface-raised text-sm", value !== "all" && "border-primary/60")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {display(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Sidebar filters, same look as the Promo Calendar's. */
export function ReportFilters({
  filters,
  onChange,
  all,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  /** Every promo (unfiltered), to build the option lists */
  all: PromoMetrics[];
}) {
  const set = (k: keyof FilterState) => (v: string) => onChange({ ...filters, [k]: v });
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const promos = all.map((m) => m.promo);

  return (
    <div className="panel space-y-3 p-4">
      <p className="text-eyebrow">Filters</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label="Search promos"
          className="h-9 w-full rounded-md border border-border bg-surface-raised pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring"
          placeholder="Search"
          value={filters.q}
          onChange={(e) => set("q")(e.target.value)}
        />
      </div>
      <FilterSelect label="Market" value={filters.market} options={uniq(promos.map((p) => p.market))} onChange={set("market")} display={marketLabel} />
      <FilterSelect label="Aggregator" value={filters.aggregator} options={uniq(promos.map((p) => p.aggregator || "—"))} onChange={set("aggregator")} />
      <FilterSelect label="Operator" value={filters.operator} options={uniq(promos.map((p) => p.operator))} onChange={set("operator")} />
      <FilterSelect label="Promotion type" value={filters.type} options={uniq(promos.map((p) => p.type))} onChange={set("type")} />
      <FilterSelect label="Game" value={filters.game} options={uniq(promos.flatMap((p) => p.games))} onChange={set("game")} />
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground hover:text-foreground"
        disabled={filterCount(filters) === 0}
        onClick={() => onChange(emptyFilters)}
      >
        <RotateCcw className="mr-1.5 size-3.5" /> Reset
      </Button>
    </div>
  );
}
