import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE, shade } from '../../core/color';
import { text } from '../../core/draw';
import { Particles } from '../../core/fx/particles';
import { Shake } from '../../core/fx/shake';
import { segDist, TAU } from '../../core/math';
import { pick } from '../../core/rand';
import type { GameFactory } from '../../core/types';

interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  rot: number;
  vr: number;
  bomb: boolean;
  cut: boolean;
}

interface Half {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  rot: number;
  vr: number;
  side: number;
}

interface Popup {
  x: number;
  y: number;
  t: number;
  label: string;
}

const LIVES = 3;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let fruits: Fruit[] = [];
    let halves: Half[] = [];
    let popups: Popup[] = [];
    let trail: { x: number; y: number; t: number }[] = [];
    let wave = 1;
    let score = 0;
    let lives = LIVES;
    let over = false;
    let now = 0;
    let strokeHits = 0;
    let strokeT = 0;
    const fx = new Particles();
    const shake = new Shake();

    const u = () => s.h / 720;
    const G = () => 1000 * u();

    const reset = () => {
      fruits = [];
      halves = [];
      popups = [];
      score = 0;
      lives = LIVES;
      over = false;
      wave = 1;
      ctx.hud.set(0);
      ctx.hud.sub('♥'.repeat(lives));
    };

    const launch = () => {
      const n = 1 + Math.floor(Math.random() * Math.min(4, 1 + score / 15));
      const bombChance = score < 5 ? 0 : Math.min(0.22, 0.08 + score / 300);
      for (let i = 0; i < n; i++) {
        const x = s.w * (0.15 + Math.random() * 0.7);
        const peak = s.h * (0.15 + Math.random() * 0.35);
        const vy = -Math.sqrt(2 * G() * (s.h - peak));
        fruits.push({
          x, y: s.h + 40, vx: (s.w / 2 - x) * (0.3 + Math.random() * 0.5), vy,
          r: Math.max(24, Math.min(40, s.w * 0.075)), color: pick(PALETTE), rot: 0, vr: (Math.random() - 0.5) * 4,
          bomb: Math.random() < bombChance, cut: false,
        });
      }
      ctx.sfx.play('whoosh', 0.7, 0.3);
    };

    const end = () => {
      over = true;
      ctx.sfx.play('fail');
      setTimeout(() => ctx.gameOver({ score, retry: reset }), 900);
    };

    const sliceSeg = (x0: number, y0: number, x1: number, y1: number) => {
      if (over) return;
      for (const f of fruits) {
        if (f.cut || segDist(f.x, f.y, x0, y0, x1, y1) > f.r) continue;
        f.cut = true;
        if (f.bomb) {
          shake.add(1);
          fx.burst(f.x, f.y, 50, ['#ffffff', '#ffd23f', '#ff7a45', '#1d1238'], { speed: 500, life: 0.9 });
          ctx.sfx.play('thud', 0.5);
          ctx.sfx.play('hit', 0.6);
          ctx.haptics.buzz(120);
          end();
          return;
        }
        const ang = Math.atan2(y1 - y0, x1 - x0);
        for (const side of [-1, 1])
          halves.push({
            x: f.x, y: f.y, vx: f.vx + Math.cos(ang + (side * Math.PI) / 2) * 120, vy: f.vy * 0.4 + Math.sin(ang + (side * Math.PI) / 2) * 120,
            r: f.r, color: f.color, rot: ang, vr: side * 3, side,
          });
        fx.burst(f.x, f.y, 16, [f.color, shade(f.color, 0.5)], { speed: 300, size: 6 });
        score++;
        strokeHits++;
        ctx.hud.set(score);
        ctx.sfx.play('pop', 0.9 + Math.random() * 0.4);
        ctx.sfx.play('snare', 1.6, 0.25);
        ctx.haptics.tap();
        if (strokeHits === 3) {
          score += 3;
          ctx.hud.set(score);
          popups.push({ x: f.x, y: f.y - 30, t: 0, label: 'Combo +3' });
          ctx.sfx.play('score');
        }
      }
    };

    reset();
    ctx.hint('Swipe to slice · avoid bombs');

    return {
      pointer: {
        down(p) {
          trail = [{ x: p.x, y: p.y, t: now }];
          strokeHits = 0;
          strokeT = now;
        },
        move(p) {
          trail.push({ x: p.x, y: p.y, t: now });
          if (now - strokeT > 0.6) {
            strokeHits = 0;
            strokeT = now;
          }
          sliceSeg(p.px, p.py, p.x, p.y);
        },
      },
      update(dt) {
        now += dt;
        fx.update(dt);
        shake.update(dt);
        trail = trail.filter((p) => now - p.t < 0.12);
        if (!over) {
          wave -= dt;
          if (wave <= 0) {
            wave = Math.max(0.7, 1.6 - score * 0.012) + Math.random() * 0.5;
            launch();
          }
        }
        const g = G();
        for (const f of fruits) {
          f.vy += g * dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.rot += f.vr * dt;
        }
        for (const h of halves) {
          h.vy += g * dt;
          h.x += h.vx * dt;
          h.y += h.vy * dt;
          h.rot += h.vr * dt;
        }
        const fell = fruits.filter((f) => !f.cut && f.vy > 0 && f.y - f.r > s.h);
        fruits = fruits.filter((f) => !f.cut && !(f.vy > 0 && f.y - f.r > s.h));
        halves = halves.filter((h) => h.y - h.r < s.h + 40);
        if (!over)
          for (const f of fell)
            if (!f.bomb) {
              lives--;
              ctx.hud.sub('♥'.repeat(Math.max(0, lives)));
              ctx.sfx.play('fail', 1.8, 0.4);
              ctx.haptics.bump();
              if (lives <= 0) {
                end();
                break;
              }
            }
        for (const p of popups) p.t += dt;
        popups = popups.filter((p) => p.t < 0.8);
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        g.save();
        shake.apply(g);
        for (const f of fruits) {
          g.save();
          g.translate(f.x, f.y);
          g.rotate(f.rot);
          if (f.bomb) {
            g.fillStyle = '#120a24';
            g.beginPath();
            g.arc(0, 0, f.r, 0, TAU);
            g.fill();
            g.strokeStyle = '#ff4d6d';
            g.lineWidth = 3;
            g.stroke();
            g.fillStyle = Math.sin(now * 20) > 0 ? '#ffd23f' : '#ff7a45';
            g.beginPath();
            g.arc(0, -f.r - 6, 5, 0, TAU);
            g.fill();
            text(g, '✕', 0, 2, f.r * 0.9, '#ff4d6d');
          } else {
            g.fillStyle = shade(f.color, -0.2);
            g.beginPath();
            g.arc(0, 0, f.r, 0, TAU);
            g.fill();
            g.fillStyle = f.color;
            g.beginPath();
            g.arc(-f.r * 0.08, -f.r * 0.08, f.r * 0.88, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.5)';
            g.beginPath();
            g.ellipse(-f.r * 0.35, -f.r * 0.4, f.r * 0.25, f.r * 0.13, -0.6, 0, TAU);
            g.fill();
          }
          g.restore();
        }
        for (const h of halves) {
          g.save();
          g.translate(h.x, h.y);
          g.rotate(h.rot);
          g.fillStyle = h.color;
          g.beginPath();
          g.arc(0, 0, h.r, h.side > 0 ? 0 : Math.PI, h.side > 0 ? Math.PI : TAU);
          g.fill();
          g.fillStyle = shade(h.color, 0.6);
          g.beginPath();
          g.ellipse(0, 0, h.r * 0.85, h.r * 0.12, 0, 0, TAU);
          g.fill();
          g.restore();
        }
        fx.draw(g);
        g.restore();
        if (trail.length > 1) {
          g.lineCap = 'round';
          for (let i = 1; i < trail.length; i++) {
            const k = i / trail.length;
            g.strokeStyle = `rgba(255,255,255,${k})`;
            g.lineWidth = 2 + k * 6;
            g.beginPath();
            g.moveTo(trail[i - 1].x, trail[i - 1].y);
            g.lineTo(trail[i].x, trail[i].y);
            g.stroke();
          }
        }
        for (const p of popups) text(g, p.label, p.x, p.y - p.t * 40, 22, `rgba(255,210,63,${1 - p.t / 0.8})`);
      },
    };
  });

export default game;
