import type { Ptr } from '../input';

export interface JoystickOpts {
  /** how far the knob travels from the base, in CSS px */
  radius?: number;
  /** fraction of the radius that still reads as zero */
  dead?: number;
  /** the base follows a finger that drags past radius × follow */
  follow?: number;
  color?: string;
}

export interface Joystick {
  /** direction with length 0..1 */
  readonly x: number;
  readonly y: number;
  readonly active: boolean;
  down(p: Ptr): void;
  move(p: Ptr): void;
  up(p: Ptr): void;
  reset(): void;
  draw(g: CanvasRenderingContext2D): void;
}

/** A stick that appears wherever the first finger lands and follows only that finger. */
export function createJoystick(o: JoystickOpts = {}): Joystick {
  const radius = o.radius ?? 56;
  const dead = o.dead ?? 0.12;
  const follow = o.follow ?? 1.4;
  const color = o.color ?? '#ffffff';
  let id: number | null = null;
  let bx = 0;
  let by = 0;
  let kx = 0;
  let ky = 0;

  const vec = () => {
    const d = Math.hypot(kx - bx, ky - by) / radius;
    if (d < dead) return [0, 0];
    const k = Math.min(1, d) / d / radius;
    return [(kx - bx) * k, (ky - by) * k];
  };

  return {
    get x() {
      return vec()[0];
    },
    get y() {
      return vec()[1];
    },
    get active() {
      return id !== null;
    },
    down(p) {
      if (id !== null) return;
      id = p.id;
      bx = kx = p.x;
      by = ky = p.y;
    },
    move(p) {
      if (p.id !== id) return;
      kx = p.x;
      ky = p.y;
      const d = Math.hypot(kx - bx, ky - by);
      if (d <= radius * follow) return;
      const k = (d - radius * follow) / d;
      bx += (kx - bx) * k;
      by += (ky - by) * k;
    },
    up(p) {
      if (p.id === id) id = null;
    },
    reset() {
      id = null;
    },
    draw(g) {
      if (id === null) return;
      const [vx, vy] = vec();
      g.globalAlpha = 0.18;
      g.fillStyle = color;
      g.beginPath();
      g.arc(bx, by, radius, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(bx + vx * radius, by + vy * radius, radius * 0.42, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    },
  };
}
