import { canvasGame } from '../../core/canvas-game';
import { BG, BG2, PALETTE, shade } from '../../core/color';
import { text } from '../../core/draw';
import { Particles } from '../../core/fx/particles';
import { clamp, lerp, roundRect, TAU } from '../../core/math';
import { levelRng } from '../../core/rand';
import type { GameFactory } from '../../core/types';
import { board, canExit, cells, DIRS, generate, occupancy, park, start, stuck, won, type Level, type State } from './logic';

const COLORS = ['#ff4d6d', '#3b82f6', '#ffd23f', '#34d399', '#a855f7', '#ff7a45'];
const SLOTS = 5;
const SEATS = 3;
const ACTIVE = 2;
const FEED = 14;
const TOP = 84;
const BOARD = 0.08;
const DRIVE = 0.4;
const FLY = 0.35;
const LEAVE = 0.6;

interface Drive {
  bus: number;
  slot: number;
  t: number;
}

interface Flight {
  x: number;
  y: number;
  slot: number;
  color: number;
  t: number;
}

interface Leave {
  slot: number;
  color: number;
  t: number;
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let level = ctx.store.get('level', 1);
    let lv: Level;
    let st: State;
    let pos: { x: number; y: number }[] = [];
    let drives: Drive[] = [];
    let flights: Flight[] = [];
    let leaves: Leave[] = [];
    let acc = 0;
    let mode: 'play' | 'won' | 'lost' | 'over' = 'play';
    let endT = 0;
    let stripShake = 0;
    const busShake = new Map<number, number>();
    const fx = new Particles();

    const params = (n: number) => {
      const gw = Math.min(7, 5 + Math.floor((n - 1) / 3));
      return {
        gw,
        gh: gw + 1,
        colors: Math.min(COLORS.length, 3 + Math.floor((n - 1) / 2)),
        seats: SEATS,
        active: ACTIVE,
        window: Math.max(10, 20 - n),
        slots: SLOTS,
      };
    };

    const layout = () => {
      const rx = Math.min(s.w * 0.36, 170);
      const ry = rx * 0.42;
      const perim = TAU * Math.sqrt((rx * rx + ry * ry) / 2);
      const rr = clamp((perim / lv.window) * 0.42, 4, 11);
      const ring = { x: s.w / 2 + rr, y: TOP + ry + rr, rx, ry, rr };
      const slotW = Math.min(52, (s.w - 32) / SLOTS - 10);
      const slotH = slotW * 1.35;
      const stripY = ring.y + ry + rr * 2 + 14;
      const slotX = (i: number) => (s.w - SLOTS * slotW - (SLOTS - 1) * 10) / 2 + i * (slotW + 10);
      const lotY = stripY + slotH + 34;
      const cell = Math.max(8, Math.min((s.w - 24) / lv.gw, (s.h - lotY - 14) / lv.gh));
      const lotX = (s.w - cell * lv.gw) / 2;
      return { ring, slotW, slotH, stripY, slotX, lotY, lotX, cell };
    };

    const spot = (L: ReturnType<typeof layout>, i: number) => {
      const { ring } = L;
      if (i < lv.window) {
        const a = Math.PI + ((lv.window - 1 - i + 0.5) / lv.window) * TAU;
        return { x: ring.x + Math.cos(a) * ring.rx, y: ring.y + Math.sin(a) * ring.ry };
      }
      const k = Math.min(i - lv.window, FEED);
      return { x: ring.x - ring.rx - ring.rr * 2.4, y: ring.y - (k + 1) * ring.rr * 2.1 };
    };

    const busRect = (L: ReturnType<typeof layout>, i: number) => {
      const b = lv.buses[i];
      const cs = cells(b, lv.gw);
      const xs = cs.map((c) => c % lv.gw);
      const ys = cs.map((c) => Math.floor(c / lv.gw));
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      return {
        x: L.lotX + (x0 + (Math.max(...xs) - x0 + 1) / 2) * L.cell,
        y: L.lotY + (y0 + (Math.max(...ys) - y0 + 1) / 2) * L.cell,
        len: b.len * L.cell,
      };
    };

    const slotCenter = (L: ReturnType<typeof layout>, j: number) => ({ x: L.slotX(j) + L.slotW / 2, y: L.stripY + L.slotH / 2 });

