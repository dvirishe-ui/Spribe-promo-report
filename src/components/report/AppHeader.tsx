import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, BookOpen, Check, Database, Loader2, Menu, Moon, RefreshCw, ShieldCheck, Sun } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LogoMark, Wordmark } from "./Logo";
import { DefinitionsDialog } from "./DefinitionsDialog";
import { AskPanel } from "./AskPanel";
import { useTheme } from "@/lib/theme";
import { useData } from "@/lib/store";
import { SOURCE_LABEL } from "@/lib/sources";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/explore", label: "Explore" },
  { to: "/calendar", label: "Calendar" },
] as const;

function SyncIndicator() {
  const { config, status, error, refresh } = useData();
  if (config.kind === "manual") return null;
  return (
    <button
      onClick={() => void refresh()}
      title={error ?? "Refresh data"}
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs xl:flex",
        status === "error" ? "border-bad/50 text-bad-ink" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {status === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : status === "error" ? <AlertTriangle className="size-3.5" /> : <RefreshCw className="size-3.5" />}
      {SOURCE_LABEL[config.kind]}
    </button>
  );
}

/** Admin and reference items, kept out of the main navigation. */
function SecondaryMenu() {
  const { accessOperator, setAccessOperator, allOperators } = useData();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button aria-label="More" className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground">
          <Menu className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1.5">
        <Link to="/data" onClick={() => setOpen(false)} className="flex items-start gap-2.5 rounded-md px-2.5 py-2 hover:bg-surface-raised">
          <Database className="mt-0.5 size-4 text-muted-foreground" />
          <span>
            <span className="block text-sm">Data & Back Office</span>
            <span className="block text-[11px] text-muted-foreground">Sync status, import, manual entry, settings</span>
          </span>
        </Link>
        <DefinitionsDialog>
          <button className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-raised">
            <BookOpen className="mt-0.5 size-4 text-muted-foreground" />
            <span>
              <span className="block text-sm">How numbers are calculated</span>
              <span className="block text-[11px] text-muted-foreground">Definitions, periods, currencies</span>
            </span>
          </button>
        </DefinitionsDialog>
        <div className="mt-1 border-t border-border px-2.5 pb-1 pt-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <ShieldCheck className="size-3.5 text-muted-foreground" /> View as (access preview)
          </p>
          <p className="mb-1.5 text-[11px] text-muted-foreground">What an operator-restricted login would see. Real restrictions are enforced by the Back Office.</p>
          <div className="max-h-48 overflow-y-auto">
            {[null, ...allOperators].map((op) => (
              <button
                key={op ?? "all"}
                onClick={() => {
                  setAccessOperator(op);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-surface-raised"
              >
                {op ?? "SPRIBE internal — all operators"}
                {accessOperator === op && <Check className="size-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();
  const active = (to: string) =>
    to === "/" ? pathname === "/" : to === "/explore" ? pathname.startsWith("/explore") || pathname.startsWith("/promo/") : pathname.startsWith(to);

  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 px-4 py-3 sm:gap-4 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <LogoMark className="size-9 shadow-glow rounded-[11px]" />
          <div className="hidden xl:block">
            <Wordmark className="text-sm leading-tight" />
            <p className="text-[11px] text-muted-foreground">Promo Intelligence</p>
          </div>
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm text-muted-foreground">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors sm:px-3",
                active(n.to) ? "bg-surface-raised text-foreground" : "hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <SyncIndicator />
          <AskPanel />
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="hidden size-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground sm:grid"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <SecondaryMenu />
        </div>
      </div>
    </header>
  );
}
