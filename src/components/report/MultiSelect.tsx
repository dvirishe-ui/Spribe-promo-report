import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Compact dropdown with a search box and checkboxes. The trigger shows the
 * single chosen value, or a count when several are chosen.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  display = (o) => o,
  className,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  display?: (o: string) => string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const shown = options.filter((o) => !q || display(o).toLowerCase().includes(q.toLowerCase()));
  const active = value.length > 0;
  return (
    <Popover onOpenChange={(o) => !o && setQ("")}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "press inline-flex h-8 max-w-[11rem] items-center gap-1.5 rounded-md border px-2.5 text-xs",
            active ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          <span className="truncate">{active ? (value.length === 1 ? display(value[0]) : `${label} · ${value.length}`) : label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1.5">
        {options.length > 6 && (
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
              className="h-8 w-full rounded-md border border-border bg-surface-raised pl-7 pr-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto">
          {shown.map((o) => {
            const on = value.includes(o);
            return (
              <button
                key={o}
                onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface-raised"
              >
                <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {on && <Check className="size-3" />}
                </span>
                <span className="truncate">{display(o)}</span>
              </button>
            );
          })}
          {!shown.length && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No match</p>}
        </div>
        {active && (
          <button onClick={() => onChange([])} className="mt-1 w-full rounded border-t border-border px-2 pt-1.5 text-left text-xs text-muted-foreground hover:text-foreground">
            Clear {label.toLowerCase()}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
