import { canvasGame } from '../../core/canvas-game';
import { BG } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { angleDiff, roundRect, TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const MIN_GAP = 0.2; // radians between knives (~11°)
const WOOD = ['#c08552', '#a86b3c', '#e0a96d'];

interface Flying {
  y: number;
  bounce?: { x: number; vx: number; vy: number; rot: number };
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let rot = 0;
    let t = 0;
    let stage = 1;
    let score = 0;
    let left = 7;
    let stuck: number[] = [];
    let flying: Flying | null = null;
    let over = false;
    let bump = 0;
    let clearT = -1;
    const fx = new Particles();

    const R = () => Math.min(s.w, s.h) * 0.2;
    const cx = () => s.w / 2;
    const cy = () => s.h * 0.36;
    const throwY = () => s.h - 110;
    const knifeLen = () => R() * 0.75;
    const perStage = () => Math.min(6 + stage, 11);

    const speed = () => {
      const base = 1.6 + stage * 0.18;
      if (stage % 3 === 0) return base * Math.sin(t * 0.9) * 1.6;
      if (stage % 2 === 0) return base * (1 + 0.7 * Math.sin(t * 1.7));
      return base;
    };

    const newLog = () => {
      stuck = [];
      const pre = Math.min(3, Math.floor((stage - 1) / 2) + (stage > 1 ? 1 : 0));
      while (stuck.length < pre) {
        const a = Math.random() * TAU;
        if (stuck.every((k) => Math.abs(angleDiff(k, a)) > 0.6)) stuck.push(a);
      }
      left = perStage();
      clearT = -1;
      ctx.hud.sub(`stage ${stage}`);
    };

    const reset = () => {
      stage = 1;
      score = 0;
      over = false;
      flying = null;
      fx.clear();
      ctx.hud.set(0);
      newLog();
    };

    const fire = () => {
      if (over || flying || clearT >= 0 || left <= 0) return;
      flying = { y: throwY() };
      left--;
      ctx.sfx.play('whoosh', 1.8, 0.4);
    };

    const drawKnife = (g: CanvasRenderingContext2D, len: number) => {
      // drawn pointing up from (0,0) = tip
      g.fillStyle = '#e5e7eb';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(len * 0.09, len * 0.12);
      g.lineTo(len * 0.09, len * 0.55);
      g.lineTo(-len * 0.07, len * 0.55);
      g.lineTo(-len * 0.07, len * 0.1);
      g.closePath();
      g.fill();
      g.fillStyle = '#9ca3af';
      g.fillRect(-len * 0.12, len * 0.55, len * 0.24, len * 0.05);
      g.fillStyle = '#ff4d6d';
      g.beginPath();
      roundRect(g, -len * 0.07, len * 0.6, len * 0.14, len * 0.4, len * 0.05);
      g.fill();
    };

    reset();
    ctx.hint('Tap to throw · miss the other knives');

    return {
      pointer: { down: fire },
      key(e) {
        if (e.key === ' ' || e.key === 'ArrowUp') {
          e.preventDefault();
          fire();
        }
      },
      update(dt) {
        t += dt;
        fx.update(dt);
        bump = Math.max(0, bump - dt * 8);
        if (clearT >= 0) {
          clearT += dt;
          if (clearT > 0.9) {
            stage++;
            newLog();
          }
          return;
        }
        if (!over) rot += speed() * dt;
        if (!flying) return;
        if (flying.bounce) {
          const b = flying.bounce;
          b.vy += 1800 * dt;
          b.x += b.vx * dt;
          flying.y += b.vy * dt;
          b.rot += 12 * dt;
          return;
        }
        flying.y -= 2200 * dt;
        if (flying.y <= cy() + R()) {
          const a = Math.PI / 2 - rot;
          if (stuck.some((k) => Math.abs(angleDiff(k, a)) < MIN_GAP)) {
            over = true;
            flying.y = cy() + R();
            flying.bounce = { x: cx(), vx: (Math.random() < 0.5 ? -1 : 1) * 160, vy: -500, rot: 0 };
            ctx.sfx.play('hit', 1.5);
            ctx.haptics.buzz(70);
            setTimeout(() => ctx.gameOver({ score, retry: reset }), 900);
            return;
          }
          stuck.push(a);
          flying = null;
          score++;
          bump = 1;
          ctx.hud.set(score);
          ctx.sfx.play('thud', 1.3);
          ctx.haptics.tap();
          fx.burst(cx(), cy() + R(), 6, WOOD, { speed: 160, angle: Math.PI / 2, spread: 2, square: true, size: 4 });
          if (left === 0) {
            clearT = 0;
            ctx.sfx.play('win');
            ctx.haptics.bump();
            fx.burst(cx(), cy(), 50, WOOD, { speed: 420, size: 8, square: true, life: 1 });
          }
        }
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        const r = R();
        const len = knifeLen();
        const x = cx();
        const y = cy() - bump * 6;
        if (clearT < 0) {
          for (const k of stuck) {
            g.save();
            g.translate(x, y);
            g.rotate(k + rot - Math.PI / 2);
            g.translate(0, r - len * 0.25);
            drawKnife(g, len);
            g.restore();
          }
          g.fillStyle = '#7c4a22';
          g.beginPath();
          g.arc(x, y, r, 0, TAU);
          g.fill();
          g.fillStyle = '#c08552';
          g.beginPath();
          g.arc(x, y, r * 0.9, 0, TAU);
          g.fill();
          g.strokeStyle = 'rgba(90,50,20,0.35)';
          g.lineWidth = 2;
          for (const k of [0.65, 0.4, 0.18]) {
            g.beginPath();
            g.arc(x, y, r * k, rot, rot + TAU * 0.85);
            g.stroke();
          }
        }
        if (flying) {
          g.save();
          g.translate(flying.bounce ? flying.bounce.x : x, flying.y);
          if (flying.bounce) g.rotate(flying.bounce.rot);
          drawKnife(g, len);
          g.restore();
        } else if (!over && clearT < 0 && left > 0) {
          g.save();
          g.translate(x, throwY());
          drawKnife(g, len);
          g.restore();
        }
        for (let i = 0; i < perStage(); i++) {
          g.fillStyle = i < left ? '#fff6e9' : 'rgba(255,255,255,0.18)';
          g.fillRect(18, s.h - 30 - i * 16, 6, 12);
        }
        fx.draw(g);
      },
    };
  });

export default game;
