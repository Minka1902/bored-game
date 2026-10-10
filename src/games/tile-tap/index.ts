import { canvasGame } from '../../core/canvas-game';
import { text } from '../../core/draw';
import type { GameFactory } from '../../core/types';

// "Ode to Joy" (public domain), looped as the tiles are tapped.
const MELODY = [
  330, 330, 349, 392, 392, 349, 330, 294, 262, 262, 294, 330, 330, 294, 294,
  330, 330, 349, 392, 392, 349, 330, 294, 262, 262, 294, 330, 294, 262, 262,
];

interface Row {
  col: number;
  hit: boolean;
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let rows: Row[] = [];
    let offset = 0;
    let speed = 0;
    let score = 0;
    let state: 'ready' | 'run' | 'dead' = 'ready';
    let miss: { row: number; col: number } | null = null;

    const rowH = () => s.h / 4.4;
    const colW = () => s.w / 4;
    // row i's bottom edge; row 0 starts fully visible just above the bottom of the screen
    const rowBottom = (i: number) => s.h - i * rowH() - rowH() * 0.4 + offset;

    const reset = () => {
      rows = [];
      for (let i = 0; i < 8; i++) rows.push({ col: Math.floor(Math.random() * 4), hit: false });
      offset = 0;
      speed = 0;
      score = 0;
      state = 'ready';
      miss = null;
      ctx.hud.set(0);
    };

    const lowest = () => rows.findIndex((r) => !r.hit);

    const fail = (row: number, col: number) => {
      state = 'dead';
      miss = { row, col };
      ctx.sfx.play('fail');
      ctx.haptics.buzz(70);
      setTimeout(() => ctx.gameOver({ score, retry: reset }), 800);
    };

    const tap = (x: number, y: number) => {
      if (state === 'dead') return;
      const i = lowest();
      const col = Math.min(3, Math.floor(x / colW()));
      const bottom = rowBottom(i);
      const inRow = y <= bottom && y >= bottom - rowH();
      if (inRow && col === rows[i].col) {
        rows[i].hit = true;
        if (state === 'ready') {
          state = 'run';
          speed = 2.4;
        }
        score++;
        ctx.hud.set(score);
        ctx.sfx.tone(MELODY[(score - 1) % MELODY.length] * 2, 0.35, 'triangle', 0.35);
        ctx.haptics.tap();
        speed = Math.min(6.5, speed + 0.035);
        return;
      }
      // tapping a dark tile further up is forgiven; white tiles are not
      for (let r = i; r < rows.length; r++) {
        const b = rowBottom(r);
        if (y <= b && y >= b - rowH()) {
          if (rows[r].col !== col) fail(r, col);
          return;
        }
      }
    };

    reset();
    ctx.hint('Tap only the dark tiles');

    return {
      pointer: { down: (p) => tap(p.x, p.y) },
      update(dt) {
        if (state !== 'run') return;
        offset += speed * rowH() * dt;
        // a row leaves only once it has scrolled fully off the bottom; leaving untapped ends the run
        while (rowBottom(0) - rowH() > s.h) {
          if (!rows[0].hit) {
            offset -= rowH() * 0.8;
            return fail(0, rows[0].col);
          }
          offset -= rowH();
          rows.shift();
          rows.push({ col: Math.floor(Math.random() * 4), hit: false });
        }
      },
      render(g) {
        g.fillStyle = '#fff6e9';
        g.fillRect(0, 0, s.w, s.h);
        const rh = rowH();
        const cw = colW();
        rows.forEach((r, i) => {
          const b = rowBottom(i);
          if (b < 0 || b - rh > s.h) return;
          g.fillStyle = r.hit ? 'rgba(36,21,68,0.18)' : '#241544';
          g.fillRect(r.col * cw + 1, b - rh + 1, cw - 2, rh - 2);
          if (state === 'ready' && i === 0) text(g, 'START', r.col * cw + cw / 2, b - rh / 2, Math.min(cw * 0.22, 22), '#ffd23f');
        });
        if (miss) {
          g.fillStyle = 'rgba(255,77,109,0.85)';
          const b = rowBottom(miss.row);
          g.fillRect(miss.col * cw, b - rh, cw, rh);
        }
        g.fillStyle = 'rgba(36,21,68,0.12)';
        for (let c = 1; c < 4; c++) g.fillRect(c * cw - 0.5, 0, 1, s.h);
      },
    };
  });

export default game;
