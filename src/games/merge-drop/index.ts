import { canvasGame } from '../../core/canvas-game';
import { BG, shade } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { clamp, roundRect, TAU } from '../../core/math';
import { World, type Body } from '../../core/physics/circles';
import type { GameFactory } from '../../core/types';
import { DROPPABLE, mergeResult, TIERS } from './logic';

const COOLDOWN = 0.45;
const OVER_S = 1.6;

interface Ball extends Body {
  data: { tier: number; age: number; over: number; dead?: boolean };
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let world = new World();
    let score = 0;
    let next = 0;
    let aimX = 0;
    let cool = 0;
    let over = false;
    let danger = 0;
    let lastHit = 0;
    let now = 0;
    const fx = new Particles();

    const box = () => {
      const w = Math.min(s.w - 24, 430);
      const top = 150;
      const h = Math.min(s.h - top - 20, w * 1.45);
      return { x: (s.w - w) / 2, y: top, w, h, k: w / 400 };
    };
    const loseY = () => box().y + 8;
    const radius = (tier: number) => TIERS[tier].r * box().k;
    const randTier = () => Math.floor(Math.pow(Math.random(), 1.6) * DROPPABLE);

    const setup = () => {
      const b = box();
      world = new World();
      world.gravity = 1500 * b.k;
      world.restitution = 0.15;
      world.contactDamping = 0.25;
      world.bounds = { l: b.x, r: b.x + b.w, b: b.y + b.h };
      world.onContact = (_a, _c, j) => {
        if (j > 120 * b.k && now - lastHit > 0.06) {
          lastHit = now;
          ctx.sfx.play('tick', 0.5 + Math.random() * 0.3, Math.min(1, j / (900 * b.k)));
        }
      };
    };

    const reset = () => {
      setup();
      score = 0;
      next = randTier();
      aimX = s.w / 2;
      cool = 0;
      over = false;
      ctx.hud.set(0);
    };

    const drop = () => {
      if (over || cool > 0) return;
      const b = box();
      const r = radius(next);
      const x = clamp(aimX, b.x + r, b.x + b.w - r);
      world.add({ x, y: b.y - r - 6, vx: 0, vy: 0, r, m: r * r, data: { tier: next, age: 0, over: 0 } } as Ball);
      next = randTier();
      cool = COOLDOWN;
      ctx.sfx.play('blip', 0.9, 0.5);
      ctx.haptics.tap();
    };

    const merges = () => {
      const bodies = world.bodies as Ball[];
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.data.dead) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const c = bodies[j];
          if (c.data.dead || a.data.tier !== c.data.tier) continue;
          if (Math.hypot(a.x - c.x, a.y - c.y) > a.r + c.r + 1.5) continue;
          const res = mergeResult(a.data.tier, c.data.tier)!;
          a.data.dead = c.data.dead = true;
          const mx = (a.x + c.x) / 2;
          const my = (a.y + c.y) / 2;
          score += res.points;
          ctx.hud.set(score);
          const color = TIERS[a.data.tier].color;
          fx.burst(mx, my, 14 + a.data.tier * 2, [color, '#ffffff'], { speed: 180 + a.data.tier * 20 });
          ctx.sfx.play('pop', 1.3 - a.data.tier * 0.07);
          ctx.haptics.tap();
          if (res.tier >= 0) {
            const r = radius(res.tier);
            world.add({ x: mx, y: my, vx: (a.vx + c.vx) / 2, vy: Math.min(a.vy, c.vy) - 120 * box().k, r, m: r * r, data: { tier: res.tier, age: 1, over: 0 } } as Ball);
          } else ctx.sfx.play('win');
          break;
        }
      }
      world.bodies = world.bodies.filter((b) => !(b as Ball).data.dead);
    };

    reset();
    ctx.hint('Drag to aim · let go to drop');

    return {
      pointer: {
        down(p) {
          aimX = p.x;
        },
        move(p) {
          aimX = p.x;
        },
        up(p) {
          aimX = p.x;
          drop();
        },
        hover(x) {
          aimX = x;
        },
      },
      key(e) {
        if (e.key === 'ArrowLeft') aimX -= 24;
        if (e.key === 'ArrowRight') aimX += 24;
        if (e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          drop();
        }
      },
      resize() {
        if (!world.bodies.length) reset();
      },
      update(dt) {
        now += dt;
        fx.update(dt);
        cool = Math.max(0, cool - dt);
        if (over) return;
        world.step(dt, 6);
        merges();
        danger = 0;
        for (const b of world.bodies as Ball[]) {
          b.data.age += dt;
          if (b.data.age > 1 && b.y - b.r < loseY() && Math.abs(b.vy) < 200) {
            b.data.over += dt;
            danger = Math.max(danger, b.data.over / OVER_S);
            if (b.data.over > OVER_S) {
              over = true;
              ctx.sfx.play('fail');
              ctx.haptics.buzz(80);
              setTimeout(() => ctx.gameOver({ score, retry: reset }), 700);
              return;
            }
          } else b.data.over = 0;
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const b = box();
        g.fillStyle = '#2a1b4f';
        g.beginPath();
        roundRect(g, b.x - 6, b.y - 10, b.w + 12, b.h + 16, 18);
        g.fill();
        g.fillStyle = danger > 0 ? `rgba(255,77,109,${0.4 + 0.4 * Math.sin(now * 20)})` : 'rgba(255,255,255,0.15)';
        g.fillRect(b.x, loseY(), b.w, 2);
        const drawBall = (x: number, y: number, tier: number, alpha = 1) => {
          const r = radius(tier);
          const c = TIERS[tier].color;
          g.globalAlpha = alpha;
          g.fillStyle = shade(c, -0.25);
          g.beginPath();
          g.arc(x, y, r, 0, TAU);
          g.fill();
          g.fillStyle = c;
          g.beginPath();
          g.arc(x - r * 0.05, y - r * 0.07, r * 0.9, 0, TAU);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.45)';
          g.beginPath();
          g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.22, r * 0.12, -0.6, 0, TAU);
          g.fill();
          g.fillStyle = '#1d1238';
          g.beginPath();
          g.arc(x - r * 0.25, y, r * 0.09, 0, TAU);
          g.arc(x + r * 0.25, y, r * 0.09, 0, TAU);
          g.fill();
          g.strokeStyle = '#1d1238';
          g.lineWidth = Math.max(1.5, r * 0.06);
          g.beginPath();
          g.arc(x, y + r * 0.12, r * 0.18, 0.3, Math.PI - 0.3);
          g.stroke();
          g.globalAlpha = 1;
        };
        for (const body of world.bodies as Ball[]) drawBall(body.x, body.y, body.data.tier);
        if (!over) {
          const r = radius(next);
          const x = clamp(aimX, b.x + r, b.x + b.w - r);
          g.strokeStyle = 'rgba(255,255,255,0.2)';
          g.setLineDash([5, 7]);
          g.beginPath();
          g.moveTo(x, b.y - r);
          g.lineTo(x, b.y + b.h);
          g.stroke();
          g.setLineDash([]);
          drawBall(x, b.y - r - 6, next, cool > 0 ? 0.4 : 1);
        }
        fx.draw(g);
      },
    };
  });

export default game;
