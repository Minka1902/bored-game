import { canvasGame } from '../../core/canvas-game';
import { BG, shade } from '../../core/color';
import { clamp, roundRect, TAU } from '../../core/math';
import type { Ptr } from '../../core/input';
import type { GameFactory } from '../../core/types';

const N = 6;
const ROWS = ['#ff4d6d', '#ff7a45', '#ffe14d', '#34d399', '#3b82f6', '#a855f7'];
const FLIP_S = 0.5;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    // down[r][c]: dome pressed in on the side facing the player
    let down = Array.from({ length: N }, () => Array(N).fill(false) as boolean[]);
    let flips = ctx.store.get('flips', 0);
    let flipT = -1;
    let mirrored = false;
    let lastCell = -1;

    const layout = () => {
      const size = clamp(Math.min(s.w - 28, s.h - 130), 200, 560);
      const x = (s.w - size) / 2;
      const y = 80 + (s.h - 80 - size) / 2;
      const cell = size / N;
      return { x, y, size, cell, r: cell * 0.38 };
    };

    const cellAt = (p: Ptr) => {
      const L = layout();
      const c = Math.floor((p.x - L.x) / L.cell);
      const r = Math.floor((p.y - L.y) / L.cell);
      if (c < 0 || r < 0 || c >= N || r >= N) return -1;
      const cx = L.x + (c + 0.5) * L.cell;
      const cy = L.y + (r + 0.5) * L.cell;
      return Math.hypot(p.x - cx, p.y - cy) <= L.r * 1.15 ? r * N + c : -1;
    };

    const press = (p: Ptr, isDown: boolean) => {
      if (flipT >= 0) return;
      const i = cellAt(p);
      if (i < 0 || (!isDown && i === lastCell)) return;
      lastCell = i;
      const r = Math.floor(i / N);
      const c = i % N;
      if (down[r][c]) return;
      down[r][c] = true;
      ctx.sfx.play('pop', 0.5 + Math.random() * 0.12, 0.9);
      ctx.haptics.tap();
      if (down.every((row) => row.every(Boolean))) {
        flipT = 0;
        setTimeout(() => ctx.sfx.play('whoosh', 0.7), 120);
      }
    };

    const drawDome = (g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, pressed: boolean) => {
      g.fillStyle = shade(color, -0.25);
      g.beginPath();
      g.arc(x, y, r * 1.08, 0, TAU);
      g.fill();
      const grad = g.createRadialGradient(x - r * 0.35, y - r * (pressed ? -0.3 : 0.4), r * 0.1, x, y, r);
      if (pressed) {
        grad.addColorStop(0, shade(color, 0.15));
        grad.addColorStop(0.6, shade(color, -0.1));
        grad.addColorStop(1, shade(color, -0.45));
      } else {
        grad.addColorStop(0, shade(color, 0.55));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, shade(color, -0.2));
      }
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
      if (!pressed) {
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.ellipse(x - r * 0.32, y - r * 0.38, r * 0.28, r * 0.15, -0.6, 0, TAU);
        g.fill();
      }
    };

    ctx.hud.set(flips);
    ctx.hud.sub(flips === 1 ? 'flip' : 'flips');
    ctx.hint('Press every dome');

    return {
      pointer: {
        down: (p) => press(p, true),
        move: (p) => press(p, false),
        up: () => (lastCell = -1),
      },
      update(dt) {
        if (flipT < 0) return;
        const before = flipT;
        flipT += dt / FLIP_S;
        if (before < 0.5 && flipT >= 0.5) {
          down = down.map((row) => row.map(() => false));
          mirrored = !mirrored;
          flips++;
          ctx.store.set('flips', flips);
          ctx.hud.set(flips);
          ctx.hud.sub(flips === 1 ? 'flip' : 'flips');
        }
        if (flipT >= 1) {
          flipT = -1;
          ctx.sfx.play('thud', 0.9);
          ctx.haptics.bump();
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const L = layout();
        const sx = flipT >= 0 ? Math.abs(Math.cos(flipT * Math.PI)) : 1;
        g.save();
        g.translate(s.w / 2, L.y + L.size / 2);
        g.scale(Math.max(0.02, sx), 1);
        g.translate(-s.w / 2, -(L.y + L.size / 2));
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath();
        roundRect(g, L.x - 8, L.y - 2, L.size + 16, L.size + 16, L.cell * 0.6);
        g.fill();
        g.fillStyle = '#e8ddff';
        g.beginPath();
        roundRect(g, L.x - 8, L.y - 8, L.size + 16, L.size + 16, L.cell * 0.6);
        g.fill();
        for (let r = 0; r < N; r++) {
          const color = ROWS[mirrored ? N - 1 - r : r];
          g.fillStyle = shade(color, 0.35);
          g.beginPath();
          roundRect(g, L.x, L.y + r * L.cell + 2, L.size, L.cell - 4, L.cell * 0.45);
          g.fill();
          for (let c = 0; c < N; c++)
            drawDome(g, L.x + (c + 0.5) * L.cell, L.y + (r + 0.5) * L.cell, L.r, color, down[r][c]);
        }
        g.restore();
      },
    };
  });

export default game;
