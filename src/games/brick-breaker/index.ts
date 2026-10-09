import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE, shade } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { Shake } from '../../core/fx/shake';
import { clamp, roundRect, TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  color: string;
}

const ROWS = 6;
const COLS = 7;
const TOP = 96;

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let bricks: Brick[] = [];
    let paddleX = 0;
    let ball = { x: 0, y: 0, vx: 0, vy: 0, stuck: true };
    let level = 1;
    let lives = 3;
    let score = 0;
    let over = false;
    let speedK = 1;
    const keys = new Set<string>();
    const fx = new Particles();
    const shake = new Shake();

    const pw = () => Math.max(70, s.w * 0.24);
    const py = () => s.h - 64;
    const br = () => Math.max(7, s.w * 0.018);
    const baseSpeed = () => Math.min(s.w, 520) * 1.05 * (1 + (level - 1) * 0.08);

    const buildLevel = () => {
      bricks = [];
      const gap = 5;
      const bw = (s.w - 20 - gap * (COLS - 1)) / COLS;
      const bh = Math.max(16, Math.min(24, s.h / 32));
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const tough = level > 1 && (r + c + level) % 4 === 0;
          bricks.push({ x: 10 + c * (bw + gap), y: TOP + r * (bh + gap), w: bw, h: bh, hp: tough ? 2 : 1, color: PALETTE[(r * 2) % PALETTE.length] });
        }
      ball.stuck = true;
      speedK = 1;
    };

    const reset = () => {
      level = 1;
      lives = 3;
      score = 0;
      over = false;
      paddleX = s.w / 2;
      buildLevel();
      ctx.hud.set(0);
      ctx.hud.sub('♥♥♥');
    };

    const launch = () => {
      if (!ball.stuck || over) return;
      ball.stuck = false;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      ball.vx = Math.cos(a) * baseSpeed();
      ball.vy = Math.sin(a) * baseSpeed();
      ctx.sfx.play('blip');
    };

    const lose = () => {
      lives--;
      shake.add(0.6);
      ctx.haptics.buzz(50);
      ctx.hud.sub('♥'.repeat(Math.max(0, lives)));
      if (lives <= 0) {
        over = true;
        ctx.sfx.play('fail');
        setTimeout(() => ctx.gameOver({ score, retry: reset }), 600);
      } else {
        ctx.sfx.play('hit', 0.7);
        ball.stuck = true;
        speedK = 1;
      }
    };

    const step = (dt: number) => {
      const r = br();
      ball.x += ball.vx * speedK * dt;
      ball.y += ball.vy * speedK * dt;
      if (ball.x < r) (ball.x = r), (ball.vx = Math.abs(ball.vx));
      if (ball.x > s.w - r) (ball.x = s.w - r), (ball.vx = -Math.abs(ball.vx));
      if (ball.y < 70 + r) (ball.y = 70 + r), (ball.vy = Math.abs(ball.vy));
      if (ball.y > s.h + 20) return lose();
      const w = pw();
      if (ball.vy > 0 && ball.y + r >= py() && ball.y + r <= py() + 18 && Math.abs(ball.x - paddleX) <= w / 2 + r) {
        const off = clamp((ball.x - paddleX) / (w / 2), -1, 1);
        const a = -Math.PI / 2 + off * 1.05;
        const sp = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.cos(a) * sp;
        ball.vy = Math.sin(a) * sp;
        ball.y = py() - r;
        ctx.sfx.play('click', 0.8);
        ctx.haptics.tap();
      }
      for (const b of bricks) {
        if (b.hp <= 0) continue;
        const nx = clamp(ball.x, b.x, b.x + b.w);
        const ny = clamp(ball.y, b.y, b.y + b.h);
        if ((ball.x - nx) ** 2 + (ball.y - ny) ** 2 > r * r) continue;
        const overlapX = Math.min(ball.x + r - b.x, b.x + b.w - (ball.x - r));
        const overlapY = Math.min(ball.y + r - b.y, b.y + b.h - (ball.y - r));
        if (overlapX < overlapY) ball.vx = ball.x < b.x + b.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        else ball.vy = ball.y < b.y + b.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
        b.hp--;
        if (b.hp <= 0) {
          score += 10 * level;
          ctx.hud.set(score);
          fx.burst(b.x + b.w / 2, b.y + b.h / 2, 12, [b.color, '#ffffff'], { speed: 200, square: true, size: 5 });
          ctx.sfx.play('pop', 1 + Math.random() * 0.4);
          speedK = Math.min(1.6, speedK + 0.012);
        } else ctx.sfx.play('tick', 0.8);
        ctx.haptics.tap();
        break;
      }
      if (bricks.every((b) => b.hp <= 0)) {
        level++;
        ctx.sfx.play('win');
        buildLevel();
      }
    };

    reset();
    ctx.hint('Drag to move · tap to launch');

    return {
      pointer: {
        down(p) {
          paddleX = p.x;
          launch();
        },
        move(p) {
          paddleX = p.x;
        },
        hover(x) {
          paddleX = x;
        },
      },
      key(e) {
        if (e.key === ' ') {
          e.preventDefault();
          launch();
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') keys.add(e.key);
      },
      keyUp(e) {
        keys.delete(e.key);
      },
      resize() {
        if (!bricks.some((b) => b.hp > 0) || bricks[0].w * COLS > s.w) buildLevel();
        paddleX = clamp(paddleX, 0, s.w);
      },
      update(dt) {
        fx.update(dt);
        shake.update(dt);
        if (keys.has('ArrowLeft')) paddleX -= 520 * dt;
        if (keys.has('ArrowRight')) paddleX += 520 * dt;
        paddleX = clamp(paddleX, pw() / 2, s.w - pw() / 2);
        if (over) return;
        if (ball.stuck) {
          ball.x = paddleX;
          ball.y = py() - br() - 1;
          return;
        }
        for (let i = 0; i < 4; i++) step(dt / 4);
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        g.save();
        shake.apply(g);
        for (const b of bricks) {
          if (b.hp <= 0) continue;
          g.fillStyle = b.hp > 1 ? shade(b.color, -0.35) : b.color;
          g.beginPath();
          roundRect(g, b.x, b.y, b.w, b.h, 5);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.3)';
          g.fillRect(b.x + 4, b.y + 3, b.w - 8, 3);
        }
        g.fillStyle = '#fff6e9';
        g.beginPath();
        roundRect(g, paddleX - pw() / 2, py(), pw(), 14, 7);
        g.fill();
        if (!over) {
          g.fillStyle = '#ffd23f';
          g.beginPath();
          g.arc(ball.x, ball.y, br(), 0, TAU);
          g.fill();
        }
        fx.draw(g);
        g.restore();
      },
    };
  });

export default game;
