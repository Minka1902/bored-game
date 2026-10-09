import { canvasGame } from '../../core/canvas-game';
import { hsl } from '../../core/color';
import { text } from '../../core/draw';
import { roundRect } from '../../core/math';
import type { GameFactory } from '../../core/types';

const SEGMENTS = [6, 8, 12];
const FADE = 'rgba(18,10,36,0.025)';

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let segIx = ctx.store.get('seg', 1) % SEGMENTS.length;
    let hue = Math.random() * 360;
    let clear = true;
    let idle = 0;
    let auto: { x: number; y: number } | null = null;
    let lastTick = 0;
    const strokes: [number, number, number, number][] = [];

    const chip = () => ({ x: s.w - 84, y: s.h - 56, w: 72, h: 40 });
    const inChip = (x: number, y: number) => {
      const c = chip();
      return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;
    };

    const mirror = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
      const n = SEGMENTS[segIx];
      const cx = s.w / 2;
      const cy = s.h / 2;
      g.save();
      g.translate(cx, cy);
      for (let i = 0; i < n; i++) {
        g.rotate((Math.PI * 2) / n);
        for (const flip of [1, -1]) {
          g.beginPath();
          g.moveTo(x0 - cx, (y0 - cy) * flip);
          g.lineTo(x1 - cx, (y1 - cy) * flip);
          g.stroke();
        }
      }
      g.restore();
    };

    ctx.hint('Draw anything');

    return {
      pointer: {
        down(p) {
          idle = 0;
          auto = null;
          if (inChip(p.x, p.y)) {
            segIx = (segIx + 1) % SEGMENTS.length;
            ctx.store.set('seg', segIx);
            ctx.sfx.play('click');
            ctx.haptics.tap();
            return;
          }
          strokes.push([p.x, p.y, p.x + 0.1, p.y + 0.1]);
        },
        move(p) {
          idle = 0;
          if (inChip(p.sx, p.sy)) return;
          strokes.push([p.px, p.py, p.x, p.y]);
          if (p.t - lastTick > 90) {
            lastTick = p.t;
            ctx.sfx.tone(300 + ((hue % 360) / 360) * 500, 0.12, 'sine', 0.06);
          }
        },
      },
      resize() {
        clear = true;
      },
      update(dt, t) {
        hue = (hue + dt * 40) % 360;
        idle += dt;
        if (idle > 3) {
          // screensaver: an invisible pen traces a slow Lissajous curve
          const r = Math.min(s.w, s.h) * 0.36;
          const nx = s.w / 2 + Math.sin(t * 0.9) * r * Math.cos(t * 0.23);
          const ny = s.h / 2 + Math.sin(t * 1.3) * r * 0.8;
          if (auto) strokes.push([auto.x, auto.y, nx, ny]);
          auto = { x: nx, y: ny };
        }
      },
      render(g) {
        g.fillStyle = clear ? '#120a24' : FADE;
        clear = false;
        g.fillRect(0, 0, s.w, s.h);
        g.lineCap = 'round';
        g.globalCompositeOperation = 'lighter';
        for (const [x0, y0, x1, y1] of strokes) {
          g.strokeStyle = hsl(hue, 95, 55, 0.35);
          g.lineWidth = 9;
          mirror(g, x0, y0, x1, y1);
          g.strokeStyle = hsl(hue, 100, 75);
          g.lineWidth = 2.5;
          mirror(g, x0, y0, x1, y1);
        }
        g.globalCompositeOperation = 'source-over';
        strokes.length = 0;
        const c = chip();
        // opaque: the canvas only fades slowly, so a translucent chip would pile up to white
        g.fillStyle = '#2a1b4f';
        g.beginPath();
        roundRect(g, c.x, c.y, c.w, c.h, 14);
        g.fill();
        text(g, `✱ ${SEGMENTS[segIx]}`, c.x + c.w / 2, c.y + c.h / 2 + 1, 17, '#fff6e9');
      },
    };
  });

export default game;
