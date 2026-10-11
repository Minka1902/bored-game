import { canvasGame } from '../../core/canvas-game';
import { BG, BG2, PALETTE, shade } from '../../core/color';
import { text } from '../../core/draw';
import { easeOutBack } from '../../core/ease';
import { Particles } from '../../core/fx/particles';
import { clamp, lerp, roundRect, TAU } from '../../core/math';
import { shuffle } from '../../core/rand';
import type { GameFactory } from '../../core/types';
import { bite, generate, start, stuck, take, target, won, type Level, type State } from './logic';

const COLORS = ['#ff4d6d', '#3b82f6', '#ffd23f', '#34d399', '#a855f7', '#ff7a45', '#8b5e3c'];
const MAX_SLOTS = 5;
const COLS = 4;
const ROWS = 4;
const TOP = 84;
const BITE = 0.07;
const WALK = 0.45;

interface Ant {
  pixel: number;
  color: number;
  t: number;
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let level = ctx.store.get('level', 1);
    let lv: Level;
    let hues = COLORS;
    let st: State;
    let held = new Uint8Array(0);
    let ants: Ant[] = [];
    let acc = 0;
    let mode: 'play' | 'won' | 'lost' | 'over' = 'play';
    let endT = 0;
    let shakeT = 0;
    const popT = new Array<number>(MAX_SLOTS).fill(1);
    const fx = new Particles();

    const params = (n: number) => {
      const size = Math.min(20, 11 + n);
      return {
        w: size,
        h: size,
        colors: Math.min(COLORS.length, 3 + Math.floor((n - 1) / 2)),
        cols: COLS,
        chunk: [8, 30] as [number, number],
        frame: size < 15 ? 1 : 2,
        run: 4,
      };
    };

    const slotsFor = (n: number) => (n < 4 ? MAX_SLOTS : n < 8 ? MAX_SLOTS - 1 : MAX_SLOTS - 2);

    const restart = () => {
      st = start(lv, slotsFor(level));
      held = new Uint8Array(lv.px.length);
      ants = [];
      acc = 0;
      mode = 'play';
      endT = 0;
      popT.fill(1);
    };

    const newLevel = () => {
      lv = generate(params(level), Math.random);
      hues = shuffle(COLORS.slice());
      restart();
      ctx.hud.set(`Level ${level}`);
      ctx.hud.sub(`${level - 1} solved`);
    };

    const layout = () => {
      const tile = Math.min(58, (s.w - 40) / (MAX_SLOTS + 0.9), (s.h - TOP) / 11);
      const gap = tile * 0.2;
      const gridY = s.h - 14 - ROWS * (tile + gap);
      const slotY = gridY - tile - gap * 2.4;
      const hole = { x: s.w / 2, y: slotY - tile * 0.45 };
      const picH = hole.y - tile * 0.45 - TOP;
      const cell = Math.max(2, Math.min((s.w - 36) / lv.w, picH / lv.h));
      const pw = cell * lv.w;
      const ph = cell * lv.h;
      const px = (s.w - pw) / 2;
      const py = TOP + (picH - ph) / 2;
      const n = st.slots.length;
      const slotX = (i: number) => (s.w - n * tile - (n - 1) * gap) / 2 + i * (tile + gap);
      const colGap = gap * 2;
      const colX = (c: number) => (s.w - COLS * tile - (COLS - 1) * colGap) / 2 + c * (tile + colGap);
      return { tile, gap, colGap, gridY, slotY, hole, cell, pw, ph, px, py, slotX, colX };
    };

    const pixelXY = (L: ReturnType<typeof layout>, i: number) => ({
      x: L.px + ((i % lv.w) + 0.5) * L.cell,
      y: L.py + (Math.floor(i / lv.w) + 0.5) * L.cell,
    });

    const drawTile = (gc: CanvasRenderingContext2D, x: number, y: number, size: number, color: number, n: number, alpha = 1) => {
      const c = hues[color];
      gc.globalAlpha = alpha;
      gc.fillStyle = shade(c, -0.35);
      gc.beginPath();
      roundRect(gc, x, y + size * 0.08, size, size, size * 0.22);
      gc.fill();
      gc.fillStyle = c;
      gc.beginPath();
      roundRect(gc, x, y, size, size * 0.94, size * 0.22);
      gc.fill();
      text(gc, String(n), x + size / 2 + 1, y + size * 0.48 + 1.5, size * 0.4, 'rgba(0,0,0,0.35)');
      text(gc, String(n), x + size / 2, y + size * 0.48, size * 0.4, '#ffffff');
      gc.globalAlpha = 1;
    };

    const tap = (x: number, y: number) => {
      if (mode !== 'play') return;
      const L = layout();
      if (y < L.gridY - L.gap) return;
      const col = Array.from({ length: COLS }, (_, c) => c).find((c) => x >= L.colX(c) - L.colGap / 2 && x <= L.colX(c) + L.tile + L.colGap / 2);
      if (col === undefined || !st.cols[col].length) return;
      const slot = take(st, col);
      if (slot < 0) {
        shakeT = 0.35;
        ctx.sfx.play('click', 0.6);
        ctx.haptics.buzz(30);
        return;
      }
      popT[slot] = 0;
      ctx.sfx.play('pop', 0.9 + Math.random() * 0.3);
      ctx.haptics.tap();
    };

    const finish = () => {
      if (mode === 'won') {
        newLevel();
        return;
      }
      mode = 'over';
      ctx.gameOver({ score: level - 1, text: 'No room left!', retry: restart });
    };

    newLevel();
    ctx.hint('Tap a column to send its ants to eat that color');

