import { Link } from "@tanstack/react-router";
import { useData } from "@/lib/store";
import { SOURCE_LABEL } from "@/lib/sources";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Where the numbers on screen come from and how fresh they are. Never claims a
 * Back Office connection that isn't configured.
 */
export function useDataStatus() {
  const { config, status, error, lastSynced, dataset, hasSample } = useData();
  if (status === "error")
    return {
      tone: "bad" as const,
      label: `${SOURCE_LABEL[config.kind]} · sync failed`,
      detail: `${error ?? "Couldn't load the latest numbers."} Showing the last numbers that loaded.`,
    };
  if (config.kind !== "manual")
    return {
      tone: status === "loading" ? ("neutral" as const) : ("good" as const),
      label: status === "loading" ? `${SOURCE_LABEL[config.kind]} · syncing…` : `${SOURCE_LABEL[config.kind]} · synced ${timeAgo(lastSynced)}`,
      detail: `Data generated ${timeAgo(dataset.generatedAt)}.`,
    };
  if (hasSample)
    return {
      tone: "demo" as const,
      label: "Demo data",
      detail: "Fictional promos and numbers. The Back Office connection isn't set up yet.",
    };
  return {
    tone: "neutral" as const,
    label: `Manual entry · edited ${timeAgo(dataset.updatedAt)}`,
    detail: "Numbers typed in or imported on this site. The Back Office connection isn't set up yet.",
  };
}

const DOT: Record<string, string> = {
  good: "bg-good",
  bad: "bg-bad",
  demo: "bg-accent",
  neutral: "bg-muted-foreground",
};

export function DataStatusPill({ className }: { className?: string }) {
  const s = useDataStatus();
  return (
    <Link
      to="/data"
      title={s.detail}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
        s.tone === "bad" && "border-bad/50 text-bad-ink",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[s.tone])} />
      {s.label}
    </Link>
  );
}
