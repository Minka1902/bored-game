export interface Tier {
  /** radius at a 400 px wide container; the game scales it */
  r: number;
  color: string;
}

export const TIERS: Tier[] = [
  { r: 14, color: '#ff4d6d' },
  { r: 19, color: '#ff7a45' },
  { r: 25, color: '#ffb020' },
  { r: 31, color: '#ffe14d' },
  { r: 38, color: '#a3e635' },
  { r: 46, color: '#34d399' },
  { r: 55, color: '#22d3ee' },
  { r: 65, color: '#3b82f6' },
  { r: 76, color: '#6366f1' },
  { r: 88, color: '#a855f7' },
  { r: 100, color: '#f472b6' },
];

/** Drops come from the smallest five tiers. */
export const DROPPABLE = 5;

/** Two equal tiers merge into the next one; two top-tier balls vanish (tier -1) for a bonus. */
export function mergeResult(a: number, b: number): { tier: number; points: number } | null {
  if (a !== b) return null;
  if (a === TIERS.length - 1) return { tier: -1, points: 100 };
  return { tier: a + 1, points: ((a + 1) * (a + 2)) / 2 };
}
