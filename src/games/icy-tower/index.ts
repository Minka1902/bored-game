import { canvasGame } from '../../core/canvas-game';
import { PALETTE, shade } from '../../core/color';
import { text } from '../../core/draw';
import { Particles } from '../../core/fx/particles';
import { clamp, roundRect } from '../../core/math';
import type { GameFactory } from '../../core/types';
import { COMBO_TIME, GAP, HALF, JUMP, land, makeFloor, MAX_VX, scrollSpeed, SPEED_JUMP, step, tickCombo, W, type Body, type Combo, type Floor } from './logic';

const WALL = 16;
const BASE = 46;
const MAX_TOWER = 460;
const SUB = 1 / 120;
const BUFFER = 0.15;
const START_FLOOR = 5;
const SPIN_V = JUMP + MAX_VX * SPEED_JUMP * 0.75;
const THEMES = [
  { bg: '#1b2a4a', wall: '#3d5a8f', floor: '#bfe9ff', edge: '#6fb8e8' },
  { bg: '#2a1d14', wall: '#7a4a28', floor: '#e0a96a', edge: '#9a6334' },
  { bg: '#1f1f2b', wall: '#5a5a70', floor: '#c4c4d4', edge: '#7a7a92' },
  { bg: '#2b1430', wall: '#8a3a78', floor: '#ff9ad5', edge: '#d94f9a' },
  { bg: '#2a2108', wall: '#8a6a10', floor: '#ffd23f', edge: '#c99a00' },
  { bg: '#16203a', wall: '#6f84c4', floor: '#ffffff', edge: '#a9bdf0' },
];

interface Popup {
  text: string;
  t: number;
  color: string;
}

const theme = (n: number) => THEMES[Math.floor(n / 100) % THEMES.length];

