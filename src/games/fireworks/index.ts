import { canvasGame } from '../../core/canvas-game';
import { PALETTE } from '../../core/color';
import { pick } from '../../core/rand';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

interface Rocket {
  x: number;
  y: number;
  vy: number;
  ty: number;
  big: boolean;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  drag: number;
  grav: number;
  size: number;
}

type Kind = 'peony' | 'ring' | 'willow';
const MAX_SPARKS = 2400;

const game: GameFactory = (ctx) =>
  canvasGame(
    ctx,
    (s) => {
      const rockets: Rocket[] = [];
      const sparks: Spark[] = [];
      const held = new Map<number, number>();
      let idle = 0;
      let auto = 1.2;
      let clear = true;

      const launch = (x: number, ty: number, big: boolean) => {
        const color = pick(PALETTE);
        const dist = s.h - ty;
        rockets.push({ x, y: s.h + 6, vy: -Math.sqrt(2 * 420 * dist) * 1.05, ty, big, color });
        ctx.sfx.play('whoosh', 1.4 + Math.random() * 0.3, 0.35);
      };

      const explode = (r: Rocket) => {
        const kind: Kind = r.big ? pick<Kind>(['peony', 'willow', 'ring']) : pick<Kind>(['peony', 'peony', 'ring']);
        const n = r.big ? 140 : 70;
        const speed = (r.big ? 260 : 170) * Math.min(1.3, s.w / 400 + 0.3);
        const alt = pick(PALETTE);
        for (let i = 0; i < n && sparks.length < MAX_SPARKS; i++) {
          const a = kind === 'ring' ? (i / n) * TAU : Math.random() * TAU;
          const sp = kind === 'ring' ? speed : speed * Math.sqrt(Math.random());
          const willow = kind === 'willow';
          const max = willow ? 2.4 + Math.random() : 1.1 + Math.random() * 0.6;
          sparks.push({
            x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: max, max,
            color: willow ? '#ffd23f' : i % 3 ? r.color : alt,
            drag: willow ? 2.2 : 1.3, grav: willow ? 70 : 140, size: r.big ? 2.6 : 2,
          });
        }
        ctx.sfx.play('thud', r.big ? 0.5 : 0.75);
        ctx.sfx.play('snare', 0.6, 0.5);
        ctx.haptics.bump();
      };

      ctx.hint('Tap to launch · hold for a big one');

      return {
        pointer: {
          down(p) {
            held.set(p.id, p.t0);
            idle = 0;
          },
          up(p) {
            const t0 = held.get(p.id) ?? p.t;
            held.delete(p.id);
            launch(p.x, Math.min(p.y, s.h - 80), p.t - t0 > 300);
          },
        },
        resize() {
          clear = true;
        },
        update(dt) {
          idle += dt;
          if (idle > 4) {
            auto -= dt;
            if (auto <= 0) {
              auto = 0.7 + Math.random() * 1.2;
              launch(s.w * (0.15 + Math.random() * 0.7), s.h * (0.2 + Math.random() * 0.3), Math.random() < 0.3);
            }
          }
          for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i];
            r.vy += 420 * dt;
            r.y += r.vy * dt;
            if (sparks.length < MAX_SPARKS)
              sparks.push({ x: r.x + (Math.random() - 0.5) * 2, y: r.y + 6, vx: 0, vy: 30, life: 0.35, max: 0.35, color: '#ffd9a0', drag: 2, grav: 0, size: 1.6 });
            if (r.y <= r.ty || r.vy >= 0) {
              explode(r);
              rockets.splice(i, 1);
            }
          }
          for (let i = sparks.length - 1; i >= 0; i--) {
            const p = sparks[i];
            p.life -= dt;
            if (p.life <= 0) {
              sparks[i] = sparks[sparks.length - 1];
              sparks.pop();
              continue;
            }
            const k = Math.exp(-p.drag * dt);
            p.vx *= k;
            p.vy = p.vy * k + p.grav * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
          }
        },
        render(g) {
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = clear ? '#0e0820' : 'rgba(14,8,32,0.22)';
          clear = false;
          g.fillRect(0, 0, s.w, s.h);
          g.globalCompositeOperation = 'lighter';
          for (const p of sparks) {
            const t = p.life / p.max;
            g.globalAlpha = Math.min(1, t * 1.6) * (t < 0.3 && Math.random() < 0.3 ? 0.3 : 1);
            g.fillStyle = p.color;
            g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          }
          g.globalAlpha = 1;
          for (const r of rockets) {
            g.fillStyle = '#fff6e9';
            g.fillRect(r.x - 1.5, r.y - 3, 3, 6);
          }
          g.globalCompositeOperation = 'source-over';
        },
      };
    },
    { maxDpr: 1.5 },
  );

export default game;
