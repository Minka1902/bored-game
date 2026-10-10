import { canvasGame } from '../../core/canvas-game';
import { BG } from '../../core/color';
import { text } from '../../core/draw';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const VISIBLE_S = 3;
const TARGET = 10;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let state: 'idle' | 'run' | 'done' = 'idle';
    let t0 = 0;
    let stopped = 0;
    let press = 0;

    const reset = () => {
      state = 'idle';
      stopped = 0;
    };

    const tap = (now: number) => {
      press = 1;
      if (state === 'idle') {
        state = 'run';
        t0 = now;
        ctx.sfx.play('blip');
        ctx.haptics.tap();
      } else if (state === 'run') {
        state = 'done';
        stopped = (now - t0) / 1000;
        const off = Math.round(Math.abs(stopped - TARGET) * 100) / 100;
        ctx.sfx.play(off <= 0.05 ? 'score' : 'thud');
        ctx.haptics.bump();
        setTimeout(() => ctx.gameOver({ score: off, text: `Stopped at ${stopped.toFixed(2)} s · off by`, retry: reset }), 600);
      }
    };

    const best = ctx.best();
    if (best !== undefined) ctx.hud.sub(`best: off by ${best.toFixed(2)} s`);

    return {
      pointer: { down: (p) => tap(p.t0) },
      key(e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          tap(e.timeStamp);
        }
      },
      update(dt) {
        press = Math.max(0, press - dt * 6);
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const cx = s.w / 2;
        const cy = s.h / 2;
        const R = Math.min(s.w, s.h) * 0.36 * (1 - press * 0.04);
        const elapsed = state === 'run' ? (performance.now() - t0) / 1000 : stopped;
        g.fillStyle = state === 'done' ? '#34d399' : state === 'run' ? '#ff4d6d' : '#ffd23f';
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.fill();
        if (state === 'run' && elapsed < VISIBLE_S) {
          g.strokeStyle = 'rgba(255,255,255,0.8)';
          g.lineWidth = 8;
          g.beginPath();
          g.arc(cx, cy, R + 10, -Math.PI / 2, -Math.PI / 2 + (elapsed / TARGET) * TAU);
          g.stroke();
        }
        const ink = '#241544';
        if (state === 'idle') {
          text(g, 'Tap to start', cx, cy - R * 0.12, R * 0.22, ink);
          text(g, 'then stop at exactly 10.00', cx, cy + R * 0.2, R * 0.11, ink, 'center', 700);
        } else if (state === 'run') {
          text(g, elapsed < VISIBLE_S ? elapsed.toFixed(2) : '?.??', cx, cy - R * 0.08, R * 0.42, '#fff6e9');
          text(g, elapsed < VISIBLE_S ? 'counting…' : 'now feel it · tap at 10', cx, cy + R * 0.32, R * 0.11, '#fff6e9', 'center', 800);
        } else {
          text(g, stopped.toFixed(2), cx, cy - R * 0.08, R * 0.42, ink);
          text(g, 'seconds', cx, cy + R * 0.32, R * 0.12, ink, 'center', 800);
        }
      },
    };
  });

export default game;
