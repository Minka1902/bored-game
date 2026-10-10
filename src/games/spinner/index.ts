import { canvasGame } from '../../core/canvas-game';
import { singlePointer } from '../../core/input';
import { BG, PALETTE, shade } from '../../core/color';
import { angleDiff, TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const MAX_W = 80; // rad/s, about 760 rpm
const LOBE = TAU / 3;

const rpm = (w: number) => Math.round((Math.abs(w) * 60) / TAU);

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let theta = 0;
    let w = 0;
    let held = false;
    let grabAngle = 0;
    let lastMove = 0;
    let peak = 0;
    let lastLobe = 0;
    let tickBudget = 0;
    let colorIx = ctx.store.get('color', 7);
    let moved = false;
    const trail: number[] = [];

    const center = () => ({ x: s.w / 2, y: s.h / 2 + 20 });
    const size = () => Math.min(s.w, s.h) * 0.3;
    const angleOf = (x: number, y: number) => {
      const c = center();
      return Math.atan2(y - c.y, x - c.x);
    };

    const showBest = () => {
      const best = ctx.best();
      ctx.hud.sub(best ? `best ${best} rpm` : 'rpm');
    };

    const drawSpinner = (g: CanvasRenderingContext2D, x: number, y: number, R: number, a: number, alpha: number) => {
      const color = PALETTE[colorIx % PALETTE.length];
      g.save();
      g.globalAlpha = alpha;
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = shade(color, -0.35);
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const la = i * LOBE - Math.PI / 2;
        g.moveTo(Math.cos(la) * R * 0.62 + R * 0.4, Math.sin(la) * R * 0.62);
        g.arc(Math.cos(la) * R * 0.62, Math.sin(la) * R * 0.62, R * 0.4, 0, TAU);
      }
      g.moveTo(R * 0.45, 0);
      g.arc(0, 0, R * 0.45, 0, TAU);
      g.fill();
      g.fillStyle = color;
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const la = i * LOBE - Math.PI / 2;
        g.moveTo(Math.cos(la) * R * 0.62 + R * 0.36, Math.sin(la) * R * 0.62);
        g.arc(Math.cos(la) * R * 0.62, Math.sin(la) * R * 0.62, R * 0.36, 0, TAU);
      }
      g.moveTo(R * 0.42, 0);
      g.arc(0, 0, R * 0.42, 0, TAU);
      g.fill();
      for (let i = 0; i < 3; i++) {
        const la = i * LOBE - Math.PI / 2;
        const bx = Math.cos(la) * R * 0.62;
        const by = Math.sin(la) * R * 0.62;
        const grad = g.createRadialGradient(bx - R * 0.06, by - R * 0.08, 1, bx, by, R * 0.22);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#c9c4d9');
        grad.addColorStop(1, '#6d6787');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(bx, by, R * 0.22, 0, TAU);
        g.fill();
      }
      g.restore();
    };

    const drawCap = (g: CanvasRenderingContext2D, x: number, y: number, R: number) => {
      const grad = g.createRadialGradient(x - R * 0.08, y - R * 0.1, 1, x, y, R * 0.24);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.6, '#d9d4ea');
      grad.addColorStop(1, '#8a83a8');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, R * 0.24, 0, TAU);
      g.fill();
    };

    showBest();
    ctx.hud.set(0);
    ctx.hint('Flick it to spin');

    return {
      pointer: singlePointer({
        down(p) {
          held = true;
          moved = false;
          grabAngle = angleOf(p.x, p.y);
          lastMove = p.t;
          w *= 0.6;
        },
        move(p) {
          if (!held) return;
          const a = angleOf(p.x, p.y);
          const d = angleDiff(grabAngle, a);
          const c = center();
          // ignore jitter right at the hub where angles are unstable
          if (Math.hypot(p.x - c.x, p.y - c.y) < 12) return;
          const dt = Math.max(1, p.t - lastMove) / 1000;
          theta += d;
          const instant = Math.max(-MAX_W, Math.min(MAX_W, (d / dt) * 1.15));
          w = w * 0.4 + instant * 0.6;
          grabAngle = a;
          lastMove = p.t;
          if (Math.abs(d) > 0.02) moved = true;
        },
        up(p) {
          held = false;
          if (p.t - lastMove > 120) w *= 0.3;
          if (!moved && Math.hypot(p.x - p.sx, p.y - p.sy) < 6) {
            colorIx = (colorIx + 1) % PALETTE.length;
            ctx.store.set('color', colorIx);
            ctx.sfx.play('click');
          }
        },
      }),
      update(dt) {
        if (!held) {
          theta += w * dt;
          w *= Math.exp(-0.32 * dt);
          const decel = 0.35 * dt;
          w = Math.abs(w) <= decel ? 0 : w - Math.sign(w) * decel;
        }
        const r = rpm(w);
        if (!held) peak = Math.max(peak, r);
        if (!held && w === 0 && peak > 0) {
          const res = ctx.submitScore(peak);
          if (res.isNew) ctx.sfx.play('win');
          peak = 0;
          showBest();
        }
        ctx.hud.set(r);
        const lobe = Math.floor(theta / LOBE);
        tickBudget = Math.min(2, tickBudget + dt * 22);
        if (lobe !== lastLobe) {
          lastLobe = lobe;
          if (tickBudget >= 1) {
            tickBudget -= 1;
            ctx.sfx.play('tick', 0.6 + Math.min(1.2, Math.abs(w) / 40), 0.7);
            if (Math.abs(w) < 18) ctx.haptics.tap();
          }
        }
        trail.unshift(theta);
        trail.length = Math.min(trail.length, 5);
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const c = center();
        const R = size();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.ellipse(c.x, c.y + R * 1.05, R * 0.9, R * 0.12, 0, 0, TAU);
        g.fill();
        const blur = Math.min(1, Math.abs(w) / 30);
        if (blur > 0.15) for (let i = trail.length - 1; i > 0; i--) drawSpinner(g, c.x, c.y, R, trail[i], 0.18 * blur);
        drawSpinner(g, c.x, c.y, R, theta, 1);
        drawCap(g, c.x, c.y, R);
      },
    };
  });

export default game;