function drawHero(g: CanvasRenderingContext2D, x: number, y: number, u: number, face: number, run: number, air: boolean, spin: number) {
  g.save();
  g.translate(x, y - u * 1.3);
  g.rotate(spin);
  const leg = air ? 0.5 : Math.sin(run) * 0.6;
  g.strokeStyle = '#1e2a52';
  g.lineWidth = u * 0.42;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-u * 0.28, u * 0.4);
  g.lineTo(-u * 0.28 + leg * u, u * (air ? 0.9 : 1.3));
  g.moveTo(u * 0.28, u * 0.4);
  g.lineTo(u * 0.28 - leg * u, u * (air ? 0.9 : 1.3));
  g.stroke();
  g.strokeStyle = '#f2c79d';
  g.lineWidth = u * 0.3;
  g.beginPath();
  const arm = air ? -1.1 : Math.sin(run + Math.PI) * 0.5;
  g.moveTo(-u * 0.55, -u * 0.25);
  g.lineTo(-u * 0.95, -u * 0.25 + arm * u * 0.7);
  g.moveTo(u * 0.55, -u * 0.25);
  g.lineTo(u * 0.95, -u * 0.25 + (air ? arm : -arm) * u * 0.7);
  g.stroke();
  g.fillStyle = '#ff4d6d';
  g.beginPath();
  roundRect(g, -u * 0.6, -u * 0.55, u * 1.2, u * 1.05, u * 0.35);
  g.fill();
  g.fillStyle = '#ffd23f';
  g.fillRect(-u * 0.6, -u * 0.12, u * 1.2, u * 0.16);
  g.fillStyle = '#f2c79d';
  g.beginPath();
  g.arc(0, -u * 1.05, u * 0.55, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3b82f6';
  g.beginPath();
  g.arc(0, -u * 1.15, u * 0.57, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(-u * 0.6, -u * 1.2, u * 1.2, u * 0.18);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(0, -u * 1.75, u * 0.18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b1208';
  g.beginPath();
  g.arc(face * u * 0.22, -u * 0.98, u * 0.09, 0, Math.PI * 2);
  g.arc(face * u * 0.42, -u * 0.98, u * 0.09, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let b: Body;
    let combo: Combo;
    let floors = new Map<number, Floor>();
    let cam = 0;
    let scrollT = 0;
    let started = false;
    let over = false;
    let best = 0;
    let bonus = 0;
    let jumpBuf = 0;
    let jumpKey = false;
    let run = 0;
    let spin = 0;
    let spinning = false;
    let face = 1;
    let popups: Popup[] = [];
    let hurry = 0;
    let shown = '';
    const held = new Map<number, number>();
    const keys = new Set<string>();
    const fx = new Particles();

    const floorAt = (n: number): Floor => {
      let f = floors.get(n);
      if (!f) {
        f = n ? makeFloor(n, Math.random) : { n, x: 0, w: W };
        floors.set(n, f);
      }
      return f;
    };

    const score = () => best * 10 + bonus;

    const reset = () => {
      b = { x: W / 2, y: 0, vx: 0, vy: 0, floor: 0, grounded: true };
      combo = { floors: 0, jumps: 0, t: 0 };
      floors = new Map();
      cam = 0;
      scrollT = 0;
      started = false;
      over = false;
      best = 0;
      bonus = 0;
      jumpBuf = 0;
      spin = 0;
      spinning = false;
      popups = [];
      hurry = 0;
      shown = '';
      held.clear();
      keys.clear();
    };

    const view = () => {
      const tw = Math.min(s.w, MAX_TOWER);
      const x0 = (s.w - tw) / 2;
      const k = (tw - WALL * 2) / W;
      return { tw, x0, k, sx: (x: number) => x0 + WALL + x * k, sy: (y: number) => s.h - BASE - (y - cam) * k, h: (s.h - BASE) / k };
    };

    const pop = (t: string, color = '#ffd23f') => popups.push({ text: t, t: 0, color });

    const pay = (amount: number) => {
      if (!amount) return;
      bonus += amount;
      pop(`+${amount}`, '#ffd23f');
      pop(amount >= 400 ? 'SUPER!' : amount >= 100 ? 'Great!' : 'Good!', '#ffffff');
      ctx.sfx.play('score', 1.2);
      ctx.haptics.bump();
    };

    const dirNow = () => {
      let d = 0;
      for (const side of held.values()) d = side;
      if (d) return d;
      return (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
    };

    const physics = (dt: number) => {
      const dir = dirNow();
      if (dir) face = dir;
      const was = b.grounded;
      const from = b.floor;
      const landed = step(b, dir, jumpBuf > 0 || jumpKey, dt, floorAt);
      if (was && !b.grounded && b.vy > 0) {
        jumpBuf = 0;
        spinning = b.vy >= SPIN_V;
        ctx.sfx.play('blip', 0.8 + Math.abs(b.vx) / MAX_VX, 0.5);
      }
      if (landed < 0) return;
      spin = 0;
      spinning = false;
      const r = land(combo, from, landed);
      combo = r.combo;
      pay(r.bonus);
      if (combo.jumps && landed - from >= 2) {
        const v = view();
        fx.burst(v.sx(b.x), v.sy(b.y), 12, PALETTE, { speed: 160, life: 0.5, angle: -Math.PI / 2, spread: 2.2 });
        ctx.sfx.play('pop', 0.9 + combo.jumps * 0.08, 0.6);
      } else ctx.sfx.play('tick', 0.8, 0.4);
      if (landed > best) {
        best = landed;
        if (landed % 100 === 0) {
          pop(`Floor ${landed}!`, '#7fe0ff');
          ctx.sfx.play('win');
        }
      }
      if (!started && best >= START_FLOOR) started = true;
    };

    const end = () => {
      over = true;
      pay(tickCombo(combo, Infinity).bonus);
      ctx.sfx.play('fail');
      ctx.haptics.buzz(150);
      ctx.gameOver({ score: score(), text: `You fell from floor ${best}`, retry: reset });
    };

    reset();
    ctx.hint('Hold a side to run · tap to jump');

    return {
      pointer: {
        down(p) {
          held.set(p.id, p.x < s.w / 2 ? -1 : 1);
          jumpBuf = BUFFER;
        },
        up(p) {
          held.delete(p.id);
        },
      },
      key(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.add('l');
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.add('r');
        else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          jumpKey = true;
          jumpBuf = BUFFER;
        } else return;
        e.preventDefault();
      },
      keyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.delete('l');
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.delete('r');
        else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') jumpKey = false;
      },
      update(dt) {
        fx.update(dt);
        popups = popups.filter((p) => (p.t += dt) < 1.1);
        if (over) return;
        for (let t = dt; t > 0; t -= SUB) physics(Math.min(SUB, t));
        jumpBuf = Math.max(0, jumpBuf - dt);
        if (b.grounded && Math.abs(b.vx) > 20) run += dt * (6 + Math.abs(b.vx) / 40);
        if (spinning) spin += dt * 13 * face;
        const r = tickCombo(combo, dt);
        combo = r.combo;
        pay(r.bonus);
        const v = view();
        if (started) {
          const before = scrollSpeed(scrollT);
          scrollT += dt;
          if (scrollSpeed(scrollT) > before) {
            hurry = 1.6;
            ctx.sfx.play('whoosh');
          }
          cam += scrollSpeed(scrollT) * dt;
        }
        cam = Math.max(cam, b.y - v.h * 0.5);
        hurry = Math.max(0, hurry - dt);
        if (b.y < cam - 30 / v.k) end();
        const hud = `${score()}|${best}`;
        if (hud !== shown) {
          shown = hud;
          ctx.hud.set(score());
          ctx.hud.sub(`Floor ${best}`);
        }
      },
      render(g) {
        const v = view();
        const th = theme(Math.max(0, Math.floor(cam / GAP)));
        g.fillStyle = shade(th.bg, -0.35);
        g.fillRect(0, 0, s.w, s.h);
        g.fillStyle = th.bg;
        g.fillRect(v.x0, 0, v.tw, s.h);
        const brick = 14;
        const off = (cam * v.k * 0.6) % (brick * 2);
        for (const wx of [v.x0, v.x0 + v.tw - WALL]) {
          g.fillStyle = th.wall;
          g.fillRect(wx, 0, WALL, s.h);
          g.fillStyle = shade(th.wall, -0.3);
          for (let y = -brick * 2 + off; y < s.h; y += brick) {
            g.fillRect(wx, y, WALL, 2);
            g.fillRect(wx + (Math.round((y - off) / brick) % 2 ? WALL / 2 : 2), y, 2, brick);
          }
        }
        const lo = Math.max(0, Math.floor(cam / GAP) - 1);
        const hi = Math.ceil((cam + v.h) / GAP) + 1;
        for (let n = lo; n <= hi; n++) {
          const f = floorAt(n);
          const t = theme(n);
          const x = v.sx(f.x);
          const y = v.sy(n * GAP);
          const w = f.w * v.k;
          const h = 12;
          g.fillStyle = t.edge;
          g.beginPath();
          roundRect(g, x, y, w, h, 5);
          g.fill();
          g.fillStyle = t.floor;
          g.beginPath();
          roundRect(g, x, y, w, h - 4, 5);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillRect(x + 6, y + 2, Math.max(0, w - 12), 2);
          if (n % 10 === 0 && n) {
            const tx = x + w / 2;
            g.fillStyle = 'rgba(0,0,0,0.45)';
            g.beginPath();
            roundRect(g, tx - 22, y + h + 3, 44, 18, 6);
            g.fill();
            text(g, String(n), tx, y + h + 12.5, 12, '#ffffff');
          }
        }
        const u = HALF * v.k * 1.15;
        drawHero(g, v.sx(b.x), v.sy(b.y), u, face, run, !b.grounded, spin);
        if (combo.jumps) {
          const bh = s.h * 0.4;
          const bx = v.x0 + WALL + 8;
          const by = s.h * 0.3;
          g.fillStyle = 'rgba(0,0,0,0.4)';
          g.beginPath();
          roundRect(g, bx, by, 10, bh, 5);
          g.fill();
          const fill = bh * clamp(combo.t / COMBO_TIME, 0, 1);
          g.fillStyle = PALETTE[Math.min(PALETTE.length - 1, combo.jumps)];
          g.beginPath();
          roundRect(g, bx, by + bh - fill, 10, fill, 5);
          g.fill();
          text(g, `COMBO ${combo.floors}`, bx + 18, by - 12, 16, '#ffd23f', 'left');
        }
        popups.forEach((p, i) => {
          g.globalAlpha = clamp(1.1 - p.t, 0, 1);
          text(g, p.text, s.w / 2, s.h * 0.36 + i * 34 - p.t * 30, 28, p.color);
        });
        g.globalAlpha = 1;
        if (hurry > 0 && Math.floor(hurry * 6) % 2) text(g, 'HURRY UP!', s.w / 2, s.h * 0.5, 34, '#ff4d6d');
        fx.draw(g);
      },
    };
  });

export default game;
