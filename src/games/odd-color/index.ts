// Find the tile with a slightly different shade. DOM grid: crisp at any size and naturally tappable.
import type { GameFactory } from '../../core/types';

const TOTAL_S = 30;
const PENALTY_S = 2;

const CSS = `
.oc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:84px 14px 20px;background:#1d1238}
.oc-bar{width:min(420px,100%);height:10px;border-radius:5px;background:#2a1b4f;overflow:hidden;margin-bottom:16px}
.oc-fill{height:100%;background:#34d399;transform-origin:left;transition:background .2s}
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
  wrap.innerHTML = `<div class="oc-bar"><div class="oc-fill"></div></div><div class="oc-grid"></div>`;
  ctx.root.append(style, wrap);
  const grid = wrap.querySelector<HTMLElement>('.oc-grid')!;
  const fill = wrap.querySelector<HTMLElement>('.oc-fill')!;

  let score = 0;
  let left = TOTAL_S;
  let running = false;
  let over = false;
  let odd = 0;
  let raf = 0;
  let last = 0;
  let paused = false;

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

  const paint = () => {
    fill.style.transform = `scaleX(${Math.max(0, left / TOTAL_S)})`;
    fill.style.background = left < 8 ? '#ff4d6d' : '#34d399';
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!running || paused) {
      last = now;
      return;
    }
    left -= Math.min(0.1, (now - last) / 1000);
    last = now;
    paint();
    if (left <= 0) {
      left = 0;
      running = false;
      over = true;
      paint();
      ctx.sfx.play('fail');
      ctx.gameOver({ score, retry: reset });
    }
  };

  function reset() {
    score = 0;
    left = TOTAL_S;
    running = false;
    over = false;
    ctx.hud.set(0);
    board();
    paint();
  }

  wrap.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-i]');
    if (!b || over) return;
    if (!running) {
      running = true;
      last = performance.now();
    }
    if (Number(b.dataset.i) === odd) {
      score++;
      ctx.hud.set(score);
      ctx.sfx.play('pop', 1 + Math.min(1, score / 30));
      ctx.haptics.tap();
      board();
    } else {
      left = Math.max(0, left - PENALTY_S);
      ctx.sfx.play('hit', 1.3, 0.6);
      ctx.haptics.buzz(40);
      wrap.classList.remove('shake');
      void wrap.offsetWidth;
      wrap.classList.add('shake');
    }
  });

  reset();
  ctx.hint('Tap the tile that looks different');
  raf = requestAnimationFrame(frame);

  return {
    pause: () => (paused = true),
    resume: () => (paused = false),
    destroy() {
      cancelAnimationFrame(raf);
      wrap.remove();
      style.remove();
    },
  };
};

export default game;
