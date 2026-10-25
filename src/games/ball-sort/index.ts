import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE, shade } from '../../core/color';
import { text } from '../../core/draw';
import { Particles } from '../../core/fx/particles';
import { roundRect, TAU } from '../../core/math';
import { levelRng } from '../../core/rand';
import type { GameFactory } from '../../core/types';
import { canPour, generate, isSolved, pour, type Tubes } from './logic';

const CAP = 4;
const BALL_COLORS = ['#ff4d6d', '#3b82f6', '#ffe14d', '#34d399', '#a855f7', '#ff7a45', '#22d3ee'];
const BAR = 70;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let level = ctx.store.get('level', 1);
    let tubes: Tubes = [];
    let start: Tubes = [];
    let history: Tubes[] = [];
    let sel = -1;
    let winT = -1;
    let shakeT = 0;
    let shakeIx = -1;
    const fx = new Particles();

    const colorsFor = (lv: number) => Math.min(7, 3 + Math.floor((lv - 1) / 2));

    const newLevel = () => {
      tubes = generate(colorsFor(level), CAP, levelRng(ctx.store));
      start = tubes.map((t) => t.slice());
      history = [];
      sel = -1;
      winT = -1;
      ctx.hud.set(`Level ${level}`);
    };

    const layout = () => {
      const n = tubes.length;
      const perRow = n <= 5 ? n : Math.ceil(n / 2);
      const rows = Math.ceil(n / perRow);
      const availH = s.h - 90 - BAR;
      const tw = Math.min(64, ((s.w - 24) / perRow) * 0.66, (availH / rows - 40) / (CAP * 1.15 + 0.5));
      const r = tw * 0.4;
      const th = CAP * r * 2.15 + r * 0.8;
      const gapX = (s.w - perRow * tw) / (perRow + 1);
      const rowH = th + r * 3.2;
      const top = 90 + (availH - rows * rowH) / 2 + r * 2.6;
      return Array.from({ length: n }, (_, i) => {
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, n - row * perRow);
        const gx = (s.w - inRow * tw) / (inRow + 1);
        const col = i % perRow;
        return { x: gx + col * (tw + gx), y: top + row * rowH, w: tw, h: th, r, gapX };
      });
    };

    const tubeAt = (x: number, y: number) =>
      layout().findIndex((t) => x >= t.x - t.gapX / 2 && x <= t.x + t.w + t.gapX / 2 && y >= t.y - t.r * 3 && y <= t.y + t.h + 10);

    const chips = () => {
      const w = Math.min(150, (s.w - 36) / 2);
      return [
        { label: '↶ Undo', x: s.w / 2 - w - 6, y: s.h - BAR + 10, w, h: BAR - 24 },
        { label: '↻ Restart', x: s.w / 2 + 6, y: s.h - BAR + 10, w, h: BAR - 24 },
      ];
    };

    const tap = (x: number, y: number) => {
      if (winT >= 0) return;
      const ch = chips();
      if (y >= ch[0].y) {
        if (x >= ch[0].x && x <= ch[0].x + ch[0].w && history.length) {
          tubes = history.pop()!;
          sel = -1;
          ctx.sfx.play('whoosh', 1.4, 0.3);
        } else if (x >= ch[1].x && x <= ch[1].x + ch[1].w) {
          tubes = start.map((t) => t.slice());
          history = [];
          sel = -1;
          ctx.sfx.play('whoosh', 0.9, 0.3);
        }
        return;
      }
      const i = tubeAt(x, y);
      if (i < 0) {
        sel = -1;
        return;
      }
      if (sel < 0) {
        if (tubes[i].length) {
          sel = i;
          ctx.sfx.play('tick', 1.3);
          ctx.haptics.tap();
        }
        return;
      }
      if (sel === i) {
        sel = -1;
        ctx.sfx.play('tick', 0.9);
        return;
      }
      if (canPour(tubes, sel, i, CAP)) {
        history.push(tubes.map((t) => t.slice()));
        tubes = pour(tubes, sel, i, CAP);
        ctx.sfx.play('pop', 0.9 + Math.random() * 0.3);
        ctx.haptics.tap();
        const t = tubes[i];
        if (t.length === CAP && t.every((v) => v === t[0])) {
          const L = layout()[i];
          fx.burst(L.x + L.w / 2, L.y, 16, [BALL_COLORS[t[0]], '#ffffff'], { speed: 200, angle: -Math.PI / 2, spread: 1.6 });
          ctx.sfx.play('score');
        }
        sel = -1;
        if (isSolved(tubes, CAP)) {
          winT = 0;
          level++;
          ctx.store.set('level', level);
          ctx.store.set('seed', 0);
          ctx.submitScore(level - 1);
          ctx.sfx.play('win');
          ctx.haptics.bump();
          fx.burst(s.w / 2, s.h / 2, 70, PALETTE, { speed: 450, life: 1.1 });
        }
      } else {
        shakeIx = i;
        shakeT = 0.3;
        sel = -1;
        ctx.sfx.play('click', 0.6);
      }
    };

    newLevel();
    ctx.hud.sub(`${level - 1} solved`);
    ctx.hint('Tap a tube, then tap where to pour');

    return {
      pointer: { down: (p) => tap(p.x, p.y) },
      update(dt) {
        fx.update(dt);
        shakeT = Math.max(0, shakeT - dt);
        if (winT >= 0) {
          winT += dt;
          if (winT > 1) {
            ctx.hud.sub(`${level - 1} solved`);
            newLevel();
          }
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        layout().forEach((L, i) => {
          const dx = i === shakeIx && shakeT > 0 ? Math.sin(shakeT * 60) * 5 : 0;
          const lift = i === sel ? 1 : 0;
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.strokeStyle = i === sel ? '#ffd23f' : 'rgba(255,255,255,0.35)';
          g.lineWidth = 3;
          g.beginPath();
          roundRect(g, L.x + dx, L.y, L.w, L.h, L.w * 0.45);
          g.fill();
          g.stroke();
          const t = tubes[i];
          t.forEach((c, k) => {
            const isTop = k === t.length - 1;
            const by = isTop && lift ? L.y - L.r * 1.6 : L.y + L.h - L.r * 1.25 - k * L.r * 2.15;
            const color = BALL_COLORS[c];
            g.fillStyle = shade(color, -0.25);
            g.beginPath();
            g.arc(L.x + L.w / 2 + dx, by, L.r, 0, TAU);
            g.fill();
            g.fillStyle = color;
            g.beginPath();
            g.arc(L.x + L.w / 2 + dx - L.r * 0.06, by - L.r * 0.08, L.r * 0.86, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.5)';
            g.beginPath();
            g.arc(L.x + L.w / 2 + dx - L.r * 0.3, by - L.r * 0.35, L.r * 0.22, 0, TAU);
            g.fill();
          });
        });
        for (const c of chips()) {
          g.fillStyle = '#2a1b4f';
          g.beginPath();
          roundRect(g, c.x, c.y, c.w, c.h, 14);
          g.fill();
          text(g, c.label, c.x + c.w / 2, c.y + c.h / 2 + 1, 16, '#fff6e9');
        }
        if (winT >= 0) text(g, 'Sorted!', s.w / 2, 120, 34, '#ffd23f');
        fx.draw(g);
      },
    };
  });

export default game;