    const drawBus = (gc: CanvasRenderingContext2D, x: number, y: number, len: number, wide: number, dir: number, color: string) => {
      gc.save();
      gc.translate(x, y);
      gc.rotate((dir - 1) * (Math.PI / 2));
      gc.fillStyle = shade(color, -0.35);
      gc.beginPath();
      roundRect(gc, -len / 2, -wide / 2 + 2, len, wide, wide * 0.25);
      gc.fill();
      gc.fillStyle = color;
      gc.beginPath();
      roundRect(gc, -len / 2, -wide / 2, len, wide - 2, wide * 0.25);
      gc.fill();
      gc.fillStyle = shade(color, 0.45);
      gc.fillRect(len / 2 - wide * 0.42, -wide * 0.32, wide * 0.2, wide * 0.6);
      gc.fillStyle = '#ffffff';
      gc.beginPath();
      gc.moveTo(wide * 0.3, 0);
      gc.lineTo(-wide * 0.1, -wide * 0.22);
      gc.lineTo(-wide * 0.1, wide * 0.22);
      gc.closePath();
      gc.fill();
      gc.restore();
    };

    const drawRider = (gc: CanvasRenderingContext2D, x: number, y: number, r: number, color: number) => {
      gc.fillStyle = shade(COLORS[color], -0.35);
      gc.beginPath();
      gc.arc(x, y + r * 0.25, r, 0, TAU);
      gc.fill();
      gc.fillStyle = COLORS[color];
      gc.beginPath();
      gc.arc(x, y, r * 0.9, 0, TAU);
      gc.fill();
    };

    const restart = () => {
      st = start(lv);
      const L = layout();
      pos = st.queue.map((_, i) => spot(L, i));
      drives = [];
      flights = [];
      leaves = [];
      busShake.clear();
      acc = 0;
      mode = 'play';
      endT = 0;
    };

    const newLevel = () => {
      lv = generate(params(level), levelRng(ctx.store));
      restart();
      ctx.hud.set(`Level ${level}`);
      ctx.hud.sub(`${level - 1} solved`);
    };

    const tap = (x: number, y: number) => {
      if (mode !== 'play') return;
      const L = layout();
      const cx = Math.floor((x - L.lotX) / L.cell);
      const cy = Math.floor((y - L.lotY) / L.cell);
      if (cx < 0 || cy < 0 || cx >= lv.gw || cy >= lv.gh) return;
      const i = occupancy(lv, st.lot)[cy * lv.gw + cx];
      if (i < 0) return;
      if (st.slots.indexOf(null) < 0) {
        stripShake = 0.35;
        ctx.sfx.play('click', 0.6);
        ctx.haptics.buzz(30);
        return;
      }
      if (!canExit(lv, st.lot, i)) {
        busShake.set(i, 0.3);
        ctx.sfx.play('thud', 1.3, 0.5);
        ctx.haptics.tap();
        return;
      }
      drives.push({ bus: i, slot: park(lv, st, i), t: 0 });
      ctx.sfx.play('whoosh', 1.2, 0.5);
      ctx.haptics.tap();
    };

    const finish = () => {
      if (mode === 'won') {
        newLevel();
        return;
      }
      mode = 'over';
      ctx.gameOver({ score: level - 1, text: 'Parking full!', retry: restart });
    };

    newLevel();
    ctx.hint('Tap a bus with a clear road; riders hop on their color');

