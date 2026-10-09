import { canvasGame } from '../../core/canvas-game';
import { text } from '../../core/draw';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const ROUNDS = 5;
type State = 'intro' | 'wait' | 'go' | 'result' | 'early' | 'over';
const BG: Record<State, string> = {
  intro: '#3b82f6', wait: '#ff4d6d', go: '#34d399', result: '#6366f1', early: '#ffb020', over: '#6366f1',
};

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let state: State = 'intro';
    let goAt = 0;
    let shownAt = 0;
    let times: number[] = [];

    const reset = () => {
      state = 'intro';
      times = [];
    };

    const arm = () => {
      state = 'wait';
      shownAt = 0;
      goAt = performance.now() + 1200 + Math.random() * 2300;
    };

    const tap = (when: number) => {
      if (state === 'intro' || state === 'result' || state === 'early') return arm();
      if (state === 'wait') {
        state = 'early';
        ctx.sfx.play('fail', 1.6, 0.5);
        ctx.haptics.buzz(40);
        return;
      }
      if (state === 'go' && shownAt) {
        const ms = Math.max(1, Math.round(when - shownAt));
        times.push(ms);
        ctx.sfx.play('score');
        ctx.haptics.tap();
        if (times.length < ROUNDS) {
          state = 'result';
          return;
        }
        state = 'over';
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        setTimeout(() => ctx.gameOver({ score: avg, text: 'Average of 5 taps', retry: reset }), 500);
      }
    };

    const best = ctx.best();
    if (best !== undefined) ctx.hud.sub(`best ${best} ms`);

    return {
      pointer: { down: (p) => tap(p.t0) },
      key(e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          tap(e.timeStamp);
        }
      },
      update() {
        if (state === 'wait' && performance.now() >= goAt) state = 'go';
      },
      render(g) {
        g.fillStyle = BG[state];
        g.fillRect(0, 0, s.w, s.h);
        if (state === 'go' && !shownAt) shownAt = performance.now();
        const cx = s.w / 2;
        const cy = s.h / 2;
        const big = Math.min(s.w * 0.16, 72);
        const small = Math.min(s.w * 0.05, 20);
        const ink = '#fff6e9';
        if (state === 'intro') {
          text(g, 'Wait for green,', cx, cy - big * 0.6, big * 0.6, ink);
          text(g, 'then tap fast', cx, cy + big * 0.1, big * 0.6, ink);
          text(g, 'Tap anywhere to start · 5 rounds', cx, cy + big * 1.1, small, ink, 'center', 700);
        } else if (state === 'wait') {
          text(g, 'Wait…', cx, cy, big, ink);
        } else if (state === 'go') {
          text(g, 'TAP!', cx, cy, big * 1.3, '#1d1238');
        } else if (state === 'early') {
          text(g, 'Too soon!', cx, cy - big * 0.2, big * 0.8, '#1d1238');
          text(g, 'Tap to try this round again', cx, cy + big * 0.7, small, '#1d1238', 'center', 700);
        } else {
          text(g, `${times[times.length - 1]} ms`, cx, cy - big * 0.2, big, ink);
          if (state === 'result') text(g, 'Tap for the next round', cx, cy + big * 0.8, small, ink, 'center', 700);
        }
        for (let i = 0; i < ROUNDS; i++) {
          g.fillStyle = i < times.length ? '#fff6e9' : 'rgba(255,255,255,0.3)';
          g.beginPath();
          g.arc(cx + (i - (ROUNDS - 1) / 2) * 22, s.h - 50, 6, 0, TAU);
          g.fill();
        }
      },
    };
  });

export default game;
