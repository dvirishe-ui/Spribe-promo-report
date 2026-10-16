import spribeMark from "@/assets/spribe-mark.png";

/**
 * SPRIBE's actual corporate mark (the halftone dot circle), cropped and
 * alpha-keyed from the reference image supplied by the user. Deliberately
 * excludes the "Aviator" airplane graphic from that same source image —
 * that's a separate mark under active third-party trademark litigation
 * (Aviator LLC v. SPRIBE), while this dot mark is SPRIBE's own corporate
 * logo, used here to identify a partner tool for a SPRIBE operator.
 */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[11px] border border-primary/40 bg-[#1c1712] ${className}`}
    >
      <img src={spribeMark} alt="SPRIBE" className="h-[72%] w-[72%] object-contain" />
    </span>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      SPRIBE<span className="text-primary">.</span>
    </span>
  );
}
