import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Moon, RefreshCw, Sun } from "lucide-react";
import { LogoMark, Wordmark } from "./Logo";
import { useTheme } from "@/lib/theme";
import { useData } from "@/lib/store";
import { SOURCE_LABEL } from "@/lib/sources";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Reports" },
  { to: "/data", label: "Enter numbers" },
] as const;

/** Only shown when a sheet or the backoffice is connected — manual mode needs no indicator. */
function SyncIndicator() {
  const { config, status, error, refresh } = useData();
  if (config.kind === "manual") return null;
  return (
    <button
      onClick={() => void refresh()}
      title={error ?? "Refresh data"}
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:flex",
        status === "error" ? "border-bad/50 text-bad-ink" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {status === "loading" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : status === "error" ? (
        <AlertTriangle className="size-3.5" />
      ) : (
        <RefreshCw className="size-3.5" />
      )}
      {SOURCE_LABEL[config.kind]}
    </button>
  );
}

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();
  const active = (to: string) => (to === "/" ? pathname === "/" || pathname.startsWith("/promo/") : pathname.startsWith(to));

  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-4 py-3 sm:gap-4 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <LogoMark className="size-9 shadow-glow rounded-[11px]" />
          <div className="hidden sm:block">
            <Wordmark className="text-sm leading-tight" />
            <p className="text-[11px] text-muted-foreground">Promo Reports</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 transition-colors",
                active(n.to) ? "bg-surface-raised text-foreground" : "hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
