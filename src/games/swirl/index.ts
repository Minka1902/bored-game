import { canvasGame } from '../../core/canvas-game';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const BUCKETS = ['#6366f1', '#3b82f6', '#22d3ee', '#34d399', '#ffe14d', '#ff7a45', '#ff4d6d', '#ffffff'];

const game: GameFactory = (ctx) =>
  canvasGame(
    ctx,
    (s) => {
      const n = window.innerWidth < 400 ? 1200 : 2500;
      const x = new Float32Array(n);
      const y = new Float32Array(n);
      const vx = new Float32Array(n);
      const vy = new Float32Array(n);
      const bucket = new Uint8Array(n);
      const fingers = new Map<number, { x: number; y: number }>();
      let clear = true;
      let lastSound = 0;

      const scatter = () => {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const r = Math.sqrt(Math.random()) * Math.min(s.w, s.h) * 0.45;
          x[i] = s.w / 2 + Math.cos(a) * r;
          y[i] = s.h / 2 + Math.sin(a) * r;
          vx[i] = -Math.sin(a) * 40;
          vy[i] = Math.cos(a) * 40;
        }
        clear = true;
      };
      scatter();
      ctx.hint('Drag to stir · use two fingers');

      const pull = (i: number, ax: number, ay: number, strength: number, swirl: number, dt: number) => {
        const dx = ax - x[i];
        const dy = ay - y[i];
        const d2 = dx * dx + dy * dy + 900;
        const inv = 1 / Math.sqrt(d2);
        const f = (strength * dt) / (d2 * inv * 0.02 + 1);
        vx[i] += (dx * inv * f) - dy * inv * f * swirl;
        vy[i] += (dy * inv * f) + dx * inv * f * swirl;
      };

      return {
        pointer: {
          down(p) {
            fingers.set(p.id, { x: p.x, y: p.y });
            ctx.haptics.tap();
            ctx.sfx.play('whoosh', 0.6, 0.6);
          },
          move(p) {
            fingers.set(p.id, { x: p.x, y: p.y });
            if (p.t - lastSound > 260 && Math.hypot(p.x - p.px, p.y - p.py) > 18) {
              lastSound = p.t;
              ctx.sfx.play('whoosh', 0.8 + Math.random() * 0.5, 0.35);
            }
          },
          up(p) {
            fingers.delete(p.id);
          },
        },
        resize: scatter,
        update(dt, t) {
          const damp = Math.exp(-1.4 * dt);
          const cx = s.w / 2 + Math.cos(t * 0.3) * s.w * 0.1;
          const cy = s.h / 2 + Math.sin(t * 0.4) * s.h * 0.1;
          for (let i = 0; i < n; i++) {
            if (fingers.size) for (const f of fingers.values()) pull(i, f.x, f.y, 2600, 0.9, dt);
            else pull(i, cx, cy, 500, 1.6, dt);
            vx[i] *= damp;
            vy[i] *= damp;
            x[i] += vx[i] * dt;
            y[i] += vy[i] * dt;
            if (x[i] < 0 || x[i] > s.w) vx[i] *= -0.8;
            if (y[i] < 0 || y[i] > s.h) vy[i] *= -0.8;
            x[i] = Math.min(s.w, Math.max(0, x[i]));
            y[i] = Math.min(s.h, Math.max(0, y[i]));
            const sp = Math.abs(vx[i]) + Math.abs(vy[i]);
            bucket[i] = Math.min(BUCKETS.length - 1, (sp / 70) | 0);
          }
        },
        render(g) {
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = clear ? '#120a24' : 'rgba(18,10,36,0.2)';
          clear = false;
          g.fillRect(0, 0, s.w, s.h);
          g.globalCompositeOperation = 'lighter';
          for (let b = 0; b < BUCKETS.length; b++) {
            g.fillStyle = BUCKETS[b];
            g.beginPath();
            for (let i = 0; i < n; i++) if (bucket[i] === b) g.rect(x[i] - 1, y[i] - 1, 2.2, 2.2);
            g.fill();
          }
          g.globalCompositeOperation = 'source-over';
        },
      };
    },
    { maxDpr: 1.5 },
  );

export default game;
