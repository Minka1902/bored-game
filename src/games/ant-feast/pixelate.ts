import type { Art } from './art';

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ITERS = 12;
/** squared weighted distance below which two colors count as the same */
const SAME = 300;
/** clusters holding less than this share of the pixels (edge blends) merge into their nearest bigger one */
const MIN_SHARE = 0.015;

const hex = (r: number, g: number, b: number) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

/**
 * Turns RGBA pixels into pixel art with at most k colors (k-means, seeded farthest-first so it is
 * deterministic). Pixels with alpha below 128 become see-through. Null when nothing is opaque.
 */
export function pixelate(rgba: ArrayLike<number>, w: number, h: number, k: number, name: string): Art | null {
  const opaque: number[] = [];
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] >= 128) opaque.push(i);
  const m = opaque.length;
  if (!m) return null;
  const px = new Float64Array(m * 3);
  opaque.forEach((p, j) => {
    px[j * 3] = rgba[p * 4];
    px[j * 3 + 1] = rgba[p * 4 + 1];
    px[j * 3 + 2] = rgba[p * 4 + 2];
  });
  const d2 = (j: number, c: Float64Array, o: number) => {
    const r = px[j * 3] - c[o];
    const g = px[j * 3 + 1] - c[o + 1];
    const b = px[j * 3 + 2] - c[o + 2];
    return 2 * r * r + 4 * g * g + 3 * b * b;
  };

  const cen = new Float64Array(k * 3);
  cen.set(px.subarray(0, 3));
  let n = 1;
  const near = new Float64Array(m).fill(Infinity);
  while (n < k) {
    let far = -1;
    let fd = SAME;
    for (let j = 0; j < m; j++) {
      near[j] = Math.min(near[j], d2(j, cen, (n - 1) * 3));
      if (near[j] > fd) {
        fd = near[j];
        far = j;
      }
    }
    if (far < 0) break;
    cen.set(px.subarray(far * 3, far * 3 + 3), n * 3);
    n++;
  }

  const lab = new Uint8Array(m);
  const sum = new Float64Array(n * 4);
  for (let it = 0; it < ITERS; it++) {
    let moved = false;
    sum.fill(0);
    for (let j = 0; j < m; j++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < n; c++) {
        const d = d2(j, cen, c * 3);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (lab[j] !== best || !it) moved = true;
      lab[j] = best;
      sum[best * 4] += px[j * 3];
      sum[best * 4 + 1] += px[j * 3 + 1];
      sum[best * 4 + 2] += px[j * 3 + 2];
      sum[best * 4 + 3]++;
    }
    for (let c = 0; c < n; c++) {
      if (!sum[c * 4 + 3]) continue;
      for (let ch = 0; ch < 3; ch++) cen[c * 3 + ch] = sum[c * 4 + ch] / sum[c * 4 + 3];
    }
    if (!moved) break;
  }

  const big = Array.from({ length: n }, (_, c) => sum[c * 4 + 3] >= m * MIN_SHARE);
  if (big.some(Boolean)) {
    for (let j = 0; j < m; j++) {
      if (big[lab[j]]) continue;
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < n; c++) {
        if (!big[c]) continue;
        const d = d2(j, cen, c * 3);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      sum[lab[j] * 4 + 3]--;
      sum[best * 4 + 3]++;
      lab[j] = best;
    }
  }

  const order = Array.from({ length: n }, (_, c) => c).filter((c) => sum[c * 4 + 3]).sort((a, b) => sum[b * 4 + 3] - sum[a * 4 + 3]);
  const key = new Array<string>(n);
  const palette: Record<string, string> = {};
  order.forEach((c, i) => {
    key[c] = KEYS[i];
    palette[KEYS[i]] = hex(Math.round(cen[c * 3]), Math.round(cen[c * 3 + 1]), Math.round(cen[c * 3 + 2]));
  });
  const grid = new Array<string>(w * h).fill('.');
  opaque.forEach((p, j) => (grid[p] = key[lab[j]]));
  return { name, palette, rows: Array.from({ length: h }, (_, y) => grid.slice(y * w, y * w + w).join('')) };
}
