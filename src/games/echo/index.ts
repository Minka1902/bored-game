import { canvasGame } from '../../core/canvas-game';
import { BG, shade } from '../../core/color';
import { text } from '../../core/draw';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';
import { checkInput, nextSequence } from './logic';

const PADS = [
  { color: '#34d399', freq: 329.63 },
  { color: '#ff4d6d', freq: 440.0 },
  { color: '#ffe14d', freq: 277.18 },
  { color: '#3b82f6', freq: 164.81 },
];

type State = 'idle' | 'show' | 'input' | 'between' | 'over';

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let seq: number[] = [];
    let input: number[] = [];
    let state: State = 'idle';
    let timer = 0;
    let showIx = 0;
    const lit = new Float32Array(4);

    const stepLen = () => Math.max(0.22, 0.55 - seq.length * 0.022);

    const flash = (i: number, dur: number) => {
      lit[i] = dur;
      ctx.sfx.tone(PADS[i].freq, dur + 0.05, 'triangle', 0.32);
    };

    const extend = () => {
      seq = nextSequence(seq, Math.random);
      input = [];
      showIx = 0;
      timer = 0.35;
      state = 'show';
    };

    const reset = () => {
      seq = [];
      input = [];
      state = 'idle';
      ctx.hud.set(0);
    };

    const layout = () => {
      const S = Math.min(s.w - 32, s.h - 160, 460);
      return { x: (s.w - S) / 2, y: 80 + (s.h - 80 - S) / 2, S, gap: S * 0.04 };
    };

    const padAt = (x: number, y: number) => {
      const L = layout();
      const cx = L.x + L.S / 2;
      const cy = L.y + L.S / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d > L.S / 2 || d < L.S * 0.17) return -1;
      return (y < cy ? 0 : 2) + (x < cx ? 0 : 1);
    };

    const press = (i: number) => {
      if (state === 'idle') {
        extend();
        return;
      }
      if (state !== 'input' || i < 0) return;
      flash(i, 0.2);
      ctx.haptics.tap();
      input.push(i);
      const res = checkInput(seq, input);
      if (res === 'wrong') {
        state = 'over';
        ctx.sfx.play('fail');
        ctx.haptics.buzz(70);
        setTimeout(() => ctx.gameOver({ score: seq.length - 1, retry: reset }), 700);
      } else if (res === 'complete') {
        ctx.hud.set(seq.length);
        state = 'between';
        timer = 0.7;
      }
    };

    reset();
    ctx.hint('Watch, then repeat the pattern');

    return {
      pointer: { down: (p) => press(padAt(p.x, p.y)) },
      key(e) {
        const i = '1234'.indexOf(e.key);
        if (i >= 0) press(i);
        else if (e.key === ' ' && state === 'idle') press(0);
      },
      update(dt) {
        for (let i = 0; i < 4; i++) lit[i] = Math.max(0, lit[i] - dt);
        if (state === 'between') {
          timer -= dt;
          if (timer <= 0) extend();
        } else if (state === 'show') {
          timer -= dt;
          if (timer <= 0) {
            if (showIx < seq.length) {
              flash(seq[showIx++], stepLen() * 0.7);
              timer = stepLen();
            } else state = 'input';
          }
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const L = layout();
        const cx = L.x + L.S / 2;
        const cy = L.y + L.S / 2;
        const R = L.S / 2;
        PADS.forEach((p, i) => {
          const start = [Math.PI, Math.PI * 1.5, Math.PI * 0.5, 0][i];
          const on = lit[i] > 0;
          g.fillStyle = on ? shade(p.color, 0.45) : shade(p.color, -0.45);
          g.beginPath();
          g.arc(cx, cy, R, start + 0.04, start + Math.PI / 2 - 0.04);
          g.arc(cx, cy, R * 0.36, start + Math.PI / 2 - 0.1, start + 0.1, true);
          g.closePath();
          g.fill();
          if (on) {
            g.save();
            g.globalAlpha = 0.4;
            g.shadowColor = p.color;
            g.shadowBlur = 30;
            g.fill();
            g.restore();
          }
        });
        g.fillStyle = '#120a24';
        g.beginPath();
        g.arc(cx, cy, R * 0.3, 0, TAU);
        g.fill();
        const label = state === 'idle' ? 'Start' : state === 'show' ? 'Watch' : state === 'input' ? 'You' : state === 'between' ? 'Nice!' : 'Oops';
        text(g, label, cx, cy, R * 0.12, '#fff6e9');
      },
    };
  });

export default game;
