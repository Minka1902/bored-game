import { canvasGame } from '../../core/canvas-game';
import { Particles } from '../../core/fx/particles';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let rot = 0;
    let score = 0;
    let state: 'ready' | 'play' | 'dead' = 'ready';
    let t = 0;
    let squash = 0;
    const fx = new Particles();

    const u = () => s.h / 720;
    const R = () => Math.max(26, Math.min(44, s.w * 0.1)) * Math.max(0.75, 1 - score * 0.006);
    const groundY = () => s.h - 40;

    const reset = () => {
      x = s.w / 2;
      y = s.h * 0.45;
      vx = 0;
      vy = 0;
      score = 0;
      state = 'ready';
      ctx.hud.set(0);
    };

    const kick = (px: number, py: number) => {
      if (state === 'dead') return;
      const r = R();
      if (Math.hypot(px - x, py - y) > r * 1.9) {
        ctx.sfx.play('tick', 0.5, 0.4);
        return;
      }
      state = 'play';
      vy = -Math.max(720, 760 + score * 6) * u();
      vx = ((x - px) / r) * 330 * u() + (Math.random() - 0.5) * 60;
      score++;
      squash = 1;
      ctx.hud.set(score);
      ctx.sfx.play('thud', 1.4 + Math.min(0.8, score * 0.02));
      ctx.haptics.tap();
      fx.burst(px, py, 8, ['#ffffff', '#ffd23f'], { speed: 180, angle: Math.PI / 2, spread: 2 });
    };

    reset();
    ctx.hint('Tap the ball to keep it up');

    return {
      pointer: { down: (p) => kick(p.x, p.y) },
      key(e) {
        if (e.key === ' ') {
          e.preventDefault();
          kick(x, y + R() * 0.6);
        }
      },
      update(dt) {
        t += dt;
        fx.update(dt);
        squash = Math.max(0, squash - dt * 6);
        if (state === 'ready') {
          y = s.h * 0.45 + Math.sin(t * 2.5) * 10;
          return;
        }
        const r = R();
        vy += (1500 + score * 15) * u() * dt;
        x += vx * dt;
        y += vy * dt;
        rot += (vx / r) * dt;
        if (x < r) (x = r), (vx = Math.abs(vx) * 0.85);
        if (x > s.w - r) (x = s.w - r), (vx = -Math.abs(vx) * 0.85);
        if (y < r + 70) (y = r + 70), (vy = Math.abs(vy) * 0.5);
        if (state === 'play' && y + r >= groundY()) {
          y = groundY() - r;
          state = 'dead';
          vy = -vy * 0.35;
          ctx.sfx.play('fail');
          ctx.haptics.buzz(60);
          setTimeout(() => ctx.gameOver({ score, retry: reset }), 700);
        }
        if (state === 'dead') {
          vx *= 0.96;
          if (y + r > groundY()) {
            y = groundY() - r;
            vy = -vy * 0.35;
          }
        }
      },
      render(g) {
        const sky = g.createLinearGradient(0, 0, 0, s.h);
        sky.addColorStop(0, '#1d1238');
        sky.addColorStop(1, '#3b2a6b');
        g.fillStyle = sky;
        g.fillRect(0, 0, s.w, s.h);
        g.fillStyle = '#34d399';
        g.fillRect(0, groundY(), s.w, s.h - groundY());
        g.fillStyle = '#10b981';
        for (let i = 0; i < s.w; i += 12) g.fillRect(i, groundY(), 6, 6);
        const r = R();
        const sh = Math.max(0.3, 1 - (groundY() - y) / s.h);
        g.fillStyle = `rgba(0,0,0,${0.25 * sh})`;
        g.beginPath();
        g.ellipse(x, groundY() + 6, r * sh, r * 0.2 * sh, 0, 0, TAU);
        g.fill();
        g.save();
        g.translate(x, y);
        g.scale(1 + squash * 0.12, 1 - squash * 0.12);
        g.rotate(rot);
        g.fillStyle = '#fff6e9';
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fill();
        g.fillStyle = '#241544';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          g.beginPath();
          g.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.2, 0, TAU);
          g.fill();
        }
        g.beginPath();
        g.arc(0, 0, r * 0.24, 0, TAU);
        g.fill();
        g.restore();
        fx.draw(g);
      },
    };
  });

export default game;
