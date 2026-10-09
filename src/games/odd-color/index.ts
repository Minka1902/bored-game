// Find the tile with a slightly different shade. DOM grid: crisp at any size and naturally tappable.
import { createCountdown } from '../../core/ui/countdown';
import type { GameFactory } from '../../core/types';

const TOTAL_S = 30;
const PENALTY_S = 2;

const CSS = `
.oc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:16px;padding:84px 14px 20px;background:#1d1238}
.oc-grid{display:grid;gap:6px;width:min(420px,100%,calc(100dvh - 200px));aspect-ratio:1}
.oc-grid button{border:0;border-radius:18%;padding:0;transition:transform .08s}
.oc-grid button:active{transform:scale(.93)}
.oc.shake .oc-grid{animation:oc-shake .3s}
@keyframes oc-shake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
`;

const game: GameFactory = (ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;
  const wrap = document.createElement('div');
  wrap.className = 'oc';
  const grid = document.createElement('div');
  grid.className = 'oc-grid';
  let score = 0;
  let over = false;
  let odd = 0;
  const clock = createCountdown(TOTAL_S, () => {
    over = true;
    ctx.sfx.play('fail');
    ctx.gameOver({ score, retry: reset });
  });
  wrap.append(clock.el, grid);
  ctx.root.append(style, wrap);

  const board = () => {
    const n = Math.min(8, 2 + Math.floor(score / 2));
    const h = Math.floor(Math.random() * 360);
    const s = 65 + Math.random() * 20;
    const l = 45 + Math.random() * 15;
    const delta = Math.max(3, 20 - score * 0.7) * (Math.random() < 0.5 ? 1 : -1);
    odd = Math.floor(Math.random() * n * n);
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    grid.innerHTML = Array.from({ length: n * n }, (_, i) =>
      `<button data-i="${i}" aria-label="Tile" style="background:hsl(${h} ${s}% ${i === odd ? l + delta : l}%)"></button>`,
    ).join('');
  };

  function reset() {
    score = 0;
    over = false;
    clock.reset();
    ctx.hud.set(0);
    board();
  }

  wrap.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-i]');
    if (!b || over) return;
    clock.start();
    if (Number(b.dataset.i) === odd) {
      score++;
      ctx.hud.set(score);
      ctx.sfx.play('pop', 1 + Math.min(1, score / 30));
      ctx.haptics.tap();
      board();
    } else {
      clock.penalize(PENALTY_S);
      ctx.sfx.play('hit', 1.3, 0.6);
      ctx.haptics.buzz(40);
      wrap.classList.remove('shake');
      void wrap.offsetWidth;
      wrap.classList.add('shake');
    }
  });

  reset();
  ctx.hint('Tap the tile that looks different');

  return {
    pause: clock.pause,
    resume: clock.resume,
    destroy() {
      clock.destroy();
      wrap.remove();
      style.remove();
    },
  };
};

export default game;
