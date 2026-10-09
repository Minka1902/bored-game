export interface Pt {
  x: number;
  y: number;
}

export interface CircleFit {
  /** 0–100 */
  score: number;
  cx: number;
  cy: number;
  r: number;
}

const FULL_ARC = (330 / 360) * Math.PI * 2;

/**
 * Scores how round a freehand stroke is: radius spread around the centroid,
 * then penalized (quadratically) when the stroke doesn't go most of the way around.
 */
export function circleScore(points: Pt[]): CircleFit | null {
  if (points.length < 20) return null;
  const n = points.length;
  const cx = points.reduce((s, p) => s + p.x, 0) / n;
  const cy = points.reduce((s, p) => s + p.y, 0) / n;
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const r = radii.reduce((s, v) => s + v, 0) / n;
  if (r < 1) return { score: 0, cx, cy, r };
  const sd = Math.sqrt(radii.reduce((s, v) => s + (v - r) ** 2, 0) / n);
  const roundness = Math.max(0, 1 - sd / r);

  const angles = points.map((p) => Math.atan2(p.y - cy, p.x - cx)).sort((a, b) => a - b);
  let maxGap = angles[0] + Math.PI * 2 - angles[n - 1];
  for (let i = 1; i < n; i++) maxGap = Math.max(maxGap, angles[i] - angles[i - 1]);
  const coverage = Math.min(1, (Math.PI * 2 - maxGap) / FULL_ARC);

  return { score: Math.max(0, Math.min(100, roundness * coverage * coverage * 100)), cx, cy, r };
}
