import { canvasGame } from '../../core/canvas-game';
import { BG } from '../../core/color';
import { sprite } from '../../core/draw';
import { easeInOutSine } from '../../core/ease';
import { clamp, roundRect, TAU } from '../../core/math';
import type { Ptr } from '../../core/input';
import type { GameFactory } from '../../core/types';

interface Bubble {
  x: number;
  y: number;
  popped: boolean;
  /** seconds since popped, for the squash animation */
  t: number;
  /** which deflated sprite to use */
  v: number;
}

const TOP = 86;
const SLIDE_S = 0.45;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let R = 28;
    let bubbles: Bubble[] = [];
    let old: Bubble[] | null = null;
    let slide = 1;
    let wait = -1;
    let pops = ctx.store.get('pops', 0);
    let unsaved = 0;
    let full: HTMLCanvasElement;
    let flats: HTMLCanvasElement[] = [];

    const sprites = () => {
      const size = R * 2 + 6;
      full = sprite(size, s.dpr, (g) => {
        g.translate(size / 2, size / 2);
        const grad = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.35, 'rgba(214,236,255,0.55)');
        grad.addColorStop(0.85, 'rgba(140,190,245,0.55)');
        grad.addColorStop(1, 'rgba(90,140,220,0.75)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(0, 0, R, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 1.5;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath();
        g.ellipse(-R * 0.38, -R * 0.42, R * 0.22, R * 0.12, -0.7, 0, TAU);
        g.fill();
      });
      // a few variants of a deflated bubble: an irregular, wrinkled rim with a soft dent
      flats = Array.from({ length: 4 }, () =>
        sprite(size, s.dpr, (g) => {
          g.translate(size / 2, size / 2);
          g.beginPath();
          const n = 14;
          for (let i = 0; i <= n; i++) {
            const a = (i / n) * TAU;
            const rr = R * (0.8 + Math.random() * 0.14);
            if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
            else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          g.closePath();
          g.fillStyle = 'rgba(200,225,255,0.14)';
          g.fill();
          g.strokeStyle = 'rgba(230,242,255,0.32)';
          g.lineWidth = 1.3;
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.1)';
          g.beginPath();
          g.ellipse(R * 0.1, R * 0.15, R * 0.45, R * 0.3, Math.random() * TAU, 0, TAU);
          g.fill();
        }),
      );
    };

    const build = (): Bubble[] => {
      R = clamp(s.w / 9.5, 20, 36);
      const dx = R * 2.18;
      const dy = R * 1.92;
      const cols = Math.max(1, Math.floor((s.w - dx / 2 - 12) / dx));
      const rows = Math.max(1, Math.floor((s.h - TOP - 24) / dy));
      const ox = (s.w - (cols - 1) * dx - dx / 2) / 2;
      const oy = TOP + (s.h - TOP - (rows - 1) * dy) / 2;
      const out: Bubble[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          out.push({ x: ox + c * dx + (r % 2 ? dx / 2 : 0), y: oy + r * dy, popped: false, t: 0, v: (Math.random() * 4) | 0 });
      sprites();
      return out;
    };

    const save = () => {
      ctx.store.set('pops', pops);
      unsaved = 0;
    };

    const popAt = (p: Ptr) => {
      if (slide < 1) return;
      for (const b of bubbles) {
        if (b.popped || Math.hypot(p.x - b.x, p.y - b.y) > R) continue;
        b.popped = true;
        b.t = 0;
        pops++;
        if (++unsaved >= 10) save();
        ctx.hud.set(pops.toLocaleString('en-US'));
        ctx.sfx.play('pop', 0.8 + Math.random() * 0.5);
        ctx.haptics.tap();
        if (bubbles.every((x) => x.popped)) wait = 0.4;
        return;
      }
    };

    const drawSheet = (list: Bubble[], ox: number, g: CanvasRenderingContext2D) => {
      if (!list.length) return;
      const size = R * 2 + 6;
      g.save();
      g.translate(ox, 0);
      g.fillStyle = 'rgba(200,230,255,0.07)';
      g.beginPath();
      roundRect(g, 6, TOP - R * 0.4 - 6, s.w - 12, s.h - TOP + R * 0.4 - 6, 18);
      g.fill();
      for (const b of list) {
        if (!b.popped) g.drawImage(full, b.x - size / 2, b.y - size / 2, size, size);
        else {
          const k = Math.min(1, b.t / 0.09);
          g.drawImage(flats[b.v], b.x - size / 2, b.y - size / 2, size, size);
          if (k < 1) {
            const sc = 1 + 0.12 * k;
            g.globalAlpha = 1 - k;
            g.drawImage(full, b.x - (size / 2) * sc, b.y - (size / 2) * sc, size * sc, size * sc);
            g.globalAlpha = 1;
          }
        }
      }
      g.restore();
    };

    bubbles = build();
    ctx.hud.set(pops.toLocaleString('en-US'));
    ctx.hud.sub('pops');
    ctx.hint('Tap or drag to pop');

    return {
      pointer: { down: popAt, move: popAt },
      resize() {
        bubbles = build();
        old = null;
        slide = 1;
      },
      update(dt) {
        for (const b of bubbles) if (b.popped) b.t += dt;
        if (wait >= 0) {
          wait -= dt;
          if (wait < 0) {
            old = bubbles;
            bubbles = build();
            slide = 0;
            ctx.sfx.play('whoosh', 0.8);
          }
        }
        if (slide < 1) {
          slide = Math.min(1, slide + dt / SLIDE_S);
          if (slide >= 1) old = null;
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const e = easeInOutSine(slide);
        if (old) drawSheet(old, -e * s.w, g);
        drawSheet(bubbles, (1 - e) * s.w, g);
      },
      destroy: save,
    };
  });

export default game;
