// Tiny circle physics: gravity, circle-circle and circle-segment collisions, box bounds.
// Enough for stacking (Merge Drop), pegboards (Peg Drop) and juggling (Keepy Up) without a 90 KB engine.

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  static?: boolean;
  data?: any;
}

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export class World {
  bodies: Body[] = [];
  segments: Segment[] = [];
  gravity = 900;
  restitution = 0.3;
  /** velocity kept per second while touching something; lower values settle stacks faster */
  contactDamping = 0.6;
  bounds?: { l: number; r: number; b: number; t?: number };
  onContact?: (a: Body, b: Body, impulse: number) => void;
  /** called when a body hits a segment or the bounds */
  onWall?: (a: Body, impulse: number) => void;
  iterations = 3;

  add(b: Body): Body {
    this.bodies.push(b);
    return b;
  }

  remove(b: Body): void {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  step(dt: number, substeps = 4): void {
    const h = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      for (const b of this.bodies) {
        if (b.static) continue;
        b.vy += this.gravity * h;
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      for (let it = 0; it < this.iterations; it++) {
        this.collideBodies(h, it === 0);
        for (const b of this.bodies) if (!b.static) this.collideStatic(b, h, it === 0);
      }
    }
  }

  private collideBodies(h: number, report: boolean): void {
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (a.static && b.static) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.0001;
        const nx = d2 ? dx / d : 0;
        const ny = d2 ? dy / d : 1;
        const ia = a.static ? 0 : 1 / a.m;
        const ib = b.static ? 0 : 1 / b.m;
        const sum = ia + ib;
        const pen = rr - d;
        a.x -= nx * pen * (ia / sum);
        a.y -= ny * pen * (ia / sum);
        b.x += nx * pen * (ib / sum);
        b.y += ny * pen * (ib / sum);
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const j = (-(1 + this.restitution) * vn) / sum;
          a.vx -= j * nx * ia;
          a.vy -= j * ny * ia;
          b.vx += j * nx * ib;
          b.vy += j * ny * ib;
          if (report) this.onContact?.(a, b, j);
        }
        const k = Math.pow(this.contactDamping, h);
        if (!a.static) { a.vx *= k; a.vy *= k; }
        if (!b.static) { b.vx *= k; b.vy *= k; }
      }
    }
  }

  private bounce(b: Body, nx: number, ny: number, pen: number, report: boolean, h: number): void {
    b.x += nx * pen;
    b.y += ny * pen;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + this.restitution) * vn * nx;
      b.vy -= (1 + this.restitution) * vn * ny;
      if (report) this.onWall?.(b, -vn * b.m);
    }
    const k = Math.pow(this.contactDamping, h);
    b.vx *= k;
    b.vy *= k;
  }

  private collideStatic(b: Body, h: number, report: boolean): void {
    const bd = this.bounds;
    if (bd) {
      if (b.x - b.r < bd.l) this.bounce(b, 1, 0, bd.l - (b.x - b.r), report, h);
      if (b.x + b.r > bd.r) this.bounce(b, -1, 0, b.x + b.r - bd.r, report, h);
      if (b.y + b.r > bd.b) this.bounce(b, 0, -1, b.y + b.r - bd.b, report, h);
      if (bd.t !== undefined && b.y - b.r < bd.t) this.bounce(b, 0, 1, bd.t - (b.y - b.r), report, h);
    }
    for (const s of this.segments) {
      const ex = s.bx - s.ax;
      const ey = s.by - s.ay;
      const len2 = ex * ex + ey * ey || 1;
      const t = Math.max(0, Math.min(1, ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / len2));
      const cx = s.ax + ex * t;
      const cy = s.ay + ey * t;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= b.r * b.r) continue;
      const d = Math.sqrt(d2) || 0.0001;
      this.bounce(b, d2 ? dx / d : 0, d2 ? dy / d : -1, b.r - d, report, h);
    }
  }
}
