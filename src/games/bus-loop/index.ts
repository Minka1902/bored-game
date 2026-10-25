import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE, shade } from '../../core/color';
import { text } from '../../core/draw';
import { Particles } from '../../core/fx/particles';
import { clamp, lerp, roundRect } from '../../core/math';
import { levelRng, pick } from '../../core/rand';
import type { GameFactory } from '../../core/types';
import { blocker, board, canExit, cells, DIRS, generate, nextBoarding, occupancy, park, start, stuck, won, type Level, type State } from './logic';

const COLORS = ['#ff4d6d', '#3b82f6', '#ffd23f', '#34d399', '#a855f7', '#ff7a45'];
const SKINS = ['#f6d2b4', '#e8b48f', '#c98d62', '#9a6440', '#6e4428'];
const SLOTS = 5;
const SEATS = 3;
const ACTIVE = 2;
const TOP = 84;
const ROAD = 40;
const BOARD = 0.08;
const WALK_SPEED = 260;
const DRIVE_SPEED = 950;
const LEAVE = 0.9;
const CRASH = 0.6;
const IMPACT = 0.45;
const WIND = 0.15;
const ASPHALT = '#2c2936';
const LOT = '#383349';
const PAVING = '#8e88a3';

interface Pt {
  x: number;
  y: number;
}

interface Rider extends Pt {
  skin: string;
  step: number;
}

interface Walker {
  pts: Pt[];
  len: number;
  d: number;
  slot: number;
  color: number;
  skin: string;
}

interface Drive {
  bus: number;
  slot: number;
  pts: Pt[];
  len: number;
  d: number;
}

interface Leave {
  slot: number;
  bus: number;
  t: number;
}

interface Crash {
  bus: number;
  hit: number;
  dist: number;
  t: number;
}

interface Jolt {
  t: number;
  ang: number;
}

const pathLen = (pts: Pt[]) => pts.reduce((n, p, i) => (i ? n + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

function along(pts: Pt[], d: number): Pt {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= seg || i === pts.length - 1) {
      const k = seg ? clamp(d / seg, 0, 1) : 1;
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
    }
    d -= seg;
  }
  return pts[0];
}

/** How far a crashing bus is pushed along its nose: a short back-up, a lunge into the blocker, then easing back. */
function crashOffset(c: Crash, wind: number): number {
  if (c.t < WIND) return -wind * (c.t / WIND);
  if (c.t < IMPACT) return lerp(-wind, c.dist, ((c.t - WIND) / (IMPACT - WIND)) ** 2);
  return c.dist * (1 - Math.sin(((c.t - IMPACT) / (1 - IMPACT)) * Math.PI * 0.5));
}

