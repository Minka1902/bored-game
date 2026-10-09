import { canvasGame } from '../../core/canvas-game';
import { BG, hsl } from '../../core/color';
import { keyDir, singlePointer, swipeDir, type SwipeDir } from '../../core/input';
import { roundRect, TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';
import { initSnake, placeFood, step, type SnakeState } from './logic';

const COLS = 16;
const TOP = 76;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let st: SnakeState;
    let queue: SwipeDir[] = [];
    let acc = 0;
    let started = false;
    let anchor: { x: number; y: number } | null = null;
    let t = 0;

    const dims = () => {
      const cell = Math.floor(Math.min((s.w - 16) / COLS, 40));
      const rows = Math.max(8, Math.floor((s.h - TOP - 16) / cell));
      return { cell, rows, x: (s.w - cell * COLS) / 2, y: TOP + (s.h - TOP - rows * cell) / 2 };
    };

    const reset = () => {
      st = initSnake(COLS, dims().rows);
      st.food = placeFood(st, Math.random);
      queue = [];
      acc = 0;
      started = false;
      ctx.hud.set(0);
    };

    const turn = (d: SwipeDir) => {
      started = true;
      if (queue.length < 2) queue.push(d);
    };

    const tick = () => {
      const want = queue.shift() ?? st.dir;
      st = step(st, want);
      if (st.dead) {
        ctx.sfx.play('fail');
        ctx.haptics.buzz(60);
        setTimeout(() => ctx.gameOver({ score: st.body.length - 3, retry: reset }), 600);
        return;
      }
      if (st.ate) {
        st.food = placeFood(st, Math.random);
        ctx.hud.set(st.body.length - 3);
        ctx.sfx.play('pop', 1 + Math.min(1, st.body.length / 60));
        ctx.haptics.tap();
      }
    };

    reset();
    ctx.hint('Swipe to steer');

    return {
      pointer: singlePointer({
        down(p) {
          anchor = { x: p.x, y: p.y };
          started = true;
        },
        move(p) {
          if (!anchor) return;
          const d = swipeDir(p.x - anchor.x, p.y - anchor.y, 22);
          if (d) {
            turn(d);
            anchor = { x: p.x, y: p.y };
          }
        },
        up() {
          anchor = null;
        },
      }),
      key(e) {
        const d = keyDir(e);
        if (d) {
          e.preventDefault();
          turn(d);
        }
      },
      resize() {
        if (!started) reset();
      },
      update(dt) {
        t += dt;
        if (!started || st.dead) return;
        acc += dt;
        const every = Math.max(0.07, 0.115 - st.body.length * 0.0012);
        while (acc >= every && !st.dead) {
          acc -= every;
          tick();
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const D = dims();
        for (let r = 0; r < st.rows; r++)
          for (let c = 0; c < COLS; c++) {
            g.fillStyle = (r + c) % 2 ? '#2a1b4f' : '#30205a';
            g.fillRect(D.x + c * D.cell, D.y + r * D.cell, D.cell, D.cell);
          }
        if (st.food) {
          const pulse = 1 + Math.sin(t * 6) * 0.08;
          g.fillStyle = '#ff4d6d';
          g.beginPath();
          g.arc(D.x + (st.food.x + 0.5) * D.cell, D.y + (st.food.y + 0.5) * D.cell, D.cell * 0.36 * pulse, 0, TAU);
          g.fill();
          g.fillStyle = '#34d399';
          g.fillRect(D.x + (st.food.x + 0.5) * D.cell - 1, D.y + st.food.y * D.cell + D.cell * 0.05, 3, D.cell * 0.22);
        }
        const n = st.body.length;
        st.body.forEach((b, i) => {
          g.fillStyle = st.dead ? '#9ca3af' : hsl(150 + (i / n) * 60, 80, 60 - (i / n) * 15);
          const pad = i === 0 ? 1 : 2.5;
          g.beginPath();
          roundRect(g, D.x + b.x * D.cell + pad, D.y + b.y * D.cell + pad, D.cell - pad * 2, D.cell - pad * 2, D.cell * 0.3);
          g.fill();
        });
        const h = st.body[0];
        const dx = st.dir === 'left' ? -1 : st.dir === 'right' ? 1 : 0;
        const dy = st.dir === 'up' ? -1 : st.dir === 'down' ? 1 : 0;
        for (const side of [-1, 1]) {
          const ex = D.x + (h.x + 0.5) * D.cell + dx * D.cell * 0.15 + -dy * side * D.cell * 0.2;
          const ey = D.y + (h.y + 0.5) * D.cell + dy * D.cell * 0.15 + dx * side * D.cell * 0.2;
          g.fillStyle = '#fff';
          g.beginPath();
          g.arc(ex, ey, D.cell * 0.12, 0, TAU);
          g.fill();
          g.fillStyle = '#1d1238';
          g.beginPath();
          g.arc(ex + dx * 1.5, ey + dy * 1.5, D.cell * 0.06, 0, TAU);
          g.fill();
        }
      },
    };
  });

export default game;
