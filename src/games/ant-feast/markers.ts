import { TAU } from '../../core/math';

/** Distinct shapes, one per palette index, so close shades stay apart without relying on hue. */
export const MARKERS = 8;

const poly = (g: CanvasRenderingContext2D, x: number, y: number, pts: number[][]) => {
  pts.forEach(([px, py], i) => (i ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py)));
  g.closePath();
};

const plus = (r: number, t: number) => [[-t, -r], [t, -r], [t, -t], [r, -t], [r, t], [t, t], [t, r], [-t, r], [-t, t], [-r, t], [-r, -t], [-t, -t]];

/** Fills marker k (circle, triangle, square, diamond, star, plus, cross, ring) centered on (x, y) with radius r. */
export function drawMarker(g: CanvasRenderingContext2D, k: number, x: number, y: number, r: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  switch (k % MARKERS) {
    case 0:
      g.arc(x, y, r * 0.85, 0, TAU);
      break;
    case 1:
      poly(g, x, y, [[0, -r], [r * 0.95, r * 0.75], [-r * 0.95, r * 0.75]]);
      break;
    case 2:
      g.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
      break;
    case 3:
      poly(g, x, y, [[0, -r], [r * 0.8, 0], [0, r], [-r * 0.8, 0]]);
      break;
    case 4:
      poly(g, x, y, Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const d = i % 2 ? r * 0.45 : r;
        return [Math.cos(a) * d, Math.sin(a) * d];
      }));
      break;
    case 5:
      poly(g, x, y, plus(r, r * 0.32));
      break;
    case 6:
      poly(g, x, y, plus(r, r * 0.3).map(([px, py]) => [(px - py) * Math.SQRT1_2, (px + py) * Math.SQRT1_2]));
      break;
    default:
      g.arc(x, y, r * 0.9, 0, TAU);
      g.arc(x, y, r * 0.45, 0, TAU, true);
  }
  g.fill();
}
