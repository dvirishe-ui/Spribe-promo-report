import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Cloud, Database, LayoutDashboard, Loader2, Moon, PencilLine, Plug, RefreshCw, Sun } from "lucide-react";
import { LogoMark, Wordmark } from "./Logo";
import { useTheme } from "@/lib/theme";
import { useData } from "@/lib/store";
import { SOURCE_LABEL } from "@/lib/sources";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/data", label: "Data", icon: PencilLine },
  { to: "/connect", label: "Connect", icon: Plug },
] as const;

function SourcePill() {
  const { config, status, error, refresh, lastSynced } = useData();
  const remote = config.kind !== "manual";
  const Icon = config.kind === "api" ? Cloud : config.kind === "sheet" ? Database : PencilLine;
  return (
    <div className="hidden items-center gap-1.5 lg:flex">
      <Link
        to="/connect"
        title={error ?? (lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}` : undefined)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-surface-raised",
          status === "error" ? "border-bad/50 text-bad-ink" : "border-border text-muted-foreground",
        )}
      >
        {status === "error" ? <AlertTriangle className="size-3.5" /> : <Icon className="size-3.5" />}
        {SOURCE_LABEL[config.kind]}
        {remote && status === "ready" && <span className="size-1.5 rounded-full bg-good" />}
      </Link>
      {remote && (
        <button
          onClick={() => void refresh()}
          aria-label="Refresh data"
          className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground"
        >
          {status === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </button>
      )}
    </div>
  );
}

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();

  const active = (to: string) => (to === "/" ? pathname === "/" || pathname.startsWith("/promo/") : pathname.startsWith(to));

  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <LogoMark className="size-9 shadow-glow rounded-[11px]" />
          <div>
            <Wordmark className="text-sm leading-tight" />
            <p className="text-[11px] text-muted-foreground">Promo Performance Report</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors sm:px-3",
                active(n.to) ? "bg-surface-raised text-foreground" : "hover:text-foreground",
              )}
            >
              <n.icon className="size-4" />
              <span className="hidden sm:inline">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <SourcePill />
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
