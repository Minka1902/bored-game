import { canvasGame } from '../../core/canvas-game';
import { BG } from '../../core/color';
import { text } from '../../core/draw';
import { roundRect } from '../../core/math';
import type { GameFactory } from '../../core/types';

const EMPTY = 0;
const SAND = 1;
const WATER = 2;
const STONE = 3;
type Tool = typeof SAND | typeof WATER | typeof STONE | typeof EMPTY;

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: SAND, label: 'Sand' },
  { tool: WATER, label: 'Water' },
  { tool: STONE, label: 'Stone' },
  { tool: EMPTY, label: 'Erase' },
];
const BAR = 64;
const TOP = 70;

const hueRgb = (h: number): [number, number, number] => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (0.62 - 0.38 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
};

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let cell = 4;
    let gw = 1;
    let gh = 1;
    let kind = new Uint8Array(1);
    let hue = new Uint8Array(1);
    let stamp = new Uint8Array(1);
    let frame = 0;
    let tool: Tool = SAND;
    let pourHue = Math.random() * 255;
    let img: ImageData;
    const off = document.createElement('canvas');
    const og = off.getContext('2d')!;
    const brushes = new Map<number, { x: number; y: number }>();
    let lastSound = 0;

    const build = () => {
      cell = Math.max(3, Math.floor(s.w / 120));
      gw = Math.floor(s.w / cell);
      gh = Math.floor((s.h - TOP - BAR) / cell);
      kind = new Uint8Array(gw * gh);
      hue = new Uint8Array(gw * gh);
      stamp = new Uint8Array(gw * gh);
      off.width = gw;
      off.height = gh;
      img = og.createImageData(gw, gh);
    };

    const swap = (a: number, b: number) => {
      const k = kind[a];
      kind[a] = kind[b];
      kind[b] = k;
      const h = hue[a];
      hue[a] = hue[b];
      hue[b] = h;
      stamp[b] = frame;
      stamp[a] = frame;
    };

    const paint = (cx: number, cy: number) => {
      const gx = Math.floor(cx / cell);
      const gy = Math.floor((cy - TOP) / cell);
      const r = tool === EMPTY ? 5 : 3;
      for (let y = gy - r; y <= gy + r; y++)
        for (let x = gx - r; x <= gx + r; x++) {
          if (x < 0 || y < 0 || x >= gw || y >= gh || (x - gx) ** 2 + (y - gy) ** 2 > r * r) continue;
          const i = y * gw + x;
          if (tool === EMPTY) kind[i] = EMPTY;
          else if (kind[i] === EMPTY && (tool === STONE || Math.random() < 0.45)) {
            kind[i] = tool;
            hue[i] = (pourHue + Math.random() * 8) & 255;
          }
        }
    };

    const sim = () => {
      frame = (frame + 1) & 255 || 1;
      const ltr = frame % 2 === 0;
      for (let y = gh - 2; y >= 0; y--) {
        for (let k = 0; k < gw; k++) {
          const x = ltr ? k : gw - 1 - k;
          const i = y * gw + x;
          const m = kind[i];
          if (m === EMPTY || m === STONE || stamp[i] === frame) continue;
          const below = i + gw;
          const sinks = (t: number) => t === EMPTY || (m === SAND && t === WATER);
          if (sinks(kind[below])) {
            swap(i, below);
            continue;
          }
          const dir = Math.random() < 0.5 ? -1 : 1;
          let moved = false;
          for (const d of [dir, -dir]) {
            const nx = x + d;
            if (nx < 0 || nx >= gw) continue;
            if (sinks(kind[below + d])) {
              swap(i, below + d);
              moved = true;
              break;
            }
          }
          if (moved || m !== WATER) continue;
          for (const d of [dir, -dir]) {
            const nx = x + d;
            if (nx >= 0 && nx < gw && kind[i + d] === EMPTY) {
              swap(i, i + d);
              break;
            }
          }
        }
      }
    };

    const toolAt = (x: number, y: number) => {
      if (y < s.h - BAR) return -1;
      const w = s.w / (TOOLS.length + 1);
      return Math.floor(x / w);
    };

    build();
    ctx.hint('Drag to pour · pick a material below');

    return {
      pointer: {
        down(p) {
          const t = toolAt(p.x, p.y);
          if (t >= 0) {
            if (t < TOOLS.length) tool = TOOLS[t].tool;
            else kind.fill(EMPTY);
            ctx.sfx.play('click');
            ctx.haptics.tap();
            return;
          }
          brushes.set(p.id, { x: p.x, y: p.y });
        },
        move(p) {
          const b = brushes.get(p.id);
          if (b) {
            b.x = p.x;
            b.y = p.y;
          }
        },
        up(p) {
          brushes.delete(p.id);
        },
      },
      resize: build,
      update(dt, t) {
        pourHue = (pourHue + dt * 20) % 255;
        for (const b of brushes.values()) paint(b.x, b.y);
        if (brushes.size && t * 1000 - lastSound > 90) {
          lastSound = t * 1000;
          if (tool === SAND) ctx.sfx.play('hat', 0.5 + Math.random() * 0.3, 0.35);
          else if (tool === WATER) ctx.sfx.play('whoosh', 1.6, 0.15);
        }
        sim();
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const d = img.data;
        for (let i = 0; i < kind.length; i++) {
          const o = i * 4;
          const m = kind[i];
          if (m === EMPTY) {
            d[o + 3] = 0;
            continue;
          }
          if (m === SAND) {
            const [r, gg, b] = hueRgb((hue[i] / 255) * 360);
            d[o] = r;
            d[o + 1] = gg;
            d[o + 2] = b;
          } else if (m === WATER) {
            d[o] = 56;
            d[o + 1] = 140 + (hue[i] & 31);
            d[o + 2] = 245;
          } else {
            const v = 110 + (hue[i] & 31);
            d[o] = v;
            d[o + 1] = v - 6;
            d[o + 2] = v + 14;
          }
          d[o + 3] = 255;
        }
        og.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = false;
        g.drawImage(off, 0, TOP, gw * cell, gh * cell);
        const w = s.w / (TOOLS.length + 1);
        [...TOOLS.map((t) => t.label), 'Clear'].forEach((label, i) => {
          const active = i < TOOLS.length && TOOLS[i].tool === tool;
          g.fillStyle = active ? '#ffd23f' : '#2a1b4f';
          g.beginPath();
          roundRect(g, i * w + 4, s.h - BAR + 10, w - 8, BAR - 20, 12);
          g.fill();
          text(g, label, i * w + w / 2, s.h - BAR / 2, Math.min(15, w * 0.22), active ? '#241544' : '#fff6e9');
        });
      },
    };
  });

export default game;
