import { canvasGame } from '../../core/canvas-game';
import { Particles } from '../../core/fx/particles';
import { roundRect, TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

interface Ob {
  x: number;
  w: number;
  h: number;
  /** height of the bottom edge above the ground (birds fly) */
  lift: number;
  bird: boolean;
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let y = 0;
    let vy = 0;
    let holding = false;
    let holdT = 0;
    let speed = 0;
    let dist = 0;
    let next = 0;
    let state: 'ready' | 'run' | 'dead' = 'ready';
    let obs: Ob[] = [];
    let t = 0;
    const fx = new Particles();

    const u = () => Math.min(s.h / 700, s.w / 390) * 1.05;
    const groundY = () => s.h * 0.7;
    const px = () => Math.min(s.w * 0.2, 120);
    const size = () => 34 * u();
    const onGround = () => y >= 0;

    const reset = () => {
      y = 0;
      vy = 0;
      speed = 330 * u();
      dist = 0;
      obs = [];
      next = s.w * 0.8;
      state = 'ready';
      fx.clear();
      ctx.hud.set(0);
    };

    const jump = () => {
      if (state === 'dead') return;
      if (state === 'ready') state = 'run';
      holding = true;
      if (!onGround()) return;
      vy = -820 * u();
      holdT = 0;
      ctx.sfx.play('blip', 1.4, 0.6);
      ctx.haptics.tap();
    };

    const spawn = () => {
      const k = u();
      const bird = dist > 1500 && Math.random() < 0.28;
      if (bird) {
        const high = Math.random() < 0.5;
        obs.push({ x: s.w + 20, w: 40 * k, h: 22 * k, lift: high ? 70 * k : 18 * k, bird });
      } else {
        const n = 1 + (Math.random() < 0.35 ? 1 : 0) + (dist > 2500 && Math.random() < 0.2 ? 1 : 0);
        const w = (16 + Math.random() * 10) * k;
        obs.push({ x: s.w + 20, w: w * n + (n - 1) * 4, h: (30 + Math.random() * 28) * k, lift: 0, bird });
      }
      next = speed * (0.75 + Math.random() * 0.75);
    };

    const die = () => {
      state = 'dead';
      ctx.sfx.play('hit');
      ctx.haptics.buzz(60);
      fx.burst(px(), groundY() + y - size() / 2, 20, ['#a855f7', '#e879f9', '#fff6e9'], { speed: 260 });
      const score = Math.floor(dist / 10);
      setTimeout(() => ctx.gameOver({ score, retry: reset }), 650);
    };

    reset();
    ctx.hint('Tap to jump · hold to jump higher');

    return {
      pointer: { down: jump, up: () => (holding = false) },
      key(e) {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
          e.preventDefault();
          jump();
        }
      },
      keyUp(e) {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') holding = false;
      },
      update(dt) {
        t += dt;
        fx.update(dt);
        if (state !== 'run') return;
        const g = 2800 * u() * (holding && vy < 0 && holdT < 0.22 ? 0.45 : 1);
        holdT += dt;
        vy += g * dt;
        y += vy * dt;
        if (y > 0) {
          if (vy > 300 * u()) ctx.sfx.play('tick', 0.6, 0.5);
          y = 0;
          vy = 0;
        }
        speed = Math.min(780 * u(), speed + 9 * u() * dt);
        const d = speed * dt;
        dist += d / u();
        ctx.hud.set(Math.floor(dist / 10));
        next -= d;
        if (next <= 0) spawn();
        for (const o of obs) o.x -= d;
        while (obs.length && obs[0].x + obs[0].w < -20) obs.shift();
        const S = size();
        const pl = px() - S * 0.35;
        const pr = px() + S * 0.35;
        const pb = groundY() + y - 3;
        const pt = pb - S * 0.85;
        for (const o of obs) {
          const ob = groundY() - o.lift;
          const ot = ob - o.h;
          if (pr > o.x + 3 && pl < o.x + o.w - 3 && pb > ot + 3 && pt < ob) return die();
        }
      },
      render(g) {
        const sky = g.createLinearGradient(0, 0, 0, s.h);
        sky.addColorStop(0, '#2a1b4f');
        sky.addColorStop(1, '#ff7a45');
        g.fillStyle = sky;
        g.fillRect(0, 0, s.w, s.h);
        g.fillStyle = 'rgba(255,214,165,0.9)';
        g.beginPath();
        g.arc(s.w * 0.75, groundY() - s.h * 0.25, 40 * u(), 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(29,18,56,0.35)';
        for (let i = 0; i < 4; i++) {
          const x = ((i * 260 - dist * 0.25) % (s.w + 300) + s.w + 300) % (s.w + 300) - 150;
          g.beginPath();
          g.ellipse(x, groundY() - 10, 120, 60, 0, Math.PI, 0);
          g.fill();
        }
        g.fillStyle = '#1d1238';
        g.fillRect(0, groundY(), s.w, s.h - groundY());
        g.fillStyle = '#3a2868';
        for (let x = -((dist * u()) % 40); x < s.w; x += 40) g.fillRect(x, groundY() + 10, 18, 4);
        for (const o of obs) {
          const ob = groundY() - o.lift;
          if (o.bird) {
            g.fillStyle = '#ffe14d';
            g.beginPath();
            g.ellipse(o.x + o.w / 2, ob - o.h / 2, o.w / 2, o.h / 2, 0, 0, TAU);
            g.fill();
            g.fillStyle = '#ffb020';
            const flap = Math.sin(t * 18) * o.h * 0.6;
            g.beginPath();
            g.moveTo(o.x + o.w * 0.3, ob - o.h / 2);
            g.lineTo(o.x + o.w * 0.55, ob - o.h / 2 - flap);
            g.lineTo(o.x + o.w * 0.75, ob - o.h / 2);
            g.fill();
          } else {
            g.fillStyle = '#34d399';
            g.beginPath();
            roundRect(g, o.x, ob - o.h, o.w, o.h + 2, Math.min(8, o.w / 3));
            g.fill();
            g.fillStyle = '#10b981';
            g.fillRect(o.x + o.w * 0.6, ob - o.h + 6, o.w * 0.15, o.h - 6);
          }
        }
        const S = size();
        const squash = state === 'run' && onGround() ? 1 + Math.sin(t * 22) * 0.06 : vy < 0 ? 0.9 : 1.05;
        g.save();
        g.translate(px(), groundY() + y);
        g.scale(1 / squash, squash);
        g.fillStyle = state === 'dead' ? '#9ca3af' : '#e879f9';
        g.beginPath();
        roundRect(g, -S / 2, -S, S, S, S * 0.35);
        g.fill();
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(S * 0.15, -S * 0.65, S * 0.14, 0, TAU);
        g.fill();
        g.fillStyle = '#1d1238';
        g.beginPath();
        g.arc(S * 0.2, -S * 0.65, S * 0.07, 0, TAU);
        g.fill();
        g.restore();
        fx.draw(g);
      },
    };
  });

export default game;
