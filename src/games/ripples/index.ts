import { canvasGame } from '../../core/canvas-game';
import { pick } from '../../core/rand';
import type { GameFactory } from '../../core/types';

const DAMP = 0.985;
const PLINKS = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let gw = 1;
    let gh = 1;
    let cur = new Float32Array(1);
    let prev = new Float32Array(1);
    let img: ImageData;
    let idle = 0;
    let rain = 1;
    let lastPlink = 0;
    const off = document.createElement('canvas');
    const og = off.getContext('2d')!;

    const build = () => {
      gw = Math.min(140, Math.max(60, Math.round(s.w / 4)));
      gh = Math.max(40, Math.round((gw * s.h) / s.w));
      cur = new Float32Array(gw * gh);
      prev = new Float32Array(gw * gh);
      off.width = gw;
      off.height = gh;
      img = og.createImageData(gw, gh);
    };

    const drop = (x: number, y: number, strength: number, r = 2) => {
      const gx = Math.round((x / s.w) * gw);
      const gy = Math.round((y / s.h) * gh);
      for (let yy = gy - r; yy <= gy + r; yy++)
        for (let xx = gx - r; xx <= gx + r; xx++)
          if (xx > 0 && yy > 0 && xx < gw - 1 && yy < gh - 1 && (xx - gx) ** 2 + (yy - gy) ** 2 <= r * r) cur[yy * gw + xx] = -strength;
    };

    const plink = (t: number, vol = 0.18) => {
      if (t - lastPlink < 70) return;
      lastPlink = t;
      ctx.sfx.tone(pick(PLINKS), 0.5, 'sine', vol);
    };

    build();
    ctx.hint('Tap or drag across the water');

    return {
      pointer: {
        down(p) {
          idle = 0;
          drop(p.x, p.y, 150, 3);
          plink(p.t, 0.22);
          ctx.haptics.tap();
        },
        move(p) {
          idle = 0;
          drop(p.x, p.y, 45, 2);
          if (Math.random() < 0.1) plink(p.t, 0.08);
        },
      },
      resize: build,
      update(dt, t) {
        idle += dt;
        rain -= dt;
        if (idle > 2 && rain <= 0) {
          rain = 1.2 + Math.random() * 2.2;
          drop(Math.random() * s.w, Math.random() * s.h, 90, 1);
          plink(t * 1000, 0.06);
        }
        for (let y = 1; y < gh - 1; y++)
          for (let x = 1; x < gw - 1; x++) {
            const i = y * gw + x;
            prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - gw] + cur[i + gw]) / 2 - prev[i]) * DAMP;
          }
        const tmp = cur;
        cur = prev;
        prev = tmp;
      },
      render(g) {
        const d = img.data;
        for (let y = 0; y < gh; y++)
          for (let x = 0; x < gw; x++) {
            const i = y * gw + x;
            const sx = x > 0 && x < gw - 1 ? cur[i - 1] - cur[i + 1] : 0;
            const sy = y > 0 && y < gh - 1 ? cur[i - gw] - cur[i + gw] : 0;
            const light = Math.max(-60, Math.min(60, sx * 0.35 + sy * 0.5));
            const spec = Math.max(0, light - 14) * 3;
            const o = i * 4;
            d[o] = Math.min(255, 24 + light * 1.2 + spec);
            d[o + 1] = Math.min(255, 70 + y * (60 / gh) + light * 1.6 + spec);
            d[o + 2] = Math.min(255, 130 + light * 2 + spec);
            d[o + 3] = 255;
          }
        og.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = true;
        g.drawImage(off, 0, 0, s.w, s.h);
      },
    };
  });

export default game;
