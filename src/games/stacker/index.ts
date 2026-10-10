import { canvasGame } from '../../core/canvas-game';
import { BG, hsl } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { clamp, lerp } from '../../core/math';
import type { GameFactory } from '../../core/types';
import { sliceSlab, type Span } from './logic';

interface Debris extends Span {
  y: number;
  vy: number;
  rot: number;
  vr: number;
  hue: number;
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let stack: (Span & { hue: number })[] = [];
    let cur: Span = { x: 0, w: 0 };
    let dir = 1;
    let over = false;
    let streak = 0;
    let cam = 0;
    let flash = 0;
    let hue0 = Math.random() * 360;
    const debris: Debris[] = [];
    const fx = new Particles();
    fx.gravity = 300;

    const H = () => clamp(s.h / 18, 24, 40);
    const W0 = () => Math.min(s.w * 0.62, 340);
    const baseY = () => s.h - 70;
    const levelY = (i: number) => baseY() - i * H();
    const speed = () => Math.min(170 + stack.length * 9, 460);
    const hueAt = (i: number) => (hue0 + i * 11) % 360;

    const spawnNext = () => {
      const top = stack[stack.length - 1];
      dir = stack.length % 2 ? 1 : -1;
      cur = { x: dir > 0 ? -top.w * 0.3 : s.w - top.w * 0.7, w: top.w };
    };

    let lastW = s.w;
    const reset = () => {
      lastW = s.w;
      hue0 = Math.random() * 360;
      stack = [{ x: (s.w - W0()) / 2, w: W0(), hue: hueAt(0) }];
      debris.length = 0;
      over = false;
      streak = 0;
      cam = 0;
      ctx.hud.set(0);
      spawnNext();
    };

    const drop = () => {
      if (over) return;
      const prev = stack[stack.length - 1];
      const res = sliceSlab(prev, cur);
      const i = stack.length;
      const hue = hueAt(i);
      if (res.cut) debris.push({ ...res.cut, y: levelY(i) - H(), vy: 0, rot: 0, vr: (res.cut.x > prev.x ? 1 : -1) * 2, hue });
      if (!res.placed) {
        over = true;
        ctx.sfx.play('fail');
        ctx.haptics.buzz(70);
        setTimeout(() => ctx.gameOver({ score: stack.length - 1, retry: reset }), 900);
        return;
      }
      let placed = res.placed;
      if (res.perfect) {
        streak++;
        if (streak >= 3) {
          const grow = Math.min(8, W0() - placed.w);
          placed = { x: placed.x - grow / 2, w: placed.w + grow };
        }
        flash = 1;
        ctx.sfx.tone(523 * Math.pow(2, Math.min(streak, 12) / 12), 0.18, 'triangle', 0.3);
        ctx.haptics.bump();
        fx.burst(placed.x + placed.w / 2, levelY(i) - H(), 14, ['#ffffff', hsl(hue, 90, 75)], { speed: 160, life: 0.5 });
      } else {
        streak = 0;
        ctx.sfx.play('thud', 1 + Math.random() * 0.2);
        ctx.haptics.tap();
      }
      stack.push({ ...placed, hue });
      ctx.hud.set(stack.length - 1);
      spawnNext();
    };

    const slab = (g: CanvasRenderingContext2D, x: number, y: number, w: number, hue: number) => {
      const h = H();
      g.fillStyle = hsl(hue, 70, 58);
      g.fillRect(x, y, w, h);
      g.fillStyle = hsl(hue, 85, 72);
      g.fillRect(x, y, w, h * 0.28);
      g.fillStyle = hsl(hue, 60, 42);
      g.fillRect(x, y + h * 0.82, w, h * 0.18);
    };

    reset();
    ctx.hint('Tap to drop the slab');

    return {
      pointer: { down: drop },
      key(e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          drop();
        }
      },
      resize() {
        if (s.w !== lastW) reset();
      },
      update(dt) {
        fx.update(dt);
        flash = Math.max(0, flash - dt * 3);
        if (!over) {
          cur.x += dir * speed() * dt;
          const minX = -cur.w * 0.35;
          const maxX = s.w - cur.w * 0.65;
          if (cur.x > maxX) (cur.x = maxX), (dir = -1);
          if (cur.x < minX) (cur.x = minX), (dir = 1);
        }
        const target = Math.max(0, stack.length * H() - s.h * 0.45);
        cam = lerp(cam, target, 1 - Math.exp(-6 * dt));
        for (const d of debris) {
          d.vy += 1400 * dt;
          d.y += d.vy * dt;
          d.rot += d.vr * dt;
        }
        for (let i = debris.length - 1; i >= 0; i--) if (debris[i].y + cam > s.h + 200) debris.splice(i, 1);
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const bg = g.createLinearGradient(0, 0, 0, s.h);
        bg.addColorStop(0, hsl(hueAt(stack.length), 50, 22, 0.9));
        bg.addColorStop(1, 'rgba(29,18,56,0)');
        g.fillStyle = bg;
        g.fillRect(0, 0, s.w, s.h);
        g.save();
        g.translate(0, cam);
        stack.forEach((sl, i) => slab(g, sl.x, levelY(i) - H(), sl.w, sl.hue));
        if (flash > 0) {
          const top = stack[stack.length - 1];
          g.strokeStyle = `rgba(255,255,255,${flash})`;
          g.lineWidth = 3;
          g.strokeRect(top.x - 6 * (1 - flash), levelY(stack.length - 1) - H() - 6 * (1 - flash), top.w + 12 * (1 - flash), H() + 12 * (1 - flash));
        }
        if (!over) slab(g, cur.x, levelY(stack.length) - H(), cur.w, hueAt(stack.length));
        for (const d of debris) {
          g.save();
          g.translate(d.x + d.w / 2, d.y + H() / 2);
          g.rotate(d.rot);
          slab(g, -d.w / 2, -H() / 2, d.w, d.hue);
          g.restore();
        }
        fx.draw(g);
        g.restore();
      },
    };
  });

export default game;
