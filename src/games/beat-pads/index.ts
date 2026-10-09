import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE, shade } from '../../core/color';
import { text } from '../../core/draw';
import { roundRect } from '../../core/math';
import type { GameFactory, SfxName } from '../../core/types';

// C major pentatonic over two octaves: nothing you tap can clash.
const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
const DRUMS: SfxName[] = ['kick', 'snare', 'hat', 'clap'];
const KEYS = '1234qwerasdfzxcv';
const LABELS = ['C', 'D', 'E', 'G', 'A', 'C', 'D', 'E', 'G', 'A', 'C', 'D', 'kick', 'snare', 'hat', 'clap'];

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    const glow = new Float32Array(16);
    const owner = new Map<number, number>();

    const layout = () => {
      const size = Math.min(s.w - 24, s.h - 110, 520);
      const gap = size * 0.035;
      const cell = (size - gap * 3) / 4;
      return { x: (s.w - size) / 2, y: 70 + (s.h - 70 - size) / 2, cell, gap };
    };

    const padAt = (x: number, y: number) => {
      const L = layout();
      const c = Math.floor((x - L.x) / (L.cell + L.gap));
      const r = Math.floor((y - L.y) / (L.cell + L.gap));
      if (c < 0 || r < 0 || c > 3 || r > 3) return -1;
      return r * 4 + c;
    };

    const hit = (i: number) => {
      glow[i] = 1;
      if (i < 12) {
        ctx.sfx.tone(NOTES[i], 0.55, 'triangle', 0.32);
        ctx.sfx.tone(NOTES[i] / 2, 0.35, 'sine', 0.12);
      } else ctx.sfx.play(DRUMS[i - 12]);
      ctx.haptics.tap();
    };

    ctx.hint('Tap the pads · it always sounds good');

    return {
      pointer: {
        down(p) {
          const i = padAt(p.x, p.y);
          owner.set(p.id, i);
          if (i >= 0) hit(i);
        },
        move(p) {
          const i = padAt(p.x, p.y);
          if (i !== owner.get(p.id)) {
            owner.set(p.id, i);
            if (i >= 0) hit(i);
          }
        },
        up(p) {
          owner.delete(p.id);
        },
      },
      key(e) {
        const i = KEYS.indexOf(e.key.toLowerCase());
        if (i >= 0) hit(i);
      },
      update(dt) {
        for (let i = 0; i < 16; i++) glow[i] = Math.max(0, glow[i] - dt * 3.5);
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const L = layout();
        for (let i = 0; i < 16; i++) {
          const r = Math.floor(i / 4);
          const c = i % 4;
          const color = i < 12 ? PALETTE[(i * 5) % PALETTE.length] : '#e8e0ff';
          const x = L.x + c * (L.cell + L.gap);
          const y = L.y + r * (L.cell + L.gap);
          const k = glow[i];
          const press = k * 4;
          g.fillStyle = shade(color, -0.5);
          g.beginPath();
          roundRect(g, x, y + 5, L.cell, L.cell, L.cell * 0.18);
          g.fill();
          g.fillStyle = k > 0 ? shade(color, 0.6 * k) : shade(color, -0.12);
          g.beginPath();
          roundRect(g, x, y + press, L.cell, L.cell, L.cell * 0.18);
          g.fill();
          if (k > 0) {
            g.strokeStyle = `rgba(255,255,255,${k * 0.7})`;
            g.lineWidth = 3;
            const e = (1 - k) * 14;
            g.beginPath();
            roundRect(g, x - e, y - e + press, L.cell + e * 2, L.cell + e * 2, L.cell * 0.22);
            g.stroke();
          }
          text(g, LABELS[i], x + L.cell / 2, y + L.cell / 2 + press, L.cell * (i < 12 ? 0.22 : 0.16), 'rgba(36,21,68,0.55)');
        }
      },
    };
  });

export default game;
