import { canvasGame } from '../../core/canvas-game';
import { PALETTE, shade } from '../../core/color';
import { text } from '../../core/draw';
import { easeOutBack } from '../../core/ease';
import { Particles } from '../../core/fx/particles';
import { clamp, lerp, roundRect, TAU } from '../../core/math';
import { levelRng, mulberry32 } from '../../core/rand';
import type { GameFactory } from '../../core/types';
import { ART, type Art } from './art';
import { bite, fromArt, generate, needed, start, stuck, take, target, won, type Level, type State } from './logic';
import { drawMarker } from './markers';
import { pixelate } from './pixelate';

const MAX_SLOTS = 5;
const COLS = 4;
const ROWS = 4;
const TOP = 92;
const PAD = 14;
const BITE = 0.07;
const WALK = 0.45;
const CHECK = 26;
const MORE_H = 22;
const WON_PAUSE = 1.2;
const LOST_PAUSE = 1.6;
const UPLOAD_SIDE = 28;
const UPLOAD_COLORS = 6;
const BLANKET = '#b8323f';
const GRASS = '#4a9e3f';
const SOIL = '#5b3a24';
const SOIL_DARK = '#3d2617';
const PLATE = '#fbf6ec';
const rand = mulberry32(7);
const PEBBLES = Array.from({ length: 40 }, () => [rand(), rand(), 1 + rand() * 3]);

interface Face {
  /** back-row tile: darker, same hue */
  dim?: boolean;
  /** share of the tile still to eat, shown as a bar */
  fill?: number;
  /** nothing of its color is reachable yet */
  wait?: boolean;
  /** see-through outline of a tile that is not there */
  ghost?: boolean;
}

interface Ant {
  pixel: number;
  color: number;
  t: number;
}

const luma = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
};

