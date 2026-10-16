/**
 * Markets the report knows about — the same list (and flags) as the Promo
 * Calendar's market suggestions, plus their usual operator currency. Any other
 * market can still be typed in; it just won't get a flag or a default currency.
 */
export interface MarketInfo {
  name: string;
  flag: string;
  region: "LATAM" | "Africa" | "Europe" | "Asia";
  currency: string;
}

export const MARKETS: MarketInfo[] = [
  { name: "Argentina", flag: "🇦🇷", region: "LATAM", currency: "ARS" },
  { name: "Brazil", flag: "🇧🇷", region: "LATAM", currency: "BRL" },
  { name: "Chile", flag: "🇨🇱", region: "LATAM", currency: "CLP" },
  { name: "Colombia", flag: "🇨🇴", region: "LATAM", currency: "COP" },
  { name: "Mexico", flag: "🇲🇽", region: "LATAM", currency: "MXN" },
  { name: "Peru", flag: "🇵🇪", region: "LATAM", currency: "PEN" },
  { name: "Congo (DRC)", flag: "🇨🇩", region: "Africa", currency: "USD" },
  { name: "Kenya", flag: "🇰🇪", region: "Africa", currency: "KES" },
  { name: "Mozambique", flag: "🇲🇿", region: "Africa", currency: "MZN" },
  { name: "Nigeria", flag: "🇳🇬", region: "Africa", currency: "NGN" },
  { name: "South Africa", flag: "🇿🇦", region: "Africa", currency: "ZAR" },
  { name: "Tanzania", flag: "🇹🇿", region: "Africa", currency: "TZS" },
  { name: "Uganda", flag: "🇺🇬", region: "Africa", currency: "UGX" },
  { name: "Bulgaria", flag: "🇧🇬", region: "Europe", currency: "EUR" },
  { name: "Germany", flag: "🇩🇪", region: "Europe", currency: "EUR" },
  { name: "Italy", flag: "🇮🇹", region: "Europe", currency: "EUR" },
  { name: "Romania", flag: "🇷🇴", region: "Europe", currency: "RON" },
  { name: "Spain", flag: "🇪🇸", region: "Europe", currency: "EUR" },
  { name: "United Kingdom", flag: "🇬🇧", region: "Europe", currency: "GBP" },
  { name: "Bangladesh", flag: "🇧🇩", region: "Asia", currency: "BDT" },
  { name: "India", flag: "🇮🇳", region: "Asia", currency: "INR" },
  { name: "Indonesia", flag: "🇮🇩", region: "Asia", currency: "IDR" },
  { name: "Philippines", flag: "🇵🇭", region: "Asia", currency: "PHP" },
  { name: "Vietnam", flag: "🇻🇳", region: "Asia", currency: "VND" },
];

const byName = new Map(MARKETS.map((m) => [m.name.toLowerCase(), m]));

export function marketInfo(name: string): MarketInfo | undefined {
  return byName.get(name.trim().toLowerCase());
}

export function flagFor(name: string): string {
  return marketInfo(name)?.flag ?? "";
}

/** "🇧🇷 Brazil", or just the name when the market isn't in the list. */
export function marketLabel(name: string): string {
  const f = flagFor(name);
  return f ? `${f} ${name}` : name;
}
