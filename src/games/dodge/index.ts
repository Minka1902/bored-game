import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { clamp, roundRect, TAU } from '../../core/math';
import { pick } from '../../core/rand';
import type { GameFactory } from '../../core/types';

interface Block {
  x: number;
  y: number;
  s: number;
  v: number;
  color: string;
}

interface Laser {
  horiz: boolean;
  pos: number;
  t: number;
}

const TOP = 70;
const R = 11;
const WARN = 0.9;
const BURN = 0.25;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let x = 0;
    let y = 0;
    let alive = 0;
    let state: 'ready' | 'run' | 'dead' = 'ready';
    let blocks: Block[] = [];
    let spawn = 0;
    let laser: Laser | null = null;
    let nextLaser = 9;
    const keys = new Set<string>();
    const fx = new Particles();

    const reset = () => {
      x = s.w / 2;
      y = s.h * 0.72;
      alive = 0;
      blocks = [];
      spawn = 0.5;
      laser = null;
      nextLaser = 9;
      state = 'ready';
      fx.clear();
      ctx.hud.set('0.0');
    };

    const die = () => {
      state = 'dead';
      ctx.sfx.play('hit');
      ctx.haptics.buzz(70);
      fx.burst(x, y, 30, ['#ffffff', '#22d3ee', '#ffd23f'], { speed: 300 });
      const score = Math.round(alive * 10) / 10;
      setTimeout(() => ctx.gameOver({ score, retry: reset }), 650);
    };

    const nudge = (dx: number, dy: number) => {
      if (state === 'dead') return;
      if (state === 'ready') state = 'run';
      x = clamp(x + dx, R, s.w - R);
      y = clamp(y + dy, TOP + R, s.h - R);
    };

    reset();
    ctx.hint('Drag anywhere to move the dot');

    return {
      pointer: {
        down() {
          ctx.haptics.tap();
        },
        move(p) {
          nudge((p.x - p.px) * 1.25, (p.y - p.py) * 1.25);
        },
      },
      key(e) {
        if (!e.key.startsWith('Arrow')) return;
        e.preventDefault();
        keys.add(e.key);
      },
      keyUp(e) {
        keys.delete(e.key);
      },
      resize() {
        x = clamp(x, R, s.w - R);
        y = clamp(y, TOP + R, s.h - R);
      },
      update(dt) {
        fx.update(dt);
        const kx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
        const ky = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
        if (kx || ky) nudge(kx * 380 * dt, ky * 380 * dt);
        if (state !== 'run') return;
        alive += dt;
        ctx.hud.set(alive.toFixed(1));
        spawn -= dt;
        if (spawn <= 0) {
          spawn = Math.max(0.16, 0.6 - alive * 0.012);
          const size = 18 + Math.random() * 40;
          blocks.push({ x: Math.random() * (s.w - size), y: TOP - size, s: size, v: 150 + Math.random() * 120 + alive * 6, color: pick(PALETTE) });
        }
        for (const b of blocks) b.y += b.v * dt;
        blocks = blocks.filter((b) => b.y < s.h + 10);
        nextLaser -= dt;
        if (!laser && nextLaser <= 0) {
          const horiz = Math.random() < 0.5;
          laser = { horiz, pos: horiz ? TOP + 40 + Math.random() * (s.h - TOP - 80) : 30 + Math.random() * (s.w - 60), t: 0 };
          nextLaser = Math.max(4, 11 - alive * 0.1);
          ctx.sfx.play('blip', 0.5, 0.6);
        }
        if (laser) {
          laser.t += dt;
          if (laser.t >= WARN && laser.t - dt < WARN) {
            ctx.sfx.play('whoosh', 0.5);
            ctx.haptics.bump();
          }
          if (laser.t >= WARN && laser.t < WARN + BURN && Math.abs((laser.horiz ? y : x) - laser.pos) < R + 6) return die();
          if (laser.t >= WARN + BURN) laser = null;
        }
        for (const b of blocks) {
          const nx = clamp(x, b.x, b.x + b.s);
          const ny = clamp(y, b.y, b.y + b.s);
          if ((x - nx) ** 2 + (y - ny) ** 2 < R * R) return die();
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        for (const b of blocks) {
          g.fillStyle = b.color;
          g.beginPath();
          roundRect(g, b.x, b.y, b.s, b.s, b.s * 0.22);
          g.fill();
        }
        if (laser) {
          const firing = laser.t >= WARN;
          g.fillStyle = firing ? '#ff4d6d' : `rgba(255,77,109,${0.25 + 0.25 * Math.sin(laser.t * 30)})`;
          const th = firing ? 12 : 2;
          if (laser.horiz) g.fillRect(0, laser.pos - th / 2, s.w, th);
          else g.fillRect(laser.pos - th / 2, TOP, th, s.h - TOP);
        }
        if (state !== 'dead') {
          g.fillStyle = 'rgba(34,211,238,0.25)';
          g.beginPath();
          g.arc(x, y, R * 2, 0, TAU);
          g.fill();
          g.fillStyle = '#fff6e9';
          g.beginPath();
          g.arc(x, y, R, 0, TAU);
          g.fill();
        }
        fx.draw(g);
      },
    };
  });

export default game;
