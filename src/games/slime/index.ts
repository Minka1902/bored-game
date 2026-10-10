import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE, shade } from '../../core/color';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const N = 28;
const SUBSTEPS = 4;

interface Grab {
  idx: number[];
  ox: number[];
  oy: number[];
  x: number;
  y: number;
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    const px = new Float32Array(N);
    const py = new Float32Array(N);
    const vx = new Float32Array(N);
    const vy = new Float32Array(N);
    const grabs = new Map<number, Grab>();
    let R = 100;
    let area0 = 1;
    let color = ctx.store.get('color', 10);
    let blink = 0;
    let t = 0;

    const home = () => ({ x: s.w / 2, y: s.h / 2 + 20 });

    const shape = () => {
      R = Math.min(s.w, s.h) * 0.26;
      const h = home();
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        px[i] = h.x + Math.cos(a) * R;
        py[i] = h.y + Math.sin(a) * R * 0.92;
        vx[i] = vy[i] = 0;
      }
      area0 = Math.PI * R * R * 0.92;
    };

    const centroid = () => {
      let x = 0;
      let y = 0;
      for (let i = 0; i < N; i++) {
        x += px[i];
        y += py[i];
      }
      return { x: x / N, y: y / N };
    };

    const area = () => {
      let a = 0;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        a += px[i] * py[j] - px[j] * py[i];
      }
      return Math.abs(a) / 2;
    };

    const inside = (x: number, y: number) => {
      let hit = false;
      for (let i = 0, j = N - 1; i < N; j = i++)
        if (py[i] > y !== py[j] > y && x < ((px[j] - px[i]) * (y - py[i])) / (py[j] - py[i]) + px[i]) hit = !hit;
      return hit;
    };

    const step = (dt: number) => {
      const c = centroid();
      const h = home();
      const rest = (TAU * R) / N;
      const pressure = ((area0 - area()) / area0) * 2200;
      for (let i = 0; i < N; i++) {
        const prev = (i + N - 1) % N;
        const next = (i + 1) % N;
        let fx = 0;
        let fy = 0;
        for (const j of [prev, next]) {
          const dx = px[j] - px[i];
          const dy = py[j] - py[i];
          const d = Math.hypot(dx, dy) || 1;
          const f = (d - rest) * 260;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
        const dx = px[i] - c.x;
        const dy = py[i] - c.y;
        const d = Math.hypot(dx, dy) || 1;
        const fr = (R - d) * 30;
        fx += (dx / d) * fr;
        fy += (dy / d) * fr;
        // outward normal from the neighbors, for the pressure that keeps the volume
        const nx = py[next] - py[prev];
        const ny = -(px[next] - px[prev]);
        const nl = Math.hypot(nx, ny) || 1;
        fx += (nx / nl) * pressure;
        fy += (ny / nl) * pressure;
        fx += (h.x - c.x) * 6;
        fy += (h.y - c.y) * 6;
        vx[i] = (vx[i] + fx * dt) * Math.exp(-4 * dt);
        vy[i] = (vy[i] + fy * dt) * Math.exp(-4 * dt);
      }
      for (const g of grabs.values())
        g.idx.forEach((i, k) => {
          const tx = g.x + g.ox[k];
          const ty = g.y + g.oy[k];
          vx[i] += (tx - px[i]) * 900 * dt;
          vy[i] += (ty - py[i]) * 900 * dt;
          vx[i] *= Math.exp(-12 * dt);
          vy[i] *= Math.exp(-12 * dt);
        });
      for (let i = 0; i < N; i++) {
        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
      }
    };

    shape();
    ctx.hint('Poke, pinch and stretch');

    return {
      pointer: {
        down(p) {
          const radius = R * 0.9;
          const idx: number[] = [];
          for (let i = 0; i < N; i++) if (Math.hypot(px[i] - p.x, py[i] - p.y) < radius) idx.push(i);
          if (!idx.length && !inside(p.x, p.y)) {
            color = (color + 1) % PALETTE.length;
            ctx.store.set('color', color);
            ctx.sfx.play('blip', 0.8);
            return;
          }
          if (!idx.length) {
            // poke from inside: push the nearest rim points outward
            const c = centroid();
            for (let i = 0; i < N; i++) {
              const d = Math.hypot(px[i] - p.x, py[i] - p.y);
              if (d < R) {
                vx[i] += ((px[i] - c.x) / R) * 500;
                vy[i] += ((py[i] - c.y) / R) * 500;
              }
            }
            ctx.sfx.play('thud', 1.6, 0.6);
            ctx.haptics.tap();
            return;
          }
          grabs.set(p.id, { idx, ox: idx.map((i) => px[i] - p.x), oy: idx.map((i) => py[i] - p.y), x: p.x, y: p.y });
          ctx.sfx.play('pop', 0.35 + Math.random() * 0.1, 0.8);
          ctx.haptics.tap();
        },
        move(p) {
          const g = grabs.get(p.id);
          if (g) {
            g.x = p.x;
            g.y = p.y;
          }
        },
        up(p) {
          if (grabs.delete(p.id)) {
            ctx.sfx.play('pop', 0.55, 0.6);
            ctx.haptics.bump();
          }
        },
      },
      resize: shape,
      update(dt) {
        t += dt;
        blink = (t % 4) < 0.12 ? 1 : 0;
        for (let i = 0; i < SUBSTEPS; i++) step(dt / SUBSTEPS);
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const base = PALETTE[color % PALETTE.length];
        const c = centroid();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.ellipse(c.x, Math.max(...py) + 12, R * 0.9, R * 0.12, 0, 0, TAU);
        g.fill();
        g.beginPath();
        const mx = (i: number) => (px[i] + px[(i + 1) % N]) / 2;
        const my = (i: number) => (py[i] + py[(i + 1) % N]) / 2;
        g.moveTo(mx(N - 1), my(N - 1));
        for (let i = 0; i < N; i++) g.quadraticCurveTo(px[i], py[i], mx(i), my(i));
        g.closePath();
        const grad = g.createRadialGradient(c.x - R * 0.35, c.y - R * 0.4, R * 0.1, c.x, c.y, R * 1.3);
        grad.addColorStop(0, shade(base, 0.55));
        grad.addColorStop(0.55, base);
        grad.addColorStop(1, shade(base, -0.35));
        g.fillStyle = grad;
        g.fill();
        g.strokeStyle = shade(base, -0.45);
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.ellipse(c.x - R * 0.35, c.y - R * 0.45, R * 0.22, R * 0.11, -0.5, 0, TAU);
        g.fill();
        g.fillStyle = '#1d1238';
        for (const side of [-1, 1]) {
          g.beginPath();
          g.ellipse(c.x + side * R * 0.25, c.y - R * 0.05, R * 0.07, R * (blink ? 0.01 : 0.1), 0, 0, TAU);
          g.fill();
        }
        g.strokeStyle = '#1d1238';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(c.x, c.y + R * 0.12, R * 0.12, 0.2, Math.PI - 0.2);
        g.stroke();
      },
    };
  });

export default game;