/** Heading at distance d, read a little ahead and behind so corners turn smoothly. */
function heading(pts: Pt[], d: number, len: number): number {
  const a = along(pts, clamp(d - 10, 0, len - 1));
  const b = along(pts, clamp(d + 10, 1, len));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Front view of a person standing at (x, y); u is about a third of their height. */
function drawPerson(g: CanvasRenderingContext2D, x: number, y: number, u: number, shirt: string, skin: string, step: number) {
  const sw = Math.sin(step) * u * 0.35;
  g.strokeStyle = '#231c38';
  g.lineWidth = u * 0.42;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - u * 0.32, y + u * 0.5);
  g.lineTo(x - u * 0.32 + sw, y + u * 1.45);
  g.moveTo(x + u * 0.32, y + u * 0.5);
  g.lineTo(x + u * 0.32 - sw, y + u * 1.45);
  g.stroke();
  g.fillStyle = shade(shirt, -0.3);
  g.beginPath();
  roundRect(g, x - u * 0.78, y - u * 0.62, u * 1.56, u * 1.38, u * 0.5);
  g.fill();
  g.fillStyle = shirt;
  g.beginPath();
  roundRect(g, x - u * 0.7, y - u * 0.62, u * 1.4, u * 1.2, u * 0.45);
  g.fill();
  g.fillStyle = skin;
  g.beginPath();
  g.arc(x, y - u * 1.15, u * 0.55, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a1a12';
  g.beginPath();
  g.arc(x, y - u * 1.3, u * 0.5, Math.PI * 1.05, Math.PI * 1.95);
  g.fill();
}

/** Top-down bus heading along ang; its roof skylights double as seats, the first `filled` of them taken. */
function drawBus(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, wid: number, color: string, cap: number, filled: number, skin: string) {
  const r = wid * 0.24;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  roundRect(g, -len / 2 + 2, -wid / 2 + 3, len, wid, r);
  g.fill();
  g.fillStyle = '#15121c';
  for (const fx of [-len * 0.3, len * 0.27]) g.fillRect(fx - wid * 0.17, -wid * 0.56, wid * 0.34, wid * 1.12);
  g.fillStyle = shade(color, -0.32);
  g.beginPath();
  roundRect(g, -len / 2, -wid / 2, len, wid, r);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  roundRect(g, -len / 2 + 1.5, -wid / 2 + 1.5, len - 3, wid - 4, r * 0.85);
  g.fill();
  g.fillStyle = shade(color, -0.45);
  g.fillRect(len / 2 - len * 0.19, -wid / 2 - wid * 0.1, len * 0.05, wid * 0.1);
  g.fillRect(len / 2 - len * 0.19, wid / 2, len * 0.05, wid * 0.1);
  g.fillStyle = '#1f3b5c';
  g.beginPath();
  roundRect(g, len / 2 - len * 0.15, -wid * 0.38, len * 0.1, wid * 0.76, 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(len / 2 - len * 0.13, -wid * 0.32, len * 0.03, wid * 0.3);
  g.fillStyle = '#fff3a0';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(len / 2 - 1.5, side * wid * 0.32, wid * 0.07, 0, Math.PI * 2);
    g.fill();
  }
  const per = Math.ceil(cap / 2);
  const sw = (len * 0.66) / per;
  for (let k = 0; k < cap; k++) {
    const sx = -len / 2 + len * 0.1 + Math.floor(k / 2) * sw + sw * 0.12;
    const sy = k % 2 ? wid * 0.04 : -wid * 0.34;
    g.fillStyle = '#26304a';
    g.beginPath();
    roundRect(g, sx, sy, sw * 0.76, wid * 0.28, 2);
    g.fill();
    if (k >= filled) continue;
    g.fillStyle = skin;
    g.beginPath();
    g.arc(sx + sw * 0.38, sy + wid * 0.14, Math.min(sw * 0.3, wid * 0.11), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let level = ctx.store.get('level', 1);
    let lv: Level;
    let st: State;
    let riders: Rider[] = [];
    let walkers: Walker[] = [];
    let drives: Drive[] = [];
    let leaves: Leave[] = [];
    let crashes: Crash[] = [];
    let acc = 0;
    let mode: 'play' | 'won' | 'lost' | 'over' = 'play';
    let endT = 0;
    let stripShake = 0;
    const jolts = new Map<number, Jolt>();
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
      const sp = clamp((s.w - 40) / lv.window, 12, 26);
      const pu = sp * 0.36;
      const rowH = pu * 3.6;
      const slotW = Math.min(64, (s.w - 32) / SLOTS - 8);
      const slotH = slotW * 1.45;
      const side = Math.max(26, pu * 3.4);
      const cell = Math.max(8, Math.min((s.w - 24 - ROAD * 2) / lv.gw, (s.h - TOP - rowH * 3 - side - slotH - ROAD * 2 - 12) / lv.gh));
      const lotW = cell * lv.gw;
      const lotH = cell * lv.gh;
      const lotX = (s.w - lotW) / 2;
      const lotY = s.h - 10 - ROAD - lotH;
      const bayY = lotY - ROAD - slotH;
      const sideY = bayY - side;
      const frontY = sideY - pu * 1.7;
      const rows = Math.max(1, Math.floor((frontY - TOP - pu * 1.5) / rowH) + 1);
      const qx0 = (s.w - sp * (lv.window - 1)) / 2;
      const slotX = (j: number) => (s.w - SLOTS * slotW - (SLOTS - 1) * 8) / 2 + j * (slotW + 8);
      const ring = { l: lotX - ROAD / 2, r: lotX + lotW + ROAD / 2, t: lotY - ROAD / 2, b: lotY + lotH + ROAD / 2 };
      return { sp, pu, rowH, slotW, slotH, side, cell, lotW, lotH, lotX, lotY, bayY, sideY, frontY, rows, qx0, slotX, ring };
    };
    type Layout = ReturnType<typeof layout>;

    const spot = (L: Layout, i: number): Pt => {
      const w = lv.window;
      const r = Math.floor(i / w);
      const j = i % w;
      return { x: L.qx0 + (r % 2 ? j : w - 1 - j) * L.sp, y: L.frontY - r * L.rowH };
    };

    const bay = (L: Layout, j: number): Pt => ({ x: L.slotX(j) + L.slotW / 2, y: L.bayY + L.slotH / 2 });

    const busRect = (L: Layout, i: number) => {
      const b = lv.buses[i];
      const cs = cells(b, lv.gw);
      const xs = cs.map((c) => c % lv.gw);
      const ys = cs.map((c) => Math.floor(c / lv.gw));
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      return {
        x: L.lotX + (x0 + (Math.max(...xs) - x0 + 1) / 2) * L.cell,
        y: L.lotY + (y0 + (Math.max(...ys) - y0 + 1) / 2) * L.cell,
        len: b.len * L.cell - 6,
        ang: Math.atan2(DIRS[b.dir][1], DIRS[b.dir][0]),
      };
    };

    /** Out of the lot along the bus's nose, around the ring road to its top side, then nose-first into the bay. */
    const drivePath = (L: Layout, i: number, j: number): Pt[] => {
      const r = busRect(L, i);
      const [dx, dy] = DIRS[lv.buses[i].dir];
      const pts: Pt[] = [{ x: r.x, y: r.y }];
      let x = dx ? (dx > 0 ? L.ring.r : L.ring.l) : r.x;
      const y = dy ? (dy > 0 ? L.ring.b : L.ring.t) : r.y;
      pts.push({ x, y });
      if (dy > 0) {
        x = r.x < s.w / 2 ? L.ring.l : L.ring.r;
        pts.push({ x, y });
      }
      if (y !== L.ring.t) pts.push({ x, y: L.ring.t });
      const c = bay(L, j);
      pts.push({ x: c.x, y: L.ring.t }, c);
      return pts;
    };

    const walkPath = (L: Layout, from: Pt, j: number): Pt[] => {
      const c = bay(L, j);
      const mid = L.sideY + L.side / 2;
      return [from, { x: from.x, y: mid }, { x: c.x, y: mid }, { x: c.x, y: L.bayY + L.slotH * 0.12 }];
    };

    const restart = () => {
      st = start(lv);
      const L = layout();
      riders = st.queue.map((_, i) => ({ ...spot(L, i), skin: pick(SKINS), step: 0 }));
      walkers = [];
      drives = [];
      leaves = [];
      crashes = [];
      jolts.clear();
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
      if (i < 0 || crashes.some((c) => c.bus === i)) return;
      const hit = blocker(lv, st.lot, i);
      if (hit) {
        crashes.push({ bus: i, hit: hit.bus, dist: hit.gap * L.cell + 6, t: 0 });
        ctx.sfx.play('whoosh', 1.4, 0.4);
        return;
      }
      if (st.slots.indexOf(null) < 0 || !canExit(lv, st.lot, i)) {
        stripShake = 0.35;
        ctx.sfx.play('click', 0.6);
        ctx.haptics.buzz(30);
        return;
      }
      const slot = park(lv, st, i);
      const pts = drivePath(L, i, slot);
      drives.push({ bus: i, slot, pts, len: pathLen(pts), d: 0 });
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

    const drawScene = (gc: CanvasRenderingContext2D, L: Layout) => {
      gc.fillStyle = BG;
      gc.fillRect(0, 0, s.w, s.h);
      const w = lv.window;
      const x0 = L.qx0 - L.sp * 0.6;
      const x1 = L.qx0 + (w - 1) * L.sp + L.sp * 0.6;
      for (let r = 0; r < L.rows - 1; r++) {
        const y = L.frontY - r * L.rowH - L.rowH * 0.42;
        const a = r % 2 ? x0 : x0 + L.sp * 1.2;
        const b = r % 2 ? x1 - L.sp * 1.2 : x1;
        gc.strokeStyle = '#c0283f';
        gc.lineWidth = 2.5;
        gc.beginPath();
        gc.moveTo(a, y);
        for (let x = a; x < b; x += L.sp * 3) gc.quadraticCurveTo(x + L.sp * 1.5, y + 4, Math.min(b, x + L.sp * 3), y);
        gc.stroke();
        gc.fillStyle = '#ffd23f';
        for (let x = a; x <= b + 1; x += L.sp * 3) {
          gc.fillRect(x - 1.5, y - 7, 3, 9);
          gc.beginPath();
          gc.arc(x, y - 7, 2.6, 0, Math.PI * 2);
          gc.fill();
        }
      }
      gc.fillStyle = PAVING;
      gc.fillRect(0, L.sideY, s.w, L.side);
      gc.strokeStyle = 'rgba(0,0,0,0.12)';
      gc.lineWidth = 1;
      gc.beginPath();
      for (let x = 0; x < s.w; x += 22) {
        gc.moveTo(x, L.sideY);
        gc.lineTo(x, L.sideY + L.side);
      }
      gc.stroke();
      gc.fillStyle = '#d9d4e6';
      gc.fillRect(0, L.bayY - 3, s.w, 3);
      gc.fillStyle = ASPHALT;
      gc.fillRect(0, L.bayY, s.w, L.lotY - L.bayY);
      gc.fillRect(L.ring.l - ROAD / 2, L.lotY, ROAD, L.lotH + ROAD);
      gc.fillRect(L.ring.r - ROAD / 2, L.lotY, ROAD, L.lotH + ROAD);
      gc.fillRect(L.ring.l - ROAD / 2, L.ring.b - ROAD / 2, L.ring.r - L.ring.l + ROAD, ROAD);
      gc.strokeStyle = 'rgba(255,255,255,0.55)';
      gc.lineWidth = 2;
      gc.beginPath();
      for (let j = 0; j <= SLOTS; j++) {
        const x = L.slotX(j) - 4;
        gc.moveTo(x, L.bayY + 2);
        gc.lineTo(x, L.bayY + L.slotH);
      }
      gc.stroke();
      gc.strokeStyle = 'rgba(255,210,63,0.5)';
      gc.setLineDash([10, 10]);
      gc.beginPath();
      gc.moveTo(0, L.ring.t);
      gc.lineTo(s.w, L.ring.t);
      gc.moveTo(L.ring.l, L.ring.t);
      gc.lineTo(L.ring.l, L.ring.b);
      gc.lineTo(L.ring.r, L.ring.b);
      gc.lineTo(L.ring.r, L.ring.t);
      gc.stroke();
      gc.setLineDash([]);
      gc.fillStyle = LOT;
      gc.fillRect(L.lotX, L.lotY, L.lotW, L.lotH);
      gc.strokeStyle = 'rgba(255,255,255,0.07)';
      gc.lineWidth = 1;
      gc.beginPath();
      for (let k = 1; k < lv.gw; k++) {
        gc.moveTo(L.lotX + k * L.cell, L.lotY);
        gc.lineTo(L.lotX + k * L.cell, L.lotY + L.lotH);
      }
      for (let k = 1; k < lv.gh; k++) {
        gc.moveTo(L.lotX, L.lotY + k * L.cell);
        gc.lineTo(L.lotX + L.lotW, L.lotY + k * L.cell);
      }
      gc.stroke();
    };

    newLevel();
    ctx.hint('Tap a bus with a clear road; riders walk to their color');

    return {
      pointer: { down: (p) => tap(p.x, p.y) },
      update(dt) {
        fx.update(dt);
        stripShake = Math.max(0, stripShake - dt);
        for (const [k, j] of jolts) if ((j.t -= dt) <= 0) jolts.delete(k);
        const L = layout();
        const k = 1 - Math.exp(-10 * dt);
        riders.forEach((p, i) => {
          const t = spot(L, i);
          if (Math.hypot(t.x - p.x, t.y - p.y) > 0.6) p.step += dt * 14;
          p.x = lerp(p.x, t.x, k);
          p.y = lerp(p.y, t.y, k);
        });
        walkers = walkers.filter((w) => {
          w.d += WALK_SPEED * dt;
          return w.d < w.len;
        });
        drives = drives.filter((d) => {
          const blocked = leaves.some((l) => l.slot === d.slot && l.t < 0.6);
          const stop = d.len - Math.hypot(d.pts[d.pts.length - 1].x - d.pts[d.pts.length - 2].x, d.pts[d.pts.length - 1].y - d.pts[d.pts.length - 2].y);
          d.d = blocked ? Math.min(d.d + DRIVE_SPEED * dt, stop) : d.d + DRIVE_SPEED * dt;
          return d.d < d.len;
        });
        leaves = leaves.filter((l) => {
          if (!walkers.some((w) => w.slot === l.slot)) l.t += dt / LEAVE;
          return l.t < 1;
        });
        crashes = crashes.filter((c) => {
          const before = c.t;
          c.t += dt / CRASH;
          if (before < IMPACT && c.t >= IMPACT) {
            const r = busRect(L, c.bus);
            const ex = r.x + Math.cos(r.ang) * (r.len / 2 + c.dist);
            const ey = r.y + Math.sin(r.ang) * (r.len / 2 + c.dist);
            fx.burst(ex, ey, 14, ['#ffd23f', '#ffffff', '#ff7a45'], { speed: 220, life: 0.4, size: 3 });
            fx.burst(ex, ey, 6, ['#9a94ad', '#c7c2d6'], { speed: 60, life: 0.7, size: 6 });
            jolts.set(c.hit, { t: 0.35, ang: r.ang });
            ctx.sfx.play('hit', 0.8);
            ctx.sfx.play('thud', 0.9, 0.7);
            ctx.haptics.bump();
          }
          return c.t < 1;
        });
        if (mode === 'play') {
          acc = Math.min(acc + dt, BOARD);
          const nb = nextBoarding(lv, st);
          if (acc >= BOARD && nb && !drives.some((d) => d.slot === nb[1])) {
            const bus = st.slots[nb[1]]!.bus;
            const b = board(lv, st)!;
            acc -= BOARD;
            const r = riders.splice(b.person, 1)[0];
            const pts = walkPath(L, r, b.slot);
            walkers.push({ pts, len: pathLen(pts), d: 0, slot: b.slot, color: b.color, skin: r.skin });
            ctx.sfx.play('blip', 1.4 + Math.random() * 0.3, 0.25);
            if (b.full) {
              leaves.push({ slot: b.slot, bus, t: 0 });
              ctx.sfx.play('score', 1, 0.5);
              ctx.haptics.tap();
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
            fx.burst(s.w / 2, L.sideY, 70, PALETTE, { speed: 450, life: 1.1 });
          } else if (!drives.length && stuck(lv, st)) {
            mode = 'lost';
            ctx.sfx.play('fail');
            ctx.haptics.buzz(120);
          }
        } else if (mode !== 'over' && !walkers.length && !drives.length) {
          endT += dt;
          if (endT > (mode === 'won' ? 1.2 : 0.4)) finish();
        }
      },
      render(gc) {
        const L = layout();
        drawScene(gc, L);
        const seen = Math.min(riders.length, L.rows * lv.window);
        for (let i = seen - 1; i >= 0; i--) drawPerson(gc, riders[i].x, riders[i].y, L.pu, COLORS[st.queue[i]], riders[i].skin, riders[i].step);
        if (riders.length > seen) text(gc, `+${riders.length - seen}`, s.w - 14, TOP - 4, 13, 'rgba(255,255,255,0.75)', 'right');
        const sx = stripShake > 0 ? Math.sin(stripShake * 70) * 6 : 0;
        const wide = L.slotW * 0.7;
        for (let j = 0; j < SLOTS; j++) {
          const p = st.slots[j];
          if (!p || drives.some((d) => d.slot === j)) continue;
          const b = lv.buses[p.bus];
          const c = bay(L, j);
          const going = walkers.filter((w) => w.slot === j).length;
          drawBus(gc, c.x + sx, c.y, -Math.PI / 2, L.slotH * 0.92, wide, COLORS[b.color], b.cap, b.cap - p.seats - going, SKINS[1]);
        }
        for (const l of leaves) {
          const b = lv.buses[l.bus];
          const c = bay(L, l.slot);
          const k1 = Math.min(1, l.t / 0.35);
          const k2 = Math.max(0, (l.t - 0.35) / 0.65);
          const x = c.x + k2 * k2 * (s.w + 120 - c.x);
          const y = lerp(c.y, L.ring.t, 1 - (1 - k1) * (1 - k1));
          drawBus(gc, x, y, lerp(-Math.PI / 2, 0, k1), L.slotH * 0.92, wide, COLORS[b.color], b.cap, b.cap, SKINS[1]);
        }
        lv.buses.forEach((b, i) => {
          if (!st.lot[i]) return;
          const r = busRect(L, i);
          const cr = crashes.find((c) => c.bus === i);
          const j = jolts.get(i);
          const off = cr ? crashOffset(cr, L.cell * 0.3) : 0;
          const jx = j ? Math.cos(j.ang) * Math.sin(j.t * 40) * 6 * (j.t / 0.35) : 0;
          const jy = j ? Math.sin(j.ang) * Math.sin(j.t * 40) * 6 * (j.t / 0.35) : 0;
          drawBus(gc, r.x + Math.cos(r.ang) * off + jx, r.y + Math.sin(r.ang) * off + jy, r.ang, r.len, L.cell * 0.78, COLORS[b.color], b.cap, 0, SKINS[1]);
        });
        for (const d of drives) {
          const b = lv.buses[d.bus];
          const p = along(d.pts, d.d);
          const k = d.d / d.len;
          const r = busRect(L, d.bus);
          drawBus(gc, p.x, p.y, heading(d.pts, d.d, d.len), lerp(r.len, L.slotH * 0.92, k), Math.min(ROAD - 6, lerp(L.cell * 0.78, wide, k)), COLORS[b.color], b.cap, 0, SKINS[1]);
        }
        for (const w of walkers) {
          const p = along(w.pts, w.d);
          const tail = clamp((w.len - w.d) / (L.slotH * 0.3), 0, 1);
          gc.globalAlpha = 0.3 + tail * 0.7;
          drawPerson(gc, p.x, p.y, L.pu * (0.6 + tail * 0.4), COLORS[w.color], w.skin, w.d * 0.25);
        }
        gc.globalAlpha = 1;
        if (mode === 'won' && !walkers.length) text(gc, 'All aboard!', s.w / 2, L.sideY - L.rowH, 34, '#ffd23f');
        fx.draw(gc);
      },
    };
  });

export default game;
