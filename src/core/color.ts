/** Candy/neon palette shared by every game, ordered around the color wheel. */
export const PALETTE = [
  '#ff4d6d', '#ff7a45', '#ffb020', '#ffe14d', '#a3e635', '#34d399',
  '#22d3ee', '#3b82f6', '#6366f1', '#a855f7', '#e879f9', '#f472b6',
] as const;

export const BG = '#0f0d1a';
export const BG2 = '#1a1730';
export const INK = '#f5f3ff';
export const MUTED = '#9b95c9';

export const hsl = (h: number, s: number, l: number, a = 1): string =>
  a === 1 ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`;

/** Mixes a hex color toward white (amt > 0) or black (amt < 0); amt in [-1, 1]. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const ch = (v: number) => Math.round(v + (t - v) * k);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