    return {
      pointer: { down: (p) => tap(p.x, p.y) },
      update(dt) {
        fx.update(dt);
        stripShake = Math.max(0, stripShake - dt);
        busShake.forEach((v, k) => (v - dt > 0 ? busShake.set(k, v - dt) : busShake.delete(k)));
        const L = layout();
        const k = 1 - Math.exp(-12 * dt);
        pos.forEach((p, i) => {
          const t = spot(L, i);
          p.x = lerp(p.x, t.x, k);
          p.y = lerp(p.y, t.y, k);
        });
        drives = drives.filter((d) => (d.t += dt / DRIVE) < 1);
        leaves = leaves.filter((l) => (l.t += dt / LEAVE) < 1);
        flights = flights.filter((f) => {
          f.t += dt / FLY;
          if (f.t < 1) return true;
          const c = slotCenter(L, f.slot);
          fx.burst(c.x, c.y - L.slotH * 0.3, 3, COLORS[f.color], { speed: 80, size: 3, life: 0.3 });
          return false;
        });
        if (mode === 'play') {
          acc = Math.min(acc + dt, BOARD);
          if (acc >= BOARD) {
            const b = board(lv, st);
            if (b) {
              acc -= BOARD;
              const p = pos.splice(b.person, 1)[0];
              flights.push({ x: p.x, y: p.y, slot: b.slot, color: b.color, t: 0 });
              ctx.sfx.play('blip', 1.4 + Math.random() * 0.3, 0.25);
              if (b.full) {
                leaves.push({ slot: b.slot, color: b.color, t: 0 });
                ctx.sfx.play('score', 1, 0.5);
                ctx.haptics.tap();
              }
            }
          }
          if (won(st)) {
            mode = 'won';
            level++;
            ctx.store.set('level', level);
            ctx.store.set('seed', 0);
            ctx.submitScore(level - 1);
            ctx.sfx.play('win');
            ctx.haptics.bump();
            fx.burst(s.w / 2, L.stripY, 70, PALETTE, { speed: 450, life: 1.1 });
          } else if (!drives.length && stuck(lv, st)) {
            mode = 'lost';
            ctx.sfx.play('fail');
            ctx.haptics.buzz(120);
          }
        } else if (mode !== 'over' && !flights.length && !drives.length) {
          endT += dt;
          if (endT > (mode === 'won' ? 1 : 0.4)) finish();
        }
      },
      render(gc) {
        const L = layout();
        const { ring } = L;
        gc.fillStyle = BG;
        gc.fillRect(0, 0, s.w, s.h);
        gc.strokeStyle = BG2;
        gc.lineWidth = ring.rr * 3;
        gc.beginPath();
        gc.ellipse(ring.x, ring.y, ring.rx, ring.ry, 0, 0, TAU);
        gc.moveTo(ring.x - ring.rx - ring.rr * 2.4, ring.y);
        gc.lineTo(ring.x - ring.rx - ring.rr * 2.4, 0);
        gc.stroke();
        for (let i = Math.min(pos.length, lv.window + FEED) - 1; i >= 0; i--) drawRider(gc, pos[i].x, pos[i].y, ring.rr, st.queue[i]);
        const extra = st.queue.length - lv.window - FEED;
        if (extra > 0) text(gc, `+${extra}`, ring.x - ring.rx + ring.rr * 1.5, TOP - 6, 12, 'rgba(255,255,255,0.7)', 'left');
        const sx = stripShake > 0 ? Math.sin(stripShake * 70) * 6 : 0;
        const wide = L.slotW * 0.7;
        for (let j = 0; j < SLOTS; j++) {
          const x = L.slotX(j) + sx;
          gc.fillStyle = 'rgba(255,255,255,0.08)';
          gc.beginPath();
          roundRect(gc, x, L.stripY, L.slotW, L.slotH, 10);
          gc.fill();
          const p = st.slots[j];
          if (!p || drives.some((d) => d.slot === j)) continue;
          const c = COLORS[lv.buses[p.bus].color];
          drawBus(gc, x + L.slotW / 2, L.stripY + L.slotH / 2, L.slotH * 0.9, wide, 0, c);
          text(gc, String(p.seats), x + L.slotW / 2, L.stripY + L.slotH + 12, 13, c);
        }
        for (const l of leaves) {
          const c = slotCenter(L, l.slot);
          drawBus(gc, c.x + l.t * l.t * s.w, c.y, L.slotH * 0.9, wide, 1, COLORS[l.color]);
        }
        gc.fillStyle = BG2;
        gc.beginPath();
        roundRect(gc, L.lotX - 6, L.lotY - 6, L.cell * lv.gw + 12, L.cell * lv.gh + 12, 12);
        gc.fill();
        lv.buses.forEach((b, i) => {
          if (!st.lot[i]) return;
          const r = busRect(L, i);
          const shake = busShake.get(i) ?? 0;
          const off = Math.sin(shake * 60) * 4;
          drawBus(gc, r.x + DIRS[b.dir][0] * off, r.y + DIRS[b.dir][1] * off, r.len - 5, L.cell - 6, b.dir, COLORS[b.color]);
        });
        for (const d of drives) {
          const b = lv.buses[d.bus];
          const r = busRect(L, d.bus);
          const out = Math.max(lv.gw, lv.gh) * L.cell;
          const ex = { x: r.x + DIRS[b.dir][0] * out, y: clamp(r.y + DIRS[b.dir][1] * out, L.lotY, s.h) };
          const c = slotCenter(L, d.slot);
          if (d.t < 0.5) {
            const k = d.t * 2;
            gc.globalAlpha = 1 - k * 0.6;
            drawBus(gc, lerp(r.x, ex.x, k * k), lerp(r.y, ex.y, k * k), r.len - 5, L.cell - 6, b.dir, COLORS[b.color]);
          } else {
            const k = (d.t - 0.5) * 2;
            gc.globalAlpha = 0.4 + k * 0.6;
            drawBus(gc, lerp(clamp(ex.x, 0, s.w), c.x, k), lerp(L.lotY - 12, c.y, k), L.slotH * 0.9, wide, 0, COLORS[b.color]);
          }
          gc.globalAlpha = 1;
        }
        for (const f of flights) {
          const c = slotCenter(L, f.slot);
          drawRider(gc, lerp(f.x, c.x, f.t), lerp(f.y, c.y, f.t) - Math.sin(f.t * Math.PI) * 30, ring.rr * (1 - f.t * 0.5), f.color);
        }
        if (mode === 'won' && !flights.length) text(gc, 'All aboard!', s.w / 2, ring.y, 34, '#ffd23f');
        fx.draw(gc);
      },
    };
  });

export default game;
