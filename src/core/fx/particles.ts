import { TAU } from '../math';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  square: boolean;
}

export interface BurstOpts {
  speed?: number;
  size?: number;
  life?: number;
  /** emit within [angle - spread/2, angle + spread/2] */
  angle?: number;
  spread?: number;
  square?: boolean;
}

const MAX = 1500;

/** Pooled particle bursts with gravity and drag; draw() fades and shrinks them out. */
export class Particles {
  private ps: P[] = [];
  private pool: P[] = [];
  gravity = 600;
  drag = 1.2;

  burst(x: number, y: number, n: number, color: string | readonly string[], o: BurstOpts = {}): void {
    const speed = o.speed ?? 220;
    const spread = o.spread ?? TAU;
    const angle = o.angle ?? 0;
    for (let i = 0; i < n && this.ps.length < MAX; i++) {
      const a = angle - spread / 2 + Math.random() * spread;
      const s = speed * (0.35 + Math.random() * 0.65);
      const p = this.pool.pop() ?? ({} as P);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.max = p.life = (o.life ?? 0.7) * (0.6 + Math.random() * 0.4);
      p.size = (o.size ?? 4) * (0.6 + Math.random() * 0.6);
      p.color = typeof color === 'string' ? color : color[(Math.random() * color.length) | 0];
      p.square = o.square ?? false;
      this.ps.push(p);
    }
  }

  get count(): number {
    return this.ps.length;
  }

  update(dt: number): void {
    const k = Math.exp(-this.drag * dt);
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(p);
        this.ps[i] = this.ps[this.ps.length - 1];
        this.ps.pop();
        continue;
      }
      p.vx *= k;
      p.vy = p.vy * k + this.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const p of this.ps) {
      const t = p.life / p.max;
      g.globalAlpha = Math.min(1, t * 1.5);
      g.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * t);
      if (p.square) g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      else {
        g.beginPath();
        g.arc(p.x, p.y, s / 2, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  clear(): void {
    this.pool.push(...this.ps);
    this.ps.length = 0;
  }
}
