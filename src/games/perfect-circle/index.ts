import { canvasGame } from '../../core/canvas-game';
import { BG, hsl } from '../../core/color';
import { text } from '../../core/draw';
import { clamp, TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';
import { circleScore, type CircleFit, type Pt } from './logic';

const MIN_R = 40;

const verdict = (v: number) =>
  v >= 97 ? 'Basically a compass' : v >= 92 ? 'Very round' : v >= 82 ? 'Pretty round' : v >= 65 ? 'Roundish' : 'That is a potato';

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let pts: Pt[] = [];
    let fit: CircleFit | null = null;
    let drawing = false;
    let done = false;

    const showBest = () => {
      const b = ctx.best();
      ctx.hud.sub(b !== undefined ? `best ${b.toFixed(1)}%` : '');
    };

    const reset = () => {
      pts = [];
      fit = null;
      drawing = false;
      done = false;
      ctx.hud.set('');
      showBest();
    };

    const finish = () => {
      drawing = false;
      const f = circleScore(pts);
      if (!f || f.r < MIN_R) {
        ctx.sfx.play('fail', 1.4, 0.5);
        ctx.hint(f ? 'Draw a bigger circle' : 'Keep going all the way around');
        reset();
        return;
      }
      fit = f;
      done = true;
      const score = Math.round(f.score * 10) / 10;
      ctx.hud.set(`${score.toFixed(1)}%`);
      ctx.sfx.play(score >= 90 ? 'score' : 'blip');
      ctx.haptics.bump();
      setTimeout(() => ctx.gameOver({ score, text: verdict(score), retry: reset }), 500);
    };

    reset();
    ctx.hint('Draw a perfect circle');

    return {
      pointer: {
        down(p) {
          if (done) return;
          pts = [{ x: p.x, y: p.y }];
          drawing = true;
          fit = null;
          ctx.sfx.play('tick', 0.8);
        },
        move(p) {
          if (!drawing) return;
          const last = pts[pts.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
          pts.push({ x: p.x, y: p.y });
          fit = circleScore(pts);
          if (fit) ctx.hud.set(`${fit.score.toFixed(1)}%`);
        },
        up() {
          if (drawing) finish();
        },
      },
      render(g) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.arc(s.w / 2, s.h / 2, 4, 0, TAU);
        g.fill();
        if (!pts.length) {
          text(g, 'Start anywhere, go all the way around', s.w / 2, s.h - 60, 15, 'rgba(255,246,233,0.45)', 'center', 700);
          return;
        }
        if (done && fit) {
          g.setLineDash([6, 8]);
          g.strokeStyle = 'rgba(255,255,255,0.35)';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(fit.cx, fit.cy, fit.r, 0, TAU);
          g.stroke();
          g.setLineDash([]);
        }
        g.lineWidth = 7;
        g.lineCap = 'round';
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          if (fit) {
            const err = Math.abs(Math.hypot(b.x - fit.cx, b.y - fit.cy) - fit.r) / fit.r;
            g.strokeStyle = hsl(140 - clamp(err * 6, 0, 1) * 140, 90, 62);
          } else g.strokeStyle = '#fff6e9';
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
        }
      },
    };
  });

export default game;
