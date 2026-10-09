import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE } from '../../core/color';
import { text } from '../../core/draw';
import { Particles } from '../../core/fx/particles';
import { roundRect, TAU } from '../../core/math';
import { remapBodies, World, type Body, type Box } from '../../core/physics/circles';
import type { GameFactory } from '../../core/types';

const MULTS = [10, 3, 1, 0.5, 0.2, 0.5, 1, 3, 10];
const BALLS = 10;
const MAX_ROWS = 11;
const STILL_S = 0.8;
const MAX_NUDGES = 6;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let world = new World();
    let pegs: Body[] = [];
    let flash = new Map<Body, number>();
    let bucketFlash = new Float32Array(MULTS.length);
    let left = BALLS;
    let score = 0;
    let over = false;
    let lastTick = 0;
    let now = 0;
    const fx = new Particles();

    const L = () => {
      const w = Math.min(s.w - 16, 460);
      const x = (s.w - w) / 2;
      const top = Math.max(90, Math.min(150, s.h * 0.22));
      const bucketH = 54;
      const bottom = s.h - 20;
      const bucketTop = bottom - bucketH;
      const spacing = w / (MULTS.length + 1);
      const pegR = Math.max(3, spacing * 0.09);
      const ballR = Math.max(6, spacing * 0.2);
      // rows must stay far enough apart that a ball always fits between diagonal neighbors
      const clear = 2 * pegR + 2 * ballR + 4;
      const minGap = Math.max(spacing * 0.5, Math.sqrt(Math.max(0, clear * clear - (spacing / 2) ** 2)));
      const avail = Math.max(0, bucketTop - 30 - top);
      const rows = Math.max(2, Math.min(MAX_ROWS, Math.floor(avail / minGap) + 1));
      const gapY = avail / Math.max(1, rows - 1);
      return { x, w, top, bottom, bucketTop, gapY, rows, spacing, pegR, ballR, colW: w / MULTS.length };
    };
    const boxOf = (l: ReturnType<typeof L>): Box => ({ x: l.x, y: l.top, w: l.w, h: l.bottom - l.top });
    let built = L();

    const build = () => {
      const l = L();
      world = new World();
      world.gravity = 1100;
      world.restitution = 0.45;
      world.contactDamping = 0.9;
      world.bounds = { l: l.x, r: l.x + l.w, b: l.bottom };
      built = l;
      pegs = [];
      flash = new Map();
      const spacing = l.spacing;
      for (let r = 0; r < l.rows; r++) {
        const count = r % 2 ? MULTS.length : MULTS.length + 1;
        const ox = l.x + (r % 2 ? spacing : spacing / 2);
        for (let i = 0; i < count; i++)
          pegs.push(world.add({ x: ox + i * spacing, y: l.top + r * l.gapY, vx: 0, vy: 0, r: l.pegR, m: 1, static: true }));
      }
      for (let i = 1; i < MULTS.length; i++) world.segments.push({ ax: l.x + i * l.colW, ay: l.bucketTop, bx: l.x + i * l.colW, by: l.bottom });
      world.onContact = (a, b) => {
        const peg = a.static ? a : b.static ? b : null;
        if (!peg) return;
        flash.set(peg, 1);
        if (now - lastTick > 0.035) {
          lastTick = now;
          ctx.sfx.play('tick', 0.9 + Math.random() * 0.6, 0.5);
        }
      };
    };

    const reset = () => {
      build();
      left = BALLS;
      score = 0;
      over = false;
      ctx.hud.set(0);
      ctx.hud.sub(`${left} balls`);
    };

    const drop = (x: number) => {
      if (over || left <= 0) return;
      const l = L();
      const r = l.ballR;
      left--;
      ctx.hud.sub(`${left} ${left === 1 ? 'ball' : 'balls'}`);
      world.add({ x: Math.min(l.x + l.w - r, Math.max(l.x + r, x + (Math.random() - 0.5) * 4)), y: l.top - 50, vx: 0, vy: 0, r, m: 1, data: { still: 0, nudges: 0 } });
      ctx.sfx.play('blip', 1.1, 0.5);
      ctx.haptics.tap();
    };

    reset();
    ctx.hint('Tap to drop · 10 balls');

    return {
      pointer: { down: (p) => drop(p.x) },
      key(e) {
        if (e.key === ' ') {
          e.preventDefault();
          drop(s.w / 2);
        }
      },
      resize() {
        // rebuild the board for the new size and carry balls in flight across, so the round can still finish
        const from = boxOf(built);
        const balls = world.bodies.filter((b) => !b.static);
        build();
        remapBodies(balls, from, boxOf(built));
        for (const b of balls) world.add(b);
      },
      update(dt) {
        now += dt;
        fx.update(dt);
        for (const [p, v] of flash) {
          const n = v - dt * 4;
          if (n <= 0) flash.delete(p);
          else flash.set(p, n);
        }
        for (let i = 0; i < bucketFlash.length; i++) bucketFlash[i] = Math.max(0, bucketFlash[i] - dt * 2);
        world.step(dt, 4);
        const l = L();
        for (const b of [...world.bodies]) {
          if (b.static) continue;
          if (b.y < l.bucketTop + 10) {
            // a ball resting on pegs gets a nudge; one that stays stuck is scored where it is
            b.data.still = Math.hypot(b.vx, b.vy) < 25 ? b.data.still + dt : 0;
            if (b.data.still < STILL_S) continue;
            b.data.still = 0;
            if (++b.data.nudges <= MAX_NUDGES) {
              b.vx += (Math.random() < 0.5 ? -1 : 1) * 140;
              b.vy -= 90;
              continue;
            }
          } else if (Math.abs(b.vy) > 60 && b.y < l.bottom - b.r - 2) continue;
          const i = Math.max(0, Math.min(MULTS.length - 1, Math.floor((b.x - l.x) / l.colW)));
          const gained = Math.round(MULTS[i] * 100);
          score += gained;
          ctx.hud.set(score);
          bucketFlash[i] = 1;
          world.remove(b);
          fx.burst(b.x, l.bucketTop, 12 + MULTS[i] * 2, PALETTE, { speed: 160 + MULTS[i] * 25 });
          ctx.sfx.play(MULTS[i] >= 3 ? 'win' : MULTS[i] >= 1 ? 'score' : 'thud');
          ctx.haptics.tap();
        }
        if (!over && left === 0 && world.bodies.every((b) => b.static)) {
          over = true;
          setTimeout(() => ctx.gameOver({ score, retry: reset }), 500);
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const l = L();
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.fillRect(l.x, l.top - 70, l.w, 40);
        text(g, 'tap here or anywhere to drop', s.w / 2, l.top - 50, 13, 'rgba(255,246,233,0.35)', 'center', 700);
        for (const p of world.bodies) {
          if (p.static) {
            const f = flash.get(p) ?? 0;
            g.fillStyle = f > 0 ? `rgba(255,210,63,${0.4 + f * 0.6})` : 'rgba(255,246,233,0.55)';
            g.beginPath();
            g.arc(p.x, p.y, p.r * (1 + f * 0.4), 0, TAU);
            g.fill();
          } else {
            g.fillStyle = '#ff4d6d';
            g.beginPath();
            g.arc(p.x, p.y, p.r, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.6)';
            g.beginPath();
            g.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.3, 0, TAU);
            g.fill();
          }
        }
        MULTS.forEach((m, i) => {
          const x = l.x + i * l.colW;
          const hot = m >= 3 ? '#ff4d6d' : m >= 1 ? '#ffb020' : '#6366f1';
          g.fillStyle = hot;
          g.globalAlpha = 0.55 + bucketFlash[i] * 0.45;
          g.beginPath();
          roundRect(g, x + 2, l.bucketTop + 8, l.colW - 4, l.bottom - l.bucketTop - 8, 8);
          g.fill();
          g.globalAlpha = 1;
          text(g, `${m}×`, x + l.colW / 2, (l.bucketTop + l.bottom) / 2 + 4, Math.min(15, l.colW * 0.32), '#fff6e9');
        });
        fx.draw(g);
      },
    };
  });

export default game;
