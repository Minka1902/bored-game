import { canvasGame } from '../../core/canvas-game';
import { BG, shade } from '../../core/color';
import { easeOutCubic } from '../../core/ease';
import type { GameFactory } from '../../core/types';

const SOAPS = ['#f9a8d4', '#a5f3fc', '#bbf7d0', '#fde68a', '#c4b5fd', '#fecaca', '#99f6e4'];
const LAYERS = 8;

interface Crumb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  rot: number;
  vr: number;
  color: string;
  rest: number;
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let color = SOAPS[0];
    let layers = LAYERS;
    let slideT = 1;
    let blocks = ctx.store.get('blocks', 0);
    let cutThisStroke = false;
    const crumbs: Crumb[] = [];
    const trail: { x: number; y: number; t: number }[] = [];
    let now = 0;

    const box = () => {
      const w = Math.min(s.w * 0.62, 300);
      const full = w * 0.75;
      const depth = w * 0.22;
      const x = (s.w - w) / 2 - depth / 4;
      const floor = s.h * 0.72;
      const h = (full * layers) / LAYERS;
      const slide = (1 - easeOutCubic(slideT)) * s.w;
      return { x: x + slide, y: floor - h, w, h, full, depth, floor };
    };

    const newBlock = () => {
      color = SOAPS[(SOAPS.indexOf(color) + 1 + Math.floor(Math.random() * (SOAPS.length - 1))) % SOAPS.length];
      layers = LAYERS;
      slideT = 0;
    };

    const cut = () => {
      if (slideT < 1 || layers <= 0) return;
      const b = box();
      const lh = b.full / LAYERS;
      const n = 9;
      const cs = b.w / n;
      for (let i = 0; i < n; i++)
        for (let k = 0; k < 2; k++)
          crumbs.push({
            x: b.x + (i + 0.5) * cs + k * b.depth * 0.4,
            y: b.y + lh / 2 - k * b.depth * 0.25,
            vx: (Math.random() - 0.3) * 160,
            vy: -Math.random() * 120,
            s: cs * (0.7 + Math.random() * 0.35),
            rot: 0,
            vr: (Math.random() - 0.5) * 8,
            color: shade(color, (Math.random() - 0.5) * 0.15),
            rest: 0,
          });
      layers--;
      ctx.sfx.play('thud', 1.7 + Math.random() * 0.3, 0.7);
      ctx.sfx.play('hat', 0.4, 0.5);
      ctx.haptics.bump();
      if (layers === 0) {
        blocks++;
        ctx.store.set('blocks', blocks);
        ctx.hud.set(blocks);
        setTimeout(newBlock, 450);
      }
    };

    ctx.hud.set(blocks);
    ctx.hud.sub('blocks cut');
    ctx.hint('Swipe across the soap');

    return {
      pointer: {
        down(p) {
          cutThisStroke = false;
          trail.length = 0;
          trail.push({ x: p.x, y: p.y, t: now });
        },
        move(p) {
          trail.push({ x: p.x, y: p.y, t: now });
          const b = box();
          if (!cutThisStroke && Math.abs(p.x - p.sx) > b.w * 0.45 && p.y > b.y - 60 && p.y < b.floor) {
            cutThisStroke = true;
            cut();
          }
        },
      },
      update(dt) {
        now += dt;
        slideT = Math.min(1, slideT + dt / 0.45);
        while (trail.length && now - trail[0].t > 0.15) trail.shift();
        const floor = box().floor;
        for (const c of crumbs) {
          if (c.rest > 0) {
            c.rest += dt;
            continue;
          }
          c.vy += 1300 * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.rot += c.vr * dt;
          if (c.y + c.s / 2 > floor + 30) {
            c.y = floor + 30 - c.s / 2;
            if (Math.abs(c.vy) < 120) c.rest = 0.001;
            c.vy *= -0.3;
            c.vx *= 0.6;
            c.vr *= 0.5;
          }
        }
        for (let i = crumbs.length - 1; i >= 0; i--) if (crumbs[i].rest > 2.5) crumbs.splice(i, 1);
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const b = box();
        g.fillStyle = '#2a1b4f';
        g.fillRect(0, b.floor + 30, s.w, s.h - b.floor - 30);
        if (layers > 0) {
          const d = b.depth;
          g.fillStyle = shade(color, -0.25);
          g.beginPath();
          g.moveTo(b.x + b.w, b.y);
          g.lineTo(b.x + b.w + d, b.y - d * 0.5);
          g.lineTo(b.x + b.w + d, b.floor - d * 0.5);
          g.lineTo(b.x + b.w, b.floor);
          g.fill();
          g.fillStyle = shade(color, 0.3);
          g.beginPath();
          g.moveTo(b.x, b.y);
          g.lineTo(b.x + d, b.y - d * 0.5);
          g.lineTo(b.x + b.w + d, b.y - d * 0.5);
          g.lineTo(b.x + b.w, b.y);
          g.fill();
          g.fillStyle = color;
          g.fillRect(b.x, b.y, b.w, b.h);
          g.strokeStyle = shade(color, -0.12);
          g.lineWidth = 1;
          for (let i = 1; i < layers; i++) {
            const y = b.floor - (b.full / LAYERS) * i;
            g.beginPath();
            g.moveTo(b.x, y);
            g.lineTo(b.x + b.w, y);
            g.stroke();
          }
        }
        for (const c of crumbs) {
          g.save();
          g.translate(c.x, c.y);
          g.rotate(c.rot);
          g.globalAlpha = c.rest > 1.5 ? Math.max(0, 1 - (c.rest - 1.5)) : 1;
          g.fillStyle = c.color;
          g.fillRect(-c.s / 2, -c.s / 2, c.s, c.s);
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.fillRect(-c.s / 2, -c.s / 2, c.s, c.s * 0.25);
          g.restore();
        }
        g.globalAlpha = 1;
        if (trail.length > 1) {
          g.strokeStyle = 'rgba(255,255,255,0.85)';
          g.lineCap = 'round';
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(trail[0].x, trail[0].y);
          for (const p of trail) g.lineTo(p.x, p.y);
          g.stroke();
        }
      },
    };
  });

export default game;
