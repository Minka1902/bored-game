import { canvasGame } from '../../core/canvas-game';
import { BG, BG2, PALETTE, shade } from '../../core/color';
import { sprite, text } from '../../core/draw';
import { Particles } from '../../core/fx/particles';
import { lerp, roundRect, TAU } from '../../core/math';
import { pick } from '../../core/rand';
import type { GameFactory } from '../../core/types';
import { free, generate, pull, start, stuck, take, target, won, type Level, type Spool, type State } from './logic';

/** Ordered top of the picture to the bottom; a level with fewer colors takes them evenly spaced. */
const THEMES = [
  ['#4f46e5', '#c026d3', '#f472b6', '#fdba74', '#ffe14d', '#a3e635', '#16a34a', '#78350f'],
  ['#7dd3fc', '#f8fafc', '#2563eb', '#ef4444', '#ffb020', '#fde68a', '#84cc16', '#15803d'],
  ['#a855f7', '#fb7185', '#22d3ee', '#f97316', '#fde047', '#dc2626', '#65a30d', '#92400e'],
];
const GW = 7;
const TOP = 84;
const PULL = 0.04;
const YARN = 0.2;
const MAX_CELL = 54;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let level = ctx.store.get('level', 1);
    let lv: Level;
    let hues: string[] = [];
    let st: State;
    let drop = new Float32Array(0);
    let stitches: HTMLCanvasElement[] = [];
    let stitchKey = '';
    let acc = 0;
    let mode: 'play' | 'won' | 'lost' | 'over' = 'play';
    let endT = 0;
    let trayShake = 0;
    const pos = new Map<Spool, { x: number; y: number }>();
    const yarn = new Map<Spool, { x: number; t: number }>();
    const cellShake = new Map<number, number>();
    const fx = new Particles();

    const params = (n: number) => {
      const size = Math.min(30, 16 + 2 * n);
      const px = size * size;
      return {
        w: size,
        h: size,
        colors: Math.min(8, 4 + Math.floor((n - 1) / 2)),
        gw: GW,
        chunk: [Math.round(px / 50), Math.round(px / 16)] as [number, number],
        slots: n < 4 ? 7 : n < 8 ? 6 : 5,
        dig: Math.min(0.7, 0.2 + n * 0.04),
      };
    };

    const layout = () => {
      const avail = s.h - TOP - 12;
      const slotW = Math.min(50, (s.w - 44) / lv.slots - 6);
      const trayH = slotW * 1.3;
      const pc = Math.max(2, Math.min(s.w - 32, avail * 0.4) / lv.w);
      const pw = pc * lv.w;
      const ph = pc * lv.h;
      const px = (s.w - pw) / 2;
      const py = TOP;
      const trayW = lv.slots * (slotW + 6) + 18;
      const trayX = (s.w - trayW) / 2;
      const trayY = py + ph + 30;
      const slotX = (i: number) => trayX + 12 + i * (slotW + 6) + slotW / 2;
      const gridY = trayY + trayH + 40;
      const cell = Math.max(8, Math.min(MAX_CELL, (s.w - 24) / lv.gw, (s.h - 12 - gridY) / lv.gh));
      const gx = (s.w - cell * lv.gw) / 2;
      return { slotW, trayH, pc, pw, ph, px, py, trayW, trayX, trayY, slotX, gridY, cell, gx };
    };

    const cellXY = (L: ReturnType<typeof layout>, i: number) => ({
      x: L.gx + ((i % lv.gw) + 0.5) * L.cell,
      y: L.gridY + (Math.floor(i / lv.gw) + 0.5) * L.cell,
    });

    const slotXY = (L: ReturnType<typeof layout>, j: number) => ({ x: L.slotX(j), y: L.trayY + L.trayH / 2 });

    const buildStitches = (size: number) => {
      const key = `${size}|${hues.join()}`;
      if (key === stitchKey) return;
      stitchKey = key;
      stitches = hues.map((c) =>
        sprite(size, s.dpr, (g) => {
          g.fillStyle = shade(c, -0.3);
          g.fillRect(0, 0, size, size);
          g.fillStyle = c;
          for (const side of [-1, 1]) {
            g.beginPath();
            g.ellipse(size * (0.5 + side * 0.2), size * 0.52, size * 0.2, size * 0.46, -side * 0.55, 0, TAU);
            g.fill();
          }
          g.strokeStyle = shade(c, 0.3);
          g.lineWidth = Math.max(0.6, size * 0.08);
          g.beginPath();
          g.moveTo(size * 0.2, size * 0.2);
          g.lineTo(size * 0.42, size * 0.5);
          g.moveTo(size * 0.8, size * 0.2);
          g.lineTo(size * 0.58, size * 0.5);
          g.stroke();
        }),
      );
    };

    const drawSpool = (gc: CanvasRenderingContext2D, x: number, y: number, size: number, color: number, upright: boolean, alpha = 1) => {
      const c = hues[color];
      gc.globalAlpha = alpha;
      if (!upright) {
        gc.fillStyle = shade(c, -0.35);
        gc.beginPath();
        gc.ellipse(x, y + size * 0.06, size * 0.36, size * 0.3, 0, 0, TAU);
        gc.fill();
        gc.fillStyle = c;
        gc.beginPath();
        gc.ellipse(x, y, size * 0.36, size * 0.3, 0, 0, TAU);
        gc.fill();
        gc.fillStyle = shade(c, -0.45);
        gc.beginPath();
        gc.ellipse(x, y, size * 0.09, size * 0.075, 0, 0, TAU);
        gc.fill();
        gc.globalAlpha = 1;
        return;
      }
      const bw = size * 0.5;
      const bh = size * 0.62;
      const fw = size * 0.72;
      const fh = size * 0.16;
      gc.fillStyle = c;
      gc.fillRect(x - bw / 2, y - bh / 2, bw, bh);
      gc.strokeStyle = shade(c, -0.25);
      gc.lineWidth = Math.max(1, size * 0.035);
      gc.beginPath();
      for (let k = 1; k < 5; k++) {
        const ly = y - bh / 2 + (bh * k) / 5;
        gc.moveTo(x - bw / 2, ly);
        gc.lineTo(x + bw / 2, ly - size * 0.05);
      }
      gc.stroke();
      gc.fillStyle = shade(c, -0.4);
      for (const fy of [y - bh / 2 - fh * 0.6, y + bh / 2 - fh * 0.4]) {
        gc.beginPath();
        roundRect(gc, x - fw / 2, fy, fw, fh, fh / 2);
        gc.fill();
      }
      gc.fillStyle = shade(c, 0.35);
      gc.fillRect(x - bw / 2 + bw * 0.12, y - bh / 2 + bh * 0.12, bw * 0.12, bh * 0.6);
      gc.globalAlpha = 1;
    };

    const restart = () => {
      st = start(lv);
      drop = new Float32Array(lv.w);
      pos.clear();
      yarn.clear();
      cellShake.clear();
      acc = 0;
      mode = 'play';
      endT = 0;
    };

    const newLevel = () => {
      const p = params(level);
      lv = generate(p, Math.random);
      const theme = pick(THEMES);
      hues = Array.from({ length: p.colors }, (_, k) => theme[Math.round((k * (theme.length - 1)) / (p.colors - 1))]);
      restart();
      ctx.hud.set(`Level ${level}`);
      ctx.hud.sub(`${level - 1} solved`);
    };

    const tap = (x: number, y: number) => {
      if (mode !== 'play') return;
      const L = layout();
      const cx = Math.floor((x - L.gx) / L.cell);
      const cy = Math.floor((y - L.gridY) / L.cell);
      if (cx < 0 || cy < 0 || cx >= lv.gw || cy >= lv.gh) return;
      const i = cy * lv.gw + cx;
      if (!st.grid[i]) return;
      if (!free(st)[i]) {
        cellShake.set(i, 0.3);
        ctx.sfx.play('thud', 1.3, 0.5);
        ctx.haptics.tap();
        return;
      }
      const sp = st.grid[i]!;
      if (take(st, i) < 0) {
        trayShake = 0.35;
        ctx.sfx.play('click', 0.6);
        ctx.haptics.buzz(30);
        return;
      }
      pos.set(sp, cellXY(L, i));
      ctx.sfx.play('pop', 0.9 + Math.random() * 0.3);
      ctx.haptics.tap();
    };

    const finish = () => {
      if (mode === 'won') {
        newLevel();
        return;
      }
      mode = 'over';
      ctx.gameOver({ score: level - 1, text: 'Tray jammed!', retry: restart });
    };

    newLevel();
    ctx.hint('Tap a free spool; it pulls its color off the bottom');

    return {
      pointer: { down: (p) => tap(p.x, p.y) },
      update(dt) {
        fx.update(dt);
        trayShake = Math.max(0, trayShake - dt);
        cellShake.forEach((v, k) => (v - dt > 0 ? cellShake.set(k, v - dt) : cellShake.delete(k)));
        yarn.forEach((y) => (y.t += dt));
        const L = layout();
        const k = 1 - Math.exp(-14 * dt);
        st.tray.forEach((sp, j) => {
          const p = pos.get(sp)!;
          const t = slotXY(L, j);
          p.x = lerp(p.x, t.x, k);
          p.y = lerp(p.y, t.y, k);
        });
        const kd = 1 - Math.exp(-18 * dt);
        for (let x = 0; x < lv.w; x++) drop[x] = lerp(drop[x], st.cut[x], kd);
        if (mode === 'play') {
          acc += dt;
          while (acc >= PULL) {
            acc -= PULL;
            const tray = st.tray.slice();
            for (const p of pull(st)) {
              const sp = tray[p.slot];
              yarn.set(sp, { x: p.x, t: 0 });
              if (!p.done) continue;
              const at = pos.get(sp)!;
              fx.burst(at.x, at.y, 14, hues[p.color], { speed: 160, life: 0.5 });
              pos.delete(sp);
              yarn.delete(sp);
              ctx.sfx.play('score', 1.2, 0.4);
              ctx.haptics.tap();
            }
            if (won(st)) {
              mode = 'won';
              level++;
              ctx.store.set('level', level);
              ctx.submitScore(level - 1);
              ctx.sfx.play('win');
              ctx.haptics.bump();
              fx.burst(s.w / 2, L.py + L.ph / 2, 70, PALETTE, { speed: 450, life: 1.1 });
              break;
            }
            if (stuck(st)) {
              mode = 'lost';
              ctx.sfx.play('fail');
              ctx.haptics.buzz(120);
              break;
            }
          }
        } else if (mode !== 'over') {
          endT += dt;
          if (endT > (mode === 'won' ? 1.2 : 0.6)) finish();
        }
      },
      render(gc) {
        const L = layout();
        buildStitches(L.pc);
        gc.fillStyle = BG;
        gc.fillRect(0, 0, s.w, s.h);
        gc.fillStyle = BG2;
        gc.beginPath();
        roundRect(gc, L.px - 8, L.py - 8, L.pw + 16, L.ph + 16, 12);
        gc.fill();
        gc.save();
        gc.beginPath();
        gc.rect(L.px, L.py, L.pw, L.ph);
        gc.clip();
        for (let x = 0; x < lv.w; x++) {
          const last = lv.h - 1 - st.cut[x];
          const dx = L.px + x * L.pc;
          for (let y = 0; y <= last; y++) gc.drawImage(stitches[lv.px[y * lv.w + x]], dx, L.py + (y + drop[x]) * L.pc, L.pc, L.pc);
        }
        gc.restore();
        const sx = trayShake > 0 ? Math.sin(trayShake * 70) * 6 : 0;
        gc.fillStyle = BG2;
        gc.beginPath();
        roundRect(gc, L.trayX + sx, L.trayY - 8, L.trayW, L.trayH + 16, L.trayH * 0.4);
        gc.fill();
        for (let j = 0; j < lv.slots; j++) {
          const c = slotXY(L, j);
          gc.fillStyle = 'rgba(255,255,255,0.07)';
          gc.beginPath();
          roundRect(gc, c.x - L.slotW / 2 + sx, L.trayY, L.slotW, L.trayH, 8);
          gc.fill();
        }
        gc.lineCap = 'round';
        gc.lineWidth = Math.max(1.5, L.pc * 0.3);
        yarn.forEach((y, sp) => {
          if (y.t > YARN) return;
          const p = pos.get(sp)!;
          const ax = L.px + (y.x + 0.5) * L.pc;
          const ay = L.py + L.ph;
          const bx = p.x + sx;
          const by = p.y - L.slotW * 0.3;
          gc.strokeStyle = hues[sp.color];
          gc.beginPath();
          gc.moveTo(ax, ay);
          gc.quadraticCurveTo((ax + bx) / 2 + Math.sin(y.t * 60) * 4, Math.max(ay, by) + 14, bx, by);
          gc.stroke();
        });
        if (mode === 'play' && st.tray.length === lv.slots - 1) {
          const c = slotXY(L, lv.slots - 1);
          const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 120);
          gc.globalAlpha = pulse;
          gc.fillStyle = '#ef4444';
          gc.beginPath();
          roundRect(gc, c.x - L.slotW * 0.32 + sx, c.y - L.slotW * 0.32, L.slotW * 0.64, L.slotW * 0.64, 6);
          gc.fill();
          gc.globalAlpha = 1;
          text(gc, '!', c.x + sx, c.y + 1, L.slotW * 0.45, '#ffffff');
        }
        st.tray.forEach((sp) => {
          const p = pos.get(sp)!;
          const live = target(st, sp.color, 0) >= 0;
          drawSpool(gc, p.x + sx, p.y - L.trayH * 0.08, L.slotW, sp.color, true, live ? 1 : 0.5);
          text(gc, String(sp.n), p.x + sx, L.trayY + L.trayH - 9, Math.max(10, L.slotW * 0.28), '#ffffff');
        });
        text(gc, `${st.tray.length}/${lv.slots}`, s.w / 2, L.trayY + L.trayH + 18, 14, 'rgba(255,255,255,0.75)');
        gc.fillStyle = 'rgba(255,255,255,0.92)';
        gc.beginPath();
        roundRect(gc, L.gx - 6, L.gridY - 6, L.cell * lv.gw + 12, L.cell * lv.gh + 12, 12);
        gc.fill();
        gc.strokeStyle = 'rgba(42,27,79,0.12)';
        gc.lineWidth = 1;
        gc.beginPath();
        for (let x = 1; x < lv.gw; x++) {
          gc.moveTo(L.gx + x * L.cell, L.gridY);
          gc.lineTo(L.gx + x * L.cell, L.gridY + L.cell * lv.gh);
        }
        for (let y = 1; y < lv.gh; y++) {
          gc.moveTo(L.gx, L.gridY + y * L.cell);
          gc.lineTo(L.gx + L.cell * lv.gw, L.gridY + y * L.cell);
        }
        gc.stroke();
        const open = free(st);
        st.grid.forEach((sp, i) => {
          if (!sp) return;
          const c = cellXY(L, i);
          const off = Math.sin((cellShake.get(i) ?? 0) * 60) * 3;
          drawSpool(gc, c.x + off, c.y, L.cell * 0.92, sp.color, !!open[i]);
        });
        if (mode === 'won') text(gc, 'Unraveled!', s.w / 2, L.py + L.ph / 2, 34, '#ffd23f');
        fx.draw(gc);
      },
    };
  });

export default game;
