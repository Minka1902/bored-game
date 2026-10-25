import { canvasGame } from '../../core/canvas-game';
import { BG } from '../../core/color';
import { font } from '../../core/draw';
import { keyDir, singlePointer, swipeDir, wheelSwipe } from '../../core/input';
import { roundRect } from '../../core/math';
import type { GameFactory } from '../../core/types';
import { canMove, emptyBoard, slide, spawn, SIZE, type Board, type Cell, type Dir, type SlideResult } from './logic';

const COLORS: Record<number, string> = {
  2: '#fff6e9', 4: '#ffe14d', 8: '#ffb020', 16: '#ff7a45', 32: '#ff4d6d', 64: '#f472b6',
  128: '#e879f9', 256: '#a855f7', 512: '#6366f1', 1024: '#3b82f6', 2048: '#22d3ee',
};
const tileColor = (v: number) => COLORS[v] ?? '#34d399';
const inkFor = (v: number) => (v >= 256 ? '#ffffff' : '#241544');
const MOVE_S = 0.11;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let board: Board = emptyBoard();
    let score = 0;
    let anim: (SlideResult & { t: number; spawned: Cell | null }) | null = null;
    let over = false;
    let swiped = false;

    const save = () => ctx.store.set('save', over ? null : { board, score });

    const newGame = () => {
      board = spawn(spawn(emptyBoard(), Math.random), Math.random);
      score = 0;
      over = false;
      anim = null;
      ctx.hud.set(0);
      save();
    };

    const saved = ctx.store.get<{ board: Board; score: number } | null>('save', null);
    if (saved && Array.isArray(saved.board) && saved.board.length === SIZE && canMove(saved.board)) {
      board = saved.board;
      score = saved.score;
      ctx.hud.set(score);
    } else newGame();

    const move = (dir: Dir) => {
      if (over) return;
      const res = slide(board, dir);
      if (!res.moved) {
        ctx.sfx.play('tick', 0.6, 0.5);
        return;
      }
      const before = res.board;
      const after = spawn(before, Math.random);
      let spawned: Cell | null = null;
      after.forEach((row, r) => row.forEach((v, c) => v && !before[r][c] && (spawned = [r, c])));
      board = after;
      score += res.gained;
      anim = { ...res, t: 0, spawned };
      ctx.hud.set(score);
      if (res.merges.length) {
        const top = Math.max(...res.merges.map(([r, c]) => before[r][c]));
        ctx.sfx.play('pop', 0.7 + Math.log2(top) * 0.07);
        ctx.haptics.tap();
      } else ctx.sfx.play('click', 1, 0.6);
      if (!canMove(board)) {
        over = true;
        ctx.sfx.play('fail');
        setTimeout(() => ctx.gameOver({ score, retry: newGame }), 700);
      }
      save();
    };

    const layout = () => {
      const B = Math.min(s.w - 24, s.h - 150, 460);
      const gap = B * 0.03;
      const cell = (B - gap * (SIZE + 1)) / SIZE;
      return { x: (s.w - B) / 2, y: 90 + (s.h - 90 - B) / 2, B, gap, cell };
    };

    const drawTile = (g: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, scale = 1) => {
      const L = layout();
      const sz = size * scale;
      const ox = x + (size - sz) / 2;
      const oy = y + (size - sz) / 2;
      g.fillStyle = tileColor(v);
      g.beginPath();
      roundRect(g, ox, oy, sz, sz, L.cell * 0.16);
      g.fill();
      const digits = String(v).length;
      g.font = font(sz * (digits <= 2 ? 0.46 : digits === 3 ? 0.38 : 0.3));
      g.fillStyle = inkFor(v);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(v), ox + sz / 2, oy + sz / 2 + sz * 0.02);
    };

    ctx.hint('Swipe to merge matching numbers');

    return {
      pointer: singlePointer({
        down() {
          swiped = false;
        },
        move(p) {
          const d = swiped ? null : swipeDir(p.x - p.sx, p.y - p.sy, 24);
          if (!d) return;
          swiped = true;
          move(d);
        },
      }),
      wheel: wheelSwipe(move),
      key(e) {
        const d = keyDir(e);
        if (d) {
          e.preventDefault();
          move(d);
        }
      },
      update(dt) {
        if (anim) {
          anim.t += dt;
          if (anim.t > MOVE_S + 0.2) anim = null;
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const L = layout();
        g.fillStyle = '#2a1b4f';
        g.beginPath();
        roundRect(g, L.x, L.y, L.B, L.B, L.cell * 0.2);
        g.fill();
        const pos = (r: number, c: number) => [L.x + L.gap + c * (L.cell + L.gap), L.y + L.gap + r * (L.cell + L.gap)];
        g.fillStyle = '#3a2868';
        for (let r = 0; r < SIZE; r++)
          for (let c = 0; c < SIZE; c++) {
            const [x, y] = pos(r, c);
            g.beginPath();
            roundRect(g, x, y, L.cell, L.cell, L.cell * 0.16);
            g.fill();
          }
        if (anim && anim.t < MOVE_S) {
          const k = anim.t / MOVE_S;
          for (const m of anim.moves) {
            const [x0, y0] = pos(m.from[0], m.from[1]);
            const [x1, y1] = pos(m.to[0], m.to[1]);
            drawTile(g, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, L.cell, m.v);
          }
          return;
        }
        const after = anim ? anim.t - MOVE_S : 1;
        for (let r = 0; r < SIZE; r++)
          for (let c = 0; c < SIZE; c++) {
            const v = board[r][c];
            if (!v) continue;
            const [x, y] = pos(r, c);
            let sc = 1;
            if (anim?.spawned && anim.spawned[0] === r && anim.spawned[1] === c) sc = Math.min(1, after / 0.12);
            else if (anim?.merges.some(([mr, mc]) => mr === r && mc === c)) sc = 1 + 0.14 * Math.sin(Math.min(1, after / 0.15) * Math.PI);
            if (sc > 0) drawTile(g, x, y, L.cell, v, sc);
          }
      },
    };
  });

export default game;