    return {
      pointer: { down: (p) => tap(p.x, p.y) },
      update(dt) {
        fx.update(dt);
        shakeT = Math.max(0, shakeT - dt);
        for (let i = 0; i < MAX_SLOTS; i++) popT[i] = Math.min(1, popT[i] + dt * 4);
        const L = layout();
        for (let k = ants.length - 1; k >= 0; k--) {
          const a = ants[k];
          const before = a.t;
          a.t += dt;
          if (before < WALK && a.t >= WALK) {
            held[a.pixel] = 0;
            const p = pixelXY(L, a.pixel);
            fx.burst(p.x, p.y, 3, hues[a.color], { speed: 70, size: Math.max(2, L.cell * 0.5), life: 0.35, square: true });
          }
          if (a.t >= WALK * 2) ants.splice(k, 1);
        }
        if (mode === 'play') {
          acc += dt;
          while (acc >= BITE) {
            acc -= BITE;
            for (const b of bite(st)) {
              held[b.pixel] = 1;
              ants.push({ pixel: b.pixel, color: b.color, t: 0 });
              if (b.done) {
                ctx.sfx.play('score', 1.2, 0.4);
                ctx.haptics.tap();
              }
            }
            if (won(st)) {
              mode = 'won';
              level++;
              ctx.store.set('level', level);
              ctx.submitScore(level - 1);
              ctx.sfx.play('win');
              ctx.haptics.bump();
              fx.burst(s.w / 2, L.py + L.ph / 2, 70, PALETTE, { speed: 450, life: 1.1 });
              break;
            }
            if (stuck(st)) {
              mode = 'lost';
              ctx.sfx.play('fail');
              ctx.haptics.buzz(120);
              break;
            }
          }
        } else if (mode !== 'over' && !ants.length) {
          endT += dt;
          if (endT > (mode === 'won' ? 1 : 0.4)) finish();
        }
      },
      render(gc) {
        const L = layout();
        gc.fillStyle = BG;
        gc.fillRect(0, 0, s.w, s.h);
        gc.fillStyle = BG2;
        gc.beginPath();
        roundRect(gc, L.px - 8, L.py - 8, L.pw + 16, L.ph + 16, 14);
        gc.fill();
        const inset = L.cell > 7 ? 1 : 0;
        for (let i = 0; i < lv.px.length; i++) {
          if (st.px[i] < 0 && !held[i]) continue;
          const x = L.px + (i % lv.w) * L.cell;
          const y = L.py + Math.floor(i / lv.w) * L.cell;
          gc.fillStyle = hues[lv.px[i]];
          gc.fillRect(x, y, L.cell - inset, L.cell - inset);
        }
        gc.fillStyle = '#0b0618';
        gc.beginPath();
        gc.ellipse(L.hole.x, L.hole.y, L.tile * 0.42, L.tile * 0.16, 0, 0, TAU);
        gc.fill();
        const antR = clamp(L.cell * 0.32, 1.6, 4);
        for (const a of ants) {
          const p = pixelXY(L, a.pixel);
          const k = a.t < WALK ? a.t / WALK : 2 - a.t / WALK;
          const x = lerp(L.hole.x, p.x, k) + Math.sin(a.t * 40) * antR * 0.4;
          const y = lerp(L.hole.y, p.y, k);
          const ang = Math.atan2(p.y - L.hole.y, p.x - L.hole.x) + (a.t < WALK ? 0 : Math.PI);
          gc.fillStyle = shade(hues[a.color], -0.45);
          for (let seg = -1; seg <= 1; seg++) {
            gc.beginPath();
            gc.arc(x + Math.cos(ang) * seg * antR * 1.5, y + Math.sin(ang) * seg * antR * 1.5, antR * (seg === 0 ? 0.75 : 1), 0, TAU);
            gc.fill();
          }
          if (a.t >= WALK) {
            gc.fillStyle = hues[a.color];
            gc.fillRect(x + Math.cos(ang) * antR * 2.4 - antR, y + Math.sin(ang) * antR * 2.4 - antR, antR * 2, antR * 2);
          }
        }
        const dx = shakeT > 0 ? Math.sin(shakeT * 70) * 6 : 0;
        for (let i = 0; i < st.slots.length; i++) {
          const x = L.slotX(i) + dx;
          gc.fillStyle = 'rgba(255,255,255,0.1)';
          gc.beginPath();
          roundRect(gc, x, L.slotY, L.tile, L.tile, L.tile * 0.22);
          gc.fill();
          const t = st.slots[i];
          if (!t) continue;
          const k = easeOutBack(popT[i]);
          const size = L.tile * (0.6 + 0.4 * k);
          drawTile(gc, x + (L.tile - size) / 2, L.slotY + (L.tile - size) / 2, size, t.color, t.n, target(st, t.color) < 0 ? 0.45 : 1);
        }
        for (let c = 0; c < COLS; c++) {
          const col = st.cols[c] ?? [];
          col.slice(0, ROWS).forEach((t, r) => drawTile(gc, L.colX(c), L.gridY + r * (L.tile + L.gap), L.tile, t.color, t.n, r ? 0.7 : 1));
          if (col.length > ROWS) text(gc, `+${col.length - ROWS}`, L.colX(c) + L.tile / 2, s.h - 6, 11, 'rgba(255,255,255,0.6)');
        }
        if (mode === 'won' && !ants.length) text(gc, 'Delicious!', s.w / 2, L.py + L.ph / 2, 34, '#ffd23f');
        fx.draw(gc);
      },
    };
  });

export default game;
