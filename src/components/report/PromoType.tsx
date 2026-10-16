import { Boxes, Crown, Gift, ListChecks, Map as MapIcon, Rocket, Sparkles, Tag, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Promotion-type colours and icons, the same ones the Promo Calendar uses. */
const TYPE_STYLE: Record<string, { color: string; icon: typeof Trophy }> = {
  "Network Tournament": { color: "var(--type-tournament)", icon: Trophy },
  "Cross-Game Challenge": { color: "var(--type-crossgame)", icon: Boxes },
  Missions: { color: "var(--type-missions)", icon: ListChecks },
  Leaderboard: { color: "var(--type-leaderboard)", icon: Crown },
  "Collection Campaign": { color: "var(--type-collection)", icon: Gift },
  "Regional Promotion": { color: "var(--type-regional)", icon: MapIcon },
  "Seasonal Promotion": { color: "var(--type-seasonal)", icon: Sparkles },
  "New Game Launch": { color: "var(--type-launch)", icon: Rocket },
};

export function typeStyle(type: string) {
  return TYPE_STYLE[type] ?? { color: "var(--color-muted-foreground)", icon: Tag };
}

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  const { color, icon: Icon } = typeStyle(type);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap", className)}
      style={{
        color,
        borderColor: `color-mix(in oklch, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
      }}
    >
      <Icon className="size-3" />
      {type}
    </span>
  );
}

/**
 * Campaign banner as on the Promo Calendar: real artwork when there is some,
 * otherwise a poster in the type's colour with its icon as a watermark.
 */
export function TypeBanner({ type, name, prize, image, className }: { type: string; name: string; prize?: string; image?: string; className?: string }) {
  if (image) return <img src={image} alt={`${name} campaign banner`} className={cn("object-cover", className)} />;
  const { color, icon: Icon } = typeStyle(type);
  return (
    <div
      className={cn("relative flex items-end overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 140% at 100% -10%, color-mix(in oklch, ${color} 45%, transparent), transparent 60%),
          linear-gradient(135deg, color-mix(in oklch, ${color} 16%, var(--color-surface)), var(--color-surface) 70%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle, color-mix(in oklch, ${color} 70%, transparent) 1.4px, transparent 1.4px)`,
          backgroundSize: "16px 16px",
          maskImage: "linear-gradient(135deg, black, transparent 72%)",
          WebkitMaskImage: "linear-gradient(135deg, black, transparent 72%)",
        }}
      />
      <Icon className="pointer-events-none absolute -right-4 -top-6 size-28 rotate-12 opacity-[0.14] sm:size-36" style={{ color }} />
      <div className="relative z-10 flex w-full items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-eyebrow truncate" style={{ color }}>
            {type}
          </p>
          <p className="truncate font-display text-lg font-semibold sm:text-xl">{name}</p>
        </div>
        {prize && (
          <p className="shrink-0 font-display text-lg font-bold sm:text-2xl" style={{ color }}>
            {prize}
          </p>
        )}
      </div>
    </div>
  );
}
