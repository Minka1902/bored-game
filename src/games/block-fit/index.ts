import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE, shade } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { roundRect } from '../../core/math';
import { pick } from '../../core/rand';
import type { GameFactory } from '../../core/types';
import { anyFits, canPlace, emptyGrid, N, place, PIECES, type Grid, type Piece } from './logic';

interface Slot {
  piece: Piece;
  color: number;
}

const COLORS = [0, 2, 4, 6, 7, 9, 11].map((i) => PALETTE[i]);

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let grid: Grid = emptyGrid();
    let tray: (Slot | null)[] = [];
    let score = 0;
    let over = false;
    let drag: { slot: number; x: number; y: number } | null = null;
    let flash: { rows: number[]; cols: number[]; t: number } | null = null;
    const fx = new Particles();

    const L = () => {
      const cell = Math.floor(Math.min((s.w - 24) / N, (s.h - 300) / N, 54));
      const size = cell * N;
      const x = (s.w - size) / 2;
      const y = 84;
      const trayY = y + size + 24;
      const trayH = Math.min(140, s.h - trayY - 12);
      return { cell, size, x, y, trayY, trayH };
    };

    const refill = () => {
      tray = [0, 1, 2].map(() => ({ piece: pick(PIECES), color: Math.floor(Math.random() * COLORS.length) }));
    };

    const reset = () => {
      grid = emptyGrid();
      score = 0;
      over = false;
      refill();
      ctx.hud.set(0);
    };

    const pieceSize = (p: Piece) => ({ w: p[0].length, h: p.length });

    // where the dragged piece would land: the piece floats above the finger so it stays visible
    const target = () => {
      if (!drag) return null;
      const slot = tray[drag.slot];
      if (!slot) return null;
      const l = L();
      const { w, h } = pieceSize(slot.piece);
      const px = drag.x - (w * l.cell) / 2;
      const py = drag.y - h * l.cell - l.cell * 1.2;
      const c = Math.round((px - l.x) / l.cell);
      const r = Math.round((py - l.y) / l.cell);
      return { r, c, px, py, ok: canPlace(grid, slot.piece, r, c) };
    };

    const checkOver = () => {
      const left = tray.filter((t): t is Slot => !!t).map((t) => t.piece);
      if (left.length && !anyFits(grid, left)) {
        over = true;
        ctx.sfx.play('fail');
        ctx.haptics.buzz(60);
        setTimeout(() => ctx.gameOver({ score, retry: reset }), 800);
      }
    };

    const slotRect = (i: number) => {
      const l = L();
      const w = s.w / 3;
      return { x: i * w, y: l.trayY, w, h: l.trayH };
    };

    reset();
    ctx.hint('Drag pieces onto the board');

    return {
      pointer: {
        down(p) {
          if (over) return;
          for (let i = 0; i < 3; i++) {
            const r = slotRect(i);
            if (tray[i] && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y - 20 && p.y < r.y + r.h + 20) {
              drag = { slot: i, x: p.x, y: p.y };
              ctx.sfx.play('tick', 1.2);
              ctx.haptics.tap();
              return;
            }
          }
        },
        move(p) {
          if (drag) {
            drag.x = p.x;
            drag.y = p.y;
          }
        },
        up() {
          const t = target();
          const d = drag;
          drag = null;
          if (!t || !d) return;
          const slot = tray[d.slot]!;
          if (!t.ok) {
            ctx.sfx.play('click', 0.6);
            return;
          }
          const res = place(grid, slot.piece, t.r, t.c, slot.color + 1);
          grid = res.grid;
          score += res.points;
          ctx.hud.set(score);
          tray[d.slot] = null;
          const lines = res.cleared.rows.length + res.cleared.cols.length;
          if (lines) {
            flash = { ...res.cleared, t: 0 };
            const l = L();
            for (const r of res.cleared.rows) fx.burst(l.x + l.size / 2, l.y + (r + 0.5) * l.cell, 24, PALETTE, { speed: 300, square: true });
            for (const c of res.cleared.cols) fx.burst(l.x + (c + 0.5) * l.cell, l.y + l.size / 2, 24, PALETTE, { speed: 300, square: true });
            ctx.sfx.play(lines > 1 ? 'win' : 'score');
            ctx.haptics.bump();
          } else {
            ctx.sfx.play('thud', 1.4, 0.7);
            ctx.haptics.tap();
          }
          if (tray.every((x) => !x)) refill();
          checkOver();
        },
      },
      update(dt) {
        fx.update(dt);
        if (flash) {
          flash.t += dt;
          if (flash.t > 0.35) flash = null;
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const l = L();
        g.fillStyle = '#2a1b4f';
        g.beginPath();
        roundRect(g, l.x - 6, l.y - 6, l.size + 12, l.size + 12, 14);
        g.fill();
        const cellAt = (x: number, y: number, size: number, color: string | null) => {
          if (!color) {
            g.fillStyle = '#3a2868';
            g.beginPath();
            roundRect(g, x + 2, y + 2, size - 4, size - 4, size * 0.18);
            g.fill();
            return;
          }
          g.fillStyle = shade(color, -0.3);
          g.beginPath();
          roundRect(g, x + 1, y + 1, size - 2, size - 2, size * 0.18);
          g.fill();
          g.fillStyle = color;
          g.beginPath();
          roundRect(g, x + 1, y + 1, size - 2, size - 2 - size * 0.12, size * 0.18);
          g.fill();
        };
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cellAt(l.x + c * l.cell, l.y + r * l.cell, l.cell, grid[r][c] ? COLORS[grid[r][c] - 1] : null);
        if (flash) {
          g.fillStyle = `rgba(255,255,255,${0.7 * (1 - flash.t / 0.35)})`;
          for (const r of flash.rows) g.fillRect(l.x, l.y + r * l.cell, l.size, l.cell);
          for (const c of flash.cols) g.fillRect(l.x + c * l.cell, l.y, l.cell, l.size);
        }
        const t = target();
        if (t && drag) {
          const slot = tray[drag.slot]!;
          if (t.ok) {
            g.globalAlpha = 0.35;
            slot.piece.forEach((row, i) => row.forEach((on, j) => on && cellAt(l.x + (t.c + j) * l.cell, l.y + (t.r + i) * l.cell, l.cell, COLORS[slot.color])));
            g.globalAlpha = 1;
          }
        }
        for (let i = 0; i < 3; i++) {
          const slot = tray[i];
          if (!slot || drag?.slot === i) continue;
          const r = slotRect(i);
          const { w, h } = pieceSize(slot.piece);
          const size = Math.min(l.cell * 0.55, (r.w - 16) / w, (r.h - 10) / h);
          const ox = r.x + (r.w - w * size) / 2;
          const oy = r.y + (r.h - h * size) / 2;
          slot.piece.forEach((row, a) => row.forEach((on, b) => on && cellAt(ox + b * size, oy + a * size, size, COLORS[slot.color])));
        }
        if (t && drag) {
          const slot = tray[drag.slot]!;
          slot.piece.forEach((row, a) => row.forEach((on, b) => on && cellAt(t.px + b * l.cell, t.py + a * l.cell, l.cell, COLORS[slot.color])));
        }
        fx.draw(g);
      },
    };
  });

export default game;
