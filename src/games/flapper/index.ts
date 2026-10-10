import { canvasGame } from '../../core/canvas-game';
import { shade } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { Shake } from '../../core/fx/shake';
import { clamp, roundRect, TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

interface Pipe {
  x: number;
  gapY: number;
  gap: number;
  scored: boolean;
}

const PIPE = '#34d399';

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let state: 'ready' | 'play' | 'dead' = 'ready';
    let y = 0;
    let vy = 0;
    let score = 0;
    let pipes: Pipe[] = [];
    let scroll = 0;
    let flapT = 0;
    let deadT = 0;
    const fx = new Particles();
    const shake = new Shake();

    const u = () => s.h / 640;
    const ground = () => s.h - 46;
    const birdX = () => Math.min(s.w * 0.3, 160);
    const R = () => 15 * Math.max(0.8, u());
    const pipeW = () => clamp(s.w * 0.16, 52, 80);
    const spacing = () => Math.max(s.w * 0.62, 230);
    const speed = () => Math.min(170 + score * 4, 270) * u();

    const reset = () => {
      state = 'ready';
      y = s.h * 0.42;
      vy = 0;
      score = 0;
      pipes = [];
      deadT = 0;
      fx.clear();
      ctx.hud.set(0);
    };

    const addPipe = (x: number) => {
      const gap = Math.max(s.h * 0.22, s.h * 0.28 - score * 2);
      const margin = 70;
      pipes.push({ x, gap, gapY: margin + gap / 2 + Math.random() * (ground() - margin * 2 - gap), scored: false });
    };

    const flap = () => {
      if (state === 'dead') return;
      if (state === 'ready') {
        state = 'play';
        addPipe(s.w + 40);
      }
      vy = -430 * u();
      flapT = 0.18;
      ctx.sfx.play('blip', 1.2 + Math.random() * 0.2, 0.7);
      ctx.haptics.tap();
    };

    const die = () => {
      if (state === 'dead') return;
      state = 'dead';
      deadT = 0;
      shake.add(0.7);
      fx.burst(birdX(), y, 26, ['#ffe14d', '#ffffff', '#ff7a45'], { speed: 280 });
      ctx.sfx.play('hit');
      ctx.haptics.buzz(60);
      setTimeout(() => ctx.gameOver({ score, retry: reset }), 650);
    };

    reset();
    ctx.hint('Tap to flap');

    return {
      pointer: { down: flap },
      key(e) {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
          e.preventDefault();
          flap();
        }
      },
      resize() {
        if (state !== 'play') y = Math.min(y, ground() - R());
      },
      update(dt, t) {
        fx.update(dt);
        shake.update(dt);
        flapT = Math.max(0, flapT - dt);
        if (state !== 'dead') scroll += speed() * dt;
        if (state === 'ready') {
          y = s.h * 0.42 + Math.sin(t * 3) * 8;
          return;
        }
        vy += 1500 * u() * dt;
        y += vy * dt;
        if (state === 'dead') {
          deadT += dt;
          y = Math.min(y, ground() - R());
          return;
        }
        const sp = speed() * dt;
        for (const p of pipes) p.x -= sp;
        if (pipes.length && pipes[0].x < -pipeW()) pipes.shift();
        const last = pipes[pipes.length - 1];
        if (!last || last.x < s.w + 40 - spacing()) addPipe((last?.x ?? s.w) + spacing());
        const bx = birdX();
        const r = R() * 0.85;
        if (y + r > ground() || y < -60) return die();
        for (const p of pipes) {
          if (!p.scored && p.x + pipeW() < bx) {
            p.scored = true;
            score++;
            ctx.hud.set(score);
            ctx.sfx.play('score');
          }
          const inX = bx + r > p.x && bx - r < p.x + pipeW();
          if (inX && (y - r < p.gapY - p.gap / 2 || y + r > p.gapY + p.gap / 2)) return die();
        }
      },
      render(g) {
        const sky = g.createLinearGradient(0, 0, 0, s.h);
        sky.addColorStop(0, '#2a1b4f');
        sky.addColorStop(1, '#7a3c8f');
        g.fillStyle = sky;
        g.fillRect(0, 0, s.w, s.h);
        g.save();
        shake.apply(g);
        // far hills
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.beginPath();
        g.moveTo(0, ground());
        for (let x = 0; x <= s.w + 20; x += 20) g.lineTo(x, ground() - 60 - Math.sin((x + scroll * 0.3) / 70) * 22);
        g.lineTo(s.w, ground());
        g.fill();
        const pw = pipeW();
        for (const p of pipes) {
          const top = p.gapY - p.gap / 2;
          const bot = p.gapY + p.gap / 2;
          g.fillStyle = PIPE;
          g.fillRect(p.x, -10, pw, top + 10);
          g.fillRect(p.x, bot, pw, ground() - bot);
          g.fillStyle = shade(PIPE, -0.3);
          g.fillRect(p.x + pw * 0.72, -10, pw * 0.28, top + 10);
          g.fillRect(p.x + pw * 0.72, bot, pw * 0.28, ground() - bot);
          g.fillStyle = shade(PIPE, 0.2);
          g.beginPath();
          roundRect(g, p.x - 5, top - 22, pw + 10, 22, 6);
          roundRect(g, p.x - 5, bot, pw + 10, 22, 6);
          g.fill();
        }
        g.fillStyle = '#ffb020';
        g.fillRect(0, ground(), s.w, s.h - ground());
        g.fillStyle = '#ff7a45';
        for (let x = -(scroll % 28); x < s.w; x += 28) g.fillRect(x, ground(), 14, 8);
        const bx = birdX();
        const r = R();
        g.save();
        g.translate(bx, y);
        g.rotate(clamp(vy / 900, -0.5, 1.3));
        g.fillStyle = '#ffe14d';
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fill();
        g.fillStyle = '#ffb020';
        g.beginPath();
        g.ellipse(-r * 0.3, r * 0.15 - (flapT > 0 ? r * 0.35 : 0), r * 0.55, r * 0.32, flapT > 0 ? -0.6 : 0.3, 0, TAU);
        g.fill();
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(r * 0.35, -r * 0.3, r * 0.33, 0, TAU);
        g.fill();
        g.fillStyle = '#1d1238';
        g.beginPath();
        g.arc(r * 0.45, -r * 0.3, r * 0.15, 0, TAU);
        g.fill();
        g.fillStyle = '#ff7a45';
        g.beginPath();
        g.moveTo(r * 0.75, 0);
        g.lineTo(r * 1.35, r * 0.15);
        g.lineTo(r * 0.75, r * 0.35);
        g.fill();
        g.restore();
        fx.draw(g);
        g.restore();
      },
    };
  });

export default game;
