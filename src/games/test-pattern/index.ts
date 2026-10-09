// Temporary engine check used by the e2e harness until the first wave of games exists.
import { canvasGame } from '../../core/canvas-game';
import { BG, PALETTE } from '../../core/color';
import { Particles } from '../../core/fx/particles';
import { TAU } from '../../core/math';
import type { GameFactory } from '../../core/types';

const game: GameFactory = (ctx) =>
  canvasGame(ctx, () => {
    const fx = new Particles();
    let taps = 0;
    let x = -100;
    let y = -100;
    ctx.hint('Tap anywhere');
    return {
      pointer: {
        down(p) {
          taps++;
          x = p.x;
          y = p.y;
          ctx.hud.set(taps);
          ctx.sfx.play('pop');
          ctx.haptics.tap();
          fx.burst(p.x, p.y, 20, PALETTE);
        },
        move(p) {
          x = p.x;
          y = p.y;
        },
      },
      update: (dt) => fx.update(dt),
      render(g, s) {
        g.fillStyle = BG;
        g.fillRect(0, 0, s.w, s.h);
        PALETTE.forEach((c, i) => {
          g.fillStyle = c;
          g.fillRect((i * s.w) / PALETTE.length, s.h - 24, s.w / PALETTE.length + 1, 24);
        });
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(x, y, 18, 0, TAU);
        g.fill();
        fx.draw(g);
      },
    };
  });

export default game;
