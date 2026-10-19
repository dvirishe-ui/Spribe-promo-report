import type { Share2 } from "lucide-react";

/** A row in an export / actions popover: icon, label and a one-line hint. */
export function MenuItem({ icon: Icon, label, hint, onClick }: { icon: typeof Share2; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-raised">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
