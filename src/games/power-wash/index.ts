import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE, shade } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const GRID = 32;
const DONE = 0.97;
const TOP = 80;

type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

const SURFACES: Painter[] = [
  // bathroom tiles
  (g, w, h) => {
    g.fillStyle = '#e8e0ff';
    g.fillRect(0, 0, w, h);
    const t = Math.max(36, w / 8);
    const tones = ['#7dd3fc', '#a5f3fc', '#f9a8d4', '#fde68a'];
    for (let y = 0; y < h; y += t)
      for (let x = 0; x < w; x += t) {
        g.fillStyle = tones[((x / t + y / t) | 0) % tones.length];
        g.fillRect(x + 2, y + 2, t - 4, t - 4);
      }
  },
  // wooden deck
  (g, w, h) => {
    const p = Math.max(30, h / 14);
    for (let y = 0, i = 0; y < h; y += p, i++) {
      g.fillStyle = ['#c08552', '#b0763f', '#cf9560'][i % 3];
      g.fillRect(0, y, w, p - 3);
      g.strokeStyle = 'rgba(90,50,20,0.25)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        const yy = y + 6 + k * ((p - 12) / 2);
        g.moveTo(0, yy);
        for (let x = 0; x <= w; x += 30) g.lineTo(x, yy + Math.sin((x + i * 50) / 40) * 2);
        g.stroke();
      }
      g.fillStyle = '#5b3a1c';
      g.fillRect(0, y + p - 3, w, 3);
    }
  },
  // graffiti wall
  (g, w, h) => {
    g.fillStyle = '#fff6e9';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = PALETTE[i % PALETTE.length];
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * Math.min(w, h) * 0.14, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#241544';
    g.font = `900 ${Math.round(w / 5)}px ui-rounded, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CLEAN', w / 2, h / 2);
  },
  // car door
  (g, w, h) => {
    const c = PALETTE[(Math.random() * PALETTE.length) | 0];
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, shade(c, 0.35));
    grad.addColorStop(0.5, c);
    grad.addColorStop(1, shade(c, -0.35));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 3;
    g.strokeRect(w * 0.1, h * 0.12, w * 0.8, h * 0.76);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, h * 0.3, w, 10);
    g.fillStyle = '#d4d4d8';
    g.fillRect(w * 0.62, h * 0.45, w * 0.2, 14);
  },
];

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    const base = document.createElement('canvas');
    const grime = document.createElement('canvas');
    const bg = base.getContext('2d')!;
    const gg = grime.getContext('2d')!;
    let clean = new Uint8Array(GRID * GRID);
    let cleaned = 0;
    let surface = (Math.random() * SURFACES.length) | 0;
    let doneT = -1;
    let lastFx = 0;
    const fx = new Particles();
    fx.gravity = 500;

    const area = () => ({ x: 10, y: TOP, w: s.w - 20, h: s.h - TOP - 14 });

    const build = () => {
      const a = area();
      for (const c of [base, grime]) {
        c.width = Math.max(1, Math.round(a.w * s.dpr));
        c.height = Math.max(1, Math.round(a.h * s.dpr));
      }
      bg.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      gg.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      SURFACES[surface](bg, a.w, a.h);
      gg.globalCompositeOperation = 'source-over';
      gg.fillStyle = '#4a3b22';
      gg.fillRect(0, 0, a.w, a.h);
      for (let i = 0; i < 260; i++) {
        gg.fillStyle = ['rgba(40,30,15,0.5)', 'rgba(70,80,30,0.45)', 'rgba(110,90,50,0.4)', 'rgba(25,20,10,0.55)'][i % 4];
        gg.beginPath();
        gg.ellipse(Math.random() * a.w, Math.random() * a.h, 8 + Math.random() * 40, 6 + Math.random() * 26, Math.random() * TAU, 0, TAU);
        gg.fill();
      }
      clean = new Uint8Array(GRID * GRID);
      cleaned = 0;
      doneT = -1;
      ctx.hud.set('0%');
    };

    const scrub = (x0: number, y0: number, x1: number, y1: number, t: number) => {
      if (doneT >= 0) return;
      const a = area();
      const R = Math.max(22, Math.min(a.w, a.h) * 0.07);
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (R * 0.4)));
      gg.globalCompositeOperation = 'destination-out';
      for (let i = 0; i <= steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps - a.x;
        const y = y0 + ((y1 - y0) * i) / steps - a.y;
        const grad = gg.createRadialGradient(x, y, R * 0.3, x, y, R);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        gg.fillStyle = grad;
        gg.beginPath();
        gg.arc(x, y, R, 0, TAU);
        gg.fill();
        const cw = a.w / GRID;
        const ch = a.h / GRID;
        for (let gy = Math.max(0, Math.floor((y - R) / ch)); gy <= Math.min(GRID - 1, Math.floor((y + R) / ch)); gy++)
          for (let gx = Math.max(0, Math.floor((x - R) / cw)); gx <= Math.min(GRID - 1, Math.floor((x + R) / cw)); gx++) {
            const k = gy * GRID + gx;
            if (clean[k]) continue;
            if (Math.hypot((gx + 0.5) * cw - x, (gy + 0.5) * ch - y) < R * 0.75) {
              clean[k] = 1;
              cleaned++;
            }
          }
      }
      fx.burst(x1, y1, 3, ['#bae6fd', '#ffffff', '#7dd3fc'], { speed: 260, size: 3, life: 0.35 });
      if (t - lastFx > 140) {
        lastFx = t;
        ctx.sfx.play('whoosh', 2.2 + Math.random() * 0.4, 0.25);
        ctx.haptics.tap();
      }
      const pct = cleaned / clean.length;
      ctx.hud.set(`${Math.floor(pct * 100)}%`);
      if (pct >= DONE) {
        doneT = 0;
        ctx.hud.set('100%');
        ctx.sfx.play('win');
        ctx.haptics.bump();
        const a2 = area();
        fx.burst(a2.x + a2.w / 2, a2.y + a2.h / 2, 60, PALETTE, { speed: 420, life: 1 });
      }
    };

    build();
    ctx.hud.sub('clean');
    ctx.hint('Drag to blast the dirt off');

    return {
      pointer: {
        down: (p) => scrub(p.x, p.y, p.x, p.y, p.t),
        move: (p) => scrub(p.px, p.py, p.x, p.y, p.t),
      },
      resize: build,
      update(dt) {
        fx.update(dt);
        if (doneT >= 0) {
          doneT += dt;
          if (doneT > 1.6) {
            surface = (surface + 1) % SURFACES.length;
            build();
          }
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const a = area();
        g.drawImage(base, a.x, a.y, a.w, a.h);
        if (doneT < 0) g.drawImage(grime, a.x, a.y, a.w, a.h);
        else if (doneT < 0.4) {
          g.globalAlpha = 1 - doneT / 0.4;
          g.drawImage(grime, a.x, a.y, a.w, a.h);
          g.globalAlpha = 1;
        }
        fx.draw(g);
      },
    };
  });

export default game;