/** A top-down ant facing +x: abdomen, thorax, head, six walking legs and antennae; size is the head radius ×2.6. */
function drawAnt(g: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, body: string, phase: number, crumb?: string) {
  const u = size / 2.6;
  const leg = shade(body, -0.55);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.strokeStyle = leg;
  g.lineWidth = Math.max(0.8, u * 0.28);
  g.lineCap = 'round';
  g.beginPath();
  for (let k = -1; k <= 1; k++) {
    const swing = Math.sin(phase + k * 2.1) * u * 0.55;
    for (const side of [-1, 1]) {
      const sw = side * (k % 2 === 0 ? swing : -swing);
      g.moveTo(k * u * 0.45, side * u * 0.3);
      g.lineTo(k * u * 0.7 + sw, side * u * 0.85);
      g.lineTo(k * u * 1.1 + sw, side * u * 1.35);
    }
  }
  g.moveTo(u * 1.25, -u * 0.2);
  g.quadraticCurveTo(u * 1.9, -u * 0.5, u * 2.2, -u * 0.95);
  g.moveTo(u * 1.25, u * 0.2);
  g.quadraticCurveTo(u * 1.9, u * 0.5, u * 2.2, u * 0.95);
  g.stroke();
  g.fillStyle = body;
  for (const [cx, rx, ry] of [[-1.35, 0.95, 0.72], [0, 0.6, 0.4], [1.05, 0.5, 0.5]]) {
    g.beginPath();
    g.ellipse(cx * u, 0, rx * u, ry * u, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(-u * 1.5, -u * 0.25, u * 0.4, u * 0.18, 0, 0, TAU);
  g.fill();
  if (crumb) {
    g.fillStyle = crumb;
    g.fillRect(u * 1.5, -u * 0.6, u * 1.2, u * 1.2);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    g.strokeRect(u * 1.5, -u * 0.6, u * 1.2, u * 1.2);
  }
  g.restore();
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let level = ctx.store.get('level', 1);
    let lv: Level;
    let art: Art;
    let custom: Art | null = null;
    let hues: string[] = [];
    let st: State;
    let held = new Uint8Array(0);
    let ants: Ant[] = [];
    let rows = ROWS;
    let more = false;
    let total = 0;
    let left = 0;
    let pct = -1;
    let need = -1;
    let acc = 0;
    let mode: 'play' | 'won' | 'lost' | 'over' = 'play';
    let endT = 0;
    let shakeT = 0;
    let clock = 0;
    let destroyed = false;
    const popT = new Array<number>(MAX_SLOTS).fill(1);
    const full = new Array<number>(MAX_SLOTS).fill(1);
    const fx = new Particles();
    const btn = document.createElement('button');
    const file = document.createElement('input');

    const params = (n: number, own: Art | null) => {
      const a = own ?? ART[(n - 1) % ART.length];
      const pic = fromArt(a);
      const count = pic.px.reduce((k, v) => (v >= 0 ? k + 1 : k), 0);
      const lo = Math.max(3, Math.round(count / (10 + n / 2)));
      return { art: a, pic, count, opts: { cols: COLS, chunk: [lo, lo * 3] as [number, number], run: Math.min(5, 2 + Math.floor(n / 6)) } };
    };

    const slotsFor = (n: number) => (n < 6 ? MAX_SLOTS : n < 16 ? MAX_SLOTS - 1 : MAX_SLOTS - 2);

    const progress = () => {
      const p = Math.floor(((total - left) * 100) / total);
      if (p === pct) return;
      pct = p;
      ctx.hud.sub(`${art.name} · ${p}%`);
    };

    const restart = () => {
      st = start(lv, slotsFor(level));
      held = new Uint8Array(lv.px.length);
      ants = [];
      acc = 0;
      mode = 'play';
      endT = 0;
      need = -1;
      left = total;
      pct = -1;
      popT.fill(1);
      progress();
    };

    const newLevel = () => {
      const p = params(level, custom);
      lv = generate(p.pic, p.opts, custom ? mulberry32(Date.now()) : levelRng(ctx.store));
      art = p.art;
      hues = Object.values(art.palette);
      total = p.count;
      rows = clamp(Math.max(...lv.cols.map((c) => c.length)), 1, ROWS);
      more = lv.cols.some((c) => c.length > ROWS);
      restart();
      ctx.hud.set(`Level ${level}`);
    };

    /** Bottom-up: colonies, slots, nest, then the picture takes the rest; spare height beyond the picture widens the slot gap. */
    const layout = () => {
      const tile = Math.min(56, (s.w - 40) / (MAX_SLOTS + 0.9), (s.h - TOP) / 11);
      const gap = tile * 0.2;
      const gridY = s.h - s.bottom - 12 - (more ? MORE_H : 0) - tile * 0.08 - rows * (tile + gap) + gap;
      const room = gridY - tile - gap * 2.6 - gap * 2 - tile * 0.92 - TOP - 12 - PAD * 2;
      const cell = Math.max(2, Math.min((s.w - 32 - PAD * 2) / lv.w, room / lv.h));
      const lift = clamp((room - cell * lv.h) / 2, 0, tile);
      const slotY = gridY - tile - gap * 2.6 - lift;
      const soilY = slotY - gap * 2;
      const hole = { x: s.w / 2, y: soilY - tile * 0.42 };
      const grassY = hole.y - tile * 0.5;
      const picH = grassY - TOP - 12 - PAD * 2;
      const pw = cell * lv.w;
      const ph = cell * lv.h;
      const px = (s.w - pw) / 2;
      const py = TOP + PAD + (picH - ph) / 2;
      const n = st.slots.length;
      const slotX = (i: number) => (s.w - n * tile - (n - 1) * gap) / 2 + i * (tile + gap);
      const colGap = gap * 2;
      const colX = (c: number) => (s.w - COLS * tile - (COLS - 1) * colGap) / 2 + c * (tile + colGap);
      return { tile, gap, colGap, gridY, slotY, soilY, grassY, hole, cell, pw, ph, px, py, slotX, colX };
    };
    type Layout = ReturnType<typeof layout>;

    const pixelXY = (L: Layout, i: number) => ({
      x: L.px + ((i % lv.w) + 0.5) * L.cell,
      y: L.py + (Math.floor(i / lv.w) + 0.5) * L.cell,
    });

    const drawTile = (gc: CanvasRenderingContext2D, x: number, y: number, size: number, color: number, label: string | number, f: Face = {}) => {
      const c = f.dim ? shade(hues[color], -0.3) : hues[color];
      const ink = luma(c) > 170 ? '#2a1a10' : '#ffffff';
      if (f.ghost) gc.globalAlpha = 0.6;
      gc.fillStyle = shade(c, -0.4);
      gc.beginPath();
      roundRect(gc, x, y + size * 0.08, size, size, size * 0.24);
      gc.fill();
      gc.fillStyle = c;
      gc.beginPath();
      roundRect(gc, x, y, size, size * 0.94, size * 0.24);
      gc.fill();
      gc.strokeStyle = f.ghost ? '#ffffff' : 'rgba(255,255,255,0.35)';
      gc.lineWidth = f.ghost ? 2 : 1.5;
      if (f.ghost) gc.setLineDash([5, 4]);
      gc.stroke();
      gc.setLineDash([]);
      if (f.fill !== undefined && f.fill < 1) {
        gc.fillStyle = 'rgba(0,0,0,0.25)';
        gc.fillRect(x + size * 0.15, y + size * 0.8, size * 0.7, size * 0.07);
        gc.fillStyle = ink;
        gc.fillRect(x + size * 0.15, y + size * 0.8, size * 0.7 * f.fill, size * 0.07);
      }
      const bx = x + size * 0.22;
      const by = y + size * 0.22;
      const br = size * 0.16;
      gc.fillStyle = luma(c) > 170 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.4)';
      gc.beginPath();
      gc.arc(bx, by, br, 0, TAU);
      gc.fill();
      if (f.wait) {
        const bob = Math.sin(clock * 3) * br * 0.15;
        text(gc, 'z', bx - br * 0.35, by + br * 0.3 + bob, br * 0.9, ink);
        text(gc, 'z', bx + br * 0.35, by - br * 0.2 - bob, br * 1.2, ink);
      } else drawAnt(gc, bx + br * 0.1, by + br * 0.1, -Math.PI / 4, br * 1.25, shade(c, -0.65), 0);
      drawMarker(gc, color, x + size * 0.78, y + size * 0.22, size * 0.12, ink);
      text(gc, String(label), x + size * 0.5 + 1, y + size * 0.56 + 1.5, size * 0.36, 'rgba(0,0,0,0.3)');
      text(gc, String(label), x + size * 0.5, y + size * 0.56, size * 0.36, ink);
      gc.globalAlpha = 1;
    };

    const drawScene = (gc: CanvasRenderingContext2D, L: Layout) => {
      gc.fillStyle = BLANKET;
      gc.fillRect(0, 0, s.w, L.grassY);
      gc.fillStyle = 'rgba(255,255,255,0.16)';
      for (let x = 0; x < s.w; x += CHECK * 2) gc.fillRect(x, 0, CHECK, L.grassY);
      for (let y = 0; y < L.grassY; y += CHECK * 2) gc.fillRect(0, y, s.w, CHECK);
      gc.fillStyle = GRASS;
      gc.fillRect(0, L.grassY, s.w, L.soilY - L.grassY);
      gc.strokeStyle = shade(GRASS, -0.25);
      gc.lineWidth = 2;
      gc.beginPath();
      for (let x = 6; x < s.w; x += 11) {
        const y = L.grassY + 3 + ((x * 7) % 5);
        gc.moveTo(x, y + 6);
        gc.lineTo(x + 2, y);
      }
      gc.stroke();
      gc.fillStyle = SOIL;
      gc.fillRect(0, L.soilY, s.w, s.h - L.soilY);
      gc.fillStyle = SOIL_DARK;
      for (const [x, y, r] of PEBBLES) {
        gc.beginPath();
        gc.arc(x * s.w, L.soilY + y * (s.h - L.soilY), r, 0, TAU);
        gc.fill();
      }
      const mound = L.tile * 0.95;
      gc.fillStyle = '#8a5a34';
      gc.beginPath();
      gc.ellipse(L.hole.x, L.hole.y + mound * 0.12, mound, mound * 0.42, 0, Math.PI, TAU);
      gc.fill();
      gc.fillStyle = '#a06a3e';
      gc.beginPath();
      gc.ellipse(L.hole.x, L.hole.y + mound * 0.12, mound * 0.7, mound * 0.28, 0, Math.PI, TAU);
      gc.fill();
      gc.fillStyle = '#1a0d05';
      gc.beginPath();
      gc.ellipse(L.hole.x, L.hole.y, L.tile * 0.3, L.tile * 0.12, 0, 0, TAU);
      gc.fill();
      gc.fillStyle = 'rgba(0,0,0,0.22)';
      gc.beginPath();
      roundRect(gc, L.px - PAD, L.py - PAD + 5, L.pw + PAD * 2, L.ph + PAD * 2, PAD);
      gc.fill();
      gc.fillStyle = PLATE;
      gc.beginPath();
      roundRect(gc, L.px - PAD, L.py - PAD, L.pw + PAD * 2, L.ph + PAD * 2, PAD);
      gc.fill();
      gc.strokeStyle = '#e6dccb';
      gc.lineWidth = 3;
      gc.beginPath();
      roundRect(gc, L.px - PAD * 0.55, L.py - PAD * 0.55, L.pw + PAD * 1.1, L.ph + PAD * 1.1, PAD * 0.6);
      gc.stroke();
    };

    /** The picture; pixels of colors sitting in a slot carry their marker, and each slot's next pixel pulses in its color. */
    const drawPicture = (gc: CanvasRenderingContext2D, L: Layout) => {
      const bevel = L.cell >= 6 ? Math.max(1, L.cell * 0.14) : 0;
      const active = new Set(st.slots.flatMap((t) => (t ? [t.color] : [])));
      for (let i = 0; i < lv.px.length; i++) {
        if (lv.px[i] < 0) continue;
        const x = L.px + (i % lv.w) * L.cell;
        const y = L.py + Math.floor(i / lv.w) * L.cell;
        const c = hues[lv.px[i]];
        if (st.px[i] < 0 && !held[i]) {
          gc.fillStyle = shade(c, 0.82);
          gc.fillRect(x, y, L.cell, L.cell);
          continue;
        }
        gc.fillStyle = c;
        gc.fillRect(x, y, L.cell, L.cell);
        if (bevel) {
          gc.fillStyle = 'rgba(255,255,255,0.28)';
          gc.fillRect(x, y, L.cell, bevel);
          gc.fillRect(x, y, bevel, L.cell);
          gc.fillStyle = 'rgba(0,0,0,0.18)';
          gc.fillRect(x, y + L.cell - bevel, L.cell, bevel);
          gc.fillRect(x + L.cell - bevel, y, bevel, L.cell);
        }
        if (L.cell >= 7 && st.px[i] >= 0 && active.has(st.px[i])) {
          drawMarker(gc, st.px[i], x + L.cell / 2, y + L.cell / 2, L.cell * 0.28, luma(c) > 170 ? 'rgba(42,26,16,0.6)' : 'rgba(255,255,255,0.75)');
        }
      }
      const pulse = 0.55 + 0.45 * Math.sin(clock * 8);
      const o = Math.max(1.5, L.cell * 0.12);
      for (const t of st.slots) {
        const i = t ? target(st, t.color) : -1;
        if (i < 0) continue;
        const x = L.px + (i % lv.w) * L.cell - o;
        const y = L.py + Math.floor(i / lv.w) * L.cell - o;
        gc.globalAlpha = pulse;
        gc.strokeStyle = 'rgba(0,0,0,0.75)';
        gc.lineWidth = 4;
        gc.strokeRect(x, y, L.cell + o * 2, L.cell + o * 2);
        gc.strokeStyle = shade(hues[t!.color], 0.25);
        gc.lineWidth = 2;
        gc.strokeRect(x, y, L.cell + o * 2, L.cell + o * 2);
        gc.globalAlpha = 1;
      }
    };

    const tap = (x: number, y: number) => {
      if (mode !== 'play') return;
      const L = layout();
      if (y < L.gridY - L.gap) return;
      const col = Array.from({ length: COLS }, (_, c) => c).find((c) => x >= L.colX(c) - L.colGap / 2 && x <= L.colX(c) + L.tile + L.colGap / 2);
      if (col === undefined || !st.cols[col].length) return;
      const n = st.cols[col][0].n;
      const slot = take(st, col);
      if (slot < 0) {
        shakeT = 0.35;
        ctx.sfx.play('click', 0.6);
        ctx.haptics.buzz(30);
        return;
      }
      popT[slot] = 0;
      full[slot] = n;
      ctx.sfx.play('pop', 0.9 + Math.random() * 0.3);
      ctx.haptics.tap();
    };

    const finish = () => {
      if (mode === 'won') {
        newLevel();
        return;
      }
      mode = 'over';
      ctx.gameOver({ score: level - 1, text: 'No room left!', retry: restart });
    };

    /** Shrinks the photo to UPLOAD_SIDE on its long side and plays it once as the next picture. */
    const usePhoto = async (f: File) => {
      try {
        const bmp = await createImageBitmap(f);
        const k = Math.min(1, UPLOAD_SIDE / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * k));
        const h = Math.max(1, Math.round(bmp.height * k));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.imageSmoothingQuality = 'high';
        g.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        const a = pixelate(g.getImageData(0, 0, w, h).data, w, h, UPLOAD_COLORS, 'Your picture');
        if (!a) throw new Error('no opaque pixels');
        if (destroyed) return;
        custom = a;
        newLevel();
      } catch {
        if (!destroyed) ctx.hint("Couldn't read that picture");
      }
    };

    newLevel();
    const L0 = layout();
    ctx.hint('Tap a colony to send its ants after that color', L0.py + L0.ph / 2);
    btn.type = 'button';
    btn.className = 'stage-btn';
    btn.textContent = '📷';
    btn.setAttribute('aria-label', 'Play your own picture');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    btn.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      file.value = '';
      if (f) void usePhoto(f);
    });
    ctx.root.append(btn, file);

    return {
      pointer: { down: (p) => tap(p.x, p.y) },
      update(dt) {
        clock += dt;
        fx.update(dt);
        shakeT = Math.max(0, shakeT - dt);
        for (let i = 0; i < MAX_SLOTS; i++) popT[i] = Math.min(1, popT[i] + dt * 4);
        const L = layout();
        for (let k = ants.length - 1; k >= 0; k--) {
          const a = ants[k];
          const before = a.t;
          a.t += dt;
          if (before < WALK && a.t >= WALK) {
            held[a.pixel] = 0;
            const p = pixelXY(L, a.pixel);
            fx.burst(p.x, p.y, 3, hues[a.color], { speed: 70, size: Math.max(2, L.cell * 0.4), life: 0.35, square: true });
          }
          if (a.t >= WALK * 2) ants.splice(k, 1);
        }
        if (mode === 'play') {
          acc += dt;
          while (acc >= BITE) {
            acc -= BITE;
            for (const b of bite(st)) {
              held[b.pixel] = 1;
              left--;
              ants.push({ pixel: b.pixel, color: b.color, t: 0 });
              if (b.done) {
                ctx.sfx.play('score', 1.2, 0.4);
                ctx.haptics.tap();
              }
            }
            progress();
            if (won(st)) {
              mode = 'won';
              if (custom) custom = null;
              else {
                level++;
                ctx.store.set('level', level);
                ctx.store.set('seed', 0);
                ctx.submitScore(level - 1);
              }
              ctx.sfx.play('win');
              ctx.haptics.bump();
              fx.burst(s.w / 2, L.py + L.ph / 2, 70, PALETTE, { speed: 450, life: 1.1 });
              break;
            }
            if (stuck(st)) {
              mode = 'lost';
              need = needed(st);
              ctx.sfx.play('fail');
              ctx.haptics.buzz(120);
              break;
            }
          }
        } else if (mode !== 'over' && !ants.length) {
          endT += dt;
          if (endT > (mode === 'won' ? WON_PAUSE : LOST_PAUSE)) finish();
        }
      },
      render(gc) {
        const L = layout();
        drawScene(gc, L);
        drawPicture(gc, L);
        const size = clamp(L.cell * 0.9, 9, 15);
        for (const a of ants) {
          const p = pixelXY(L, a.pixel);
          const k = a.t < WALK ? a.t / WALK : 2 - a.t / WALK;
          const ang = Math.atan2(p.y - L.hole.y, p.x - L.hole.x);
          const wob = Math.sin(a.t * 18 + a.pixel) * size * 0.15;
          const x = lerp(L.hole.x, p.x, k) - Math.sin(ang) * wob;
          const y = lerp(L.hole.y, p.y, k) + Math.cos(ang) * wob;
          const c = hues[a.color];
          drawAnt(gc, x, y, ang + (a.t < WALK ? 0 : Math.PI), size, luma(c) > 170 ? shade(c, -0.55) : shade(c, -0.3), a.t * 40, a.t >= WALK ? c : undefined);
        }
        const dx = shakeT > 0 ? Math.sin(shakeT * 70) * 6 : 0;
        const alarm = mode === 'lost' ? 0.5 + 0.5 * Math.sin(clock * 14) : 0;
        for (let i = 0; i < st.slots.length; i++) {
          const x = L.slotX(i) + dx;
          gc.fillStyle = SOIL_DARK;
          gc.beginPath();
          roundRect(gc, x - 3, L.slotY - 3, L.tile + 6, L.tile + 8, L.tile * 0.3);
          gc.fill();
          const t = st.slots[i];
          if (t) {
            const k = easeOutBack(popT[i]);
            const sz = L.tile * (0.6 + 0.4 * k);
            drawTile(gc, x + (L.tile - sz) / 2, L.slotY + (L.tile - sz) / 2, sz, t.color, t.n, { fill: t.n / full[i], wait: target(st, t.color) < 0 });
          }
          if (!alarm) continue;
          gc.strokeStyle = `rgba(255,59,79,${alarm})`;
          gc.lineWidth = 4;
          gc.beginPath();
          roundRect(gc, x - 4, L.slotY - 4, L.tile + 8, L.tile + 10, L.tile * 0.3);
          gc.stroke();
        }
        if (mode === 'lost' && need >= 0) {
          const g = L.tile * 0.8;
          const gx = L.hole.x + L.tile * 1.3;
          const gy = L.soilY - g - L.gap;
          text(gc, 'Needed', gx + g / 2 + 1, gy - 8, 12, 'rgba(0,0,0,0.5)');
          text(gc, 'Needed', gx + g / 2, gy - 9, 12, '#ffffff');
          drawTile(gc, gx, gy, g, need, '?', { ghost: true });
        }
        for (let c = 0; c < COLS; c++) {
          const col = st.cols[c] ?? [];
          if (!col.length) {
            gc.strokeStyle = 'rgba(255,255,255,0.22)';
            gc.lineWidth = 2;
            gc.setLineDash([6, 5]);
            gc.beginPath();
            roundRect(gc, L.colX(c) + 1, L.gridY + 1, L.tile - 2, L.tile - 2, L.tile * 0.24);
            gc.stroke();
            gc.setLineDash([]);
          }
          col.slice(0, rows).forEach((t, r) => drawTile(gc, L.colX(c), L.gridY + r * (L.tile + L.gap), L.tile, t.color, t.n, { dim: r > 0 }));
          if (col.length > rows) text(gc, `+${col.length - rows} more`, L.colX(c) + L.tile / 2, L.gridY + rows * (L.tile + L.gap) - L.gap + L.tile * 0.08 + MORE_H / 2, 13, 'rgba(255,255,255,0.85)');
        }
        if (mode === 'won' && !ants.length) {
          const bob = Math.sin(clock * 6) * 3;
          text(gc, 'Delicious!', s.w / 2 + 2, L.py + L.ph / 2 + bob + 3, 36, 'rgba(0,0,0,0.35)');
          text(gc, 'Delicious!', s.w / 2, L.py + L.ph / 2 + bob, 36, '#ffd23f');
        }
        fx.draw(gc);
      },
      destroy() {
        destroyed = true;
        btn.remove();
        file.remove();
      },
    };
  });

export default game;
