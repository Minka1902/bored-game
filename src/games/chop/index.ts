import { canvasGame } from '../../core/canvas-game';
import { Particles } from '../../core/fx/particles';
import { clamp, roundRect, TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

type Side = 'L' | 'R';
type Branch = Side | null;

interface Flyer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  branch: Branch;
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let segs: Branch[] = [];
    let side: Side = 'L';
    let time = 1;
    let score = 0;
    let started = false;
    let over = false;
    let swing = 0;
    const flyers: Flyer[] = [];
    const fx = new Particles();

    const SH = () => clamp(s.h / 9, 46, 80);
    const groundY = () => s.h - 70;
    const trunkW = () => SH() * 1.1;
    const visible = () => Math.ceil(groundY() / SH()) + 1;

    const nextBranch = (prev: Branch): Branch => {
      if (prev) return Math.random() < 0.6 ? null : prev;
      const r = Math.random();
      return r < 0.4 ? null : r < 0.7 ? 'L' : 'R';
    };

    const reset = () => {
      segs = [null, null];
      while (segs.length < visible() + 2) segs.push(nextBranch(segs[segs.length - 1]));
      side = 'L';
      time = 1;
      score = 0;
      started = false;
      over = false;
      flyers.length = 0;
      ctx.hud.set(0);
    };

    const die = () => {
      over = true;
      ctx.sfx.play('hit');
      ctx.haptics.buzz(70);
      setTimeout(() => ctx.gameOver({ score, retry: reset }), 800);
    };

    const chop = (to: Side) => {
      if (over) return;
      started = true;
      side = to;
      swing = 1;
      if (segs[0] === side) return die();
      const cut = segs.shift()!;
      flyers.push({ x: s.w / 2, y: groundY() - SH() / 2, vx: side === 'L' ? 520 : -520, vy: -260, rot: 0, branch: cut });
      segs.push(nextBranch(segs[segs.length - 1]));
      score++;
      time = Math.min(1, time + 0.11);
      ctx.hud.set(score);
      ctx.sfx.play('thud', 1.2 + Math.random() * 0.2);
      ctx.sfx.play('click', 0.6, 0.5);
      ctx.haptics.tap();
      fx.burst(s.w / 2 + (side === 'L' ? -trunkW() / 2 : trunkW() / 2), groundY() - SH() / 2, 6, ['#e0a96d', '#c08552'], { speed: 200, square: true });
      if (segs[0] === side) die();
    };

    reset();
    ctx.hint('Tap left or right to chop');

    const drawSeg = (g: CanvasRenderingContext2D, x: number, y: number, b: Branch) => {
      const w = trunkW();
      const h = SH();
      g.fillStyle = '#8b5a2b';
      g.fillRect(x - w / 2, y - h / 2, w, h + 1);
      g.fillStyle = '#a86b3c';
      g.fillRect(x - w / 2 + w * 0.15, y - h / 2, w * 0.2, h + 1);
      g.fillStyle = '#6f4420';
      g.fillRect(x + w * 0.25, y - h / 2, w * 0.12, h + 1);
      if (b) {
        const dir = b === 'L' ? -1 : 1;
        const bx = x + dir * w * 0.5;
        g.fillStyle = '#8b5a2b';
        g.fillRect(dir < 0 ? bx - w * 1.4 : bx, y - h * 0.18, w * 1.4, h * 0.26);
        g.fillStyle = '#34d399';
        g.beginPath();
        g.ellipse(bx + dir * w * 1.35, y - h * 0.1, w * 0.45, h * 0.35, 0, 0, TAU);
        g.fill();
      }
    };

    return {
      pointer: { down: (p) => chop(p.x < s.w / 2 ? 'L' : 'R') },
      key(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a') chop('L');
        if (e.key === 'ArrowRight' || e.key === 'd') chop('R');
      },
      resize() {
        while (segs.length < visible() + 2) segs.push(nextBranch(segs[segs.length - 1]));
      },
      update(dt) {
        fx.update(dt);
        swing = Math.max(0, swing - dt * 7);
        for (const f of flyers) {
          f.vy += 1500 * dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.rot += (f.vx > 0 ? 6 : -6) * dt;
        }
        for (let i = flyers.length - 1; i >= 0; i--) if (flyers[i].y > s.h + 100) flyers.splice(i, 1);
        if (started && !over) {
          time -= (0.22 + score * 0.004) * dt;
          if (time <= 0) {
            time = 0;
            die();
          }
        }
      },
      render(g) {
        const sky = g.createLinearGradient(0, 0, 0, s.h);
        sky.addColorStop(0, '#22d3ee');
        sky.addColorStop(1, '#a5f3fc');
        g.fillStyle = sky;
        g.fillRect(0, 0, s.w, s.h);
        const x = s.w / 2;
        for (let i = 0; i < segs.length; i++) drawSeg(g, x, groundY() - SH() * (i + 0.5), segs[i]);
        for (const f of flyers) {
          g.save();
          g.translate(f.x, f.y);
          g.rotate(f.rot);
          drawSeg(g, 0, 0, f.branch);
          g.restore();
        }
        g.fillStyle = '#4ade80';
        g.fillRect(0, groundY(), s.w, s.h - groundY());
        g.fillStyle = '#22c55e';
        g.fillRect(0, groundY(), s.w, 8);
        // lumberjack
        const dir = side === 'L' ? -1 : 1;
        const px = x + dir * (trunkW() / 2 + 34);
        const py = groundY();
        g.fillStyle = over ? '#9ca3af' : '#ff4d6d';
        g.beginPath();
        roundRect(g, px - 15, py - 52, 30, 40, 9);
        g.fill();
        g.fillStyle = '#ffd6a5';
        g.beginPath();
        g.arc(px, py - 64, 13, 0, TAU);
        g.fill();
        g.fillStyle = '#241544';
        g.fillRect(px - 13, py - 12, 10, 12);
        g.fillRect(px + 3, py - 12, 10, 12);
        g.save();
        g.translate(px - dir * 6, py - 40);
        g.rotate(-dir * (0.3 + swing * 1.4) + (dir < 0 ? Math.PI : 0));
        g.fillStyle = '#7c4a22';
        g.fillRect(0, -3, 34, 6);
        g.fillStyle = '#d1d5db';
        g.fillRect(28, -11, 12, 16);
        g.restore();
        fx.draw(g);
        // time bar
        const bw = Math.min(260, s.w * 0.6);
        g.fillStyle = 'rgba(29,18,56,0.35)';
        g.beginPath();
        roundRect(g, (s.w - bw) / 2, 74, bw, 14, 7);
        g.fill();
        g.fillStyle = time > 0.3 ? '#ffd23f' : '#ff4d6d';
        g.beginPath();
        roundRect(g, (s.w - bw) / 2, 74, Math.max(14, bw * time), 14, 7);
        g.fill();
      },
    };
  });

export default game;
