const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Score as shown on tiles and the game-over card: "12,345", "250 ms", "0.07 s", "93.4%". */
export function fmtScore(v: number, unit?: string): string {
  const n = Number.isInteger(v) ? int.format(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1);
  if (!unit) return n;
  return unit === '%' ? `${n}%` : `${n} ${unit}`;
}

/** Total play time for the "boredom killed" line. */
export function fmtDuration(ms: number): string {
  if (ms <= 0) return '0 min';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
