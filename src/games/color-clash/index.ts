// Stroop test: tap the color of the ink, not the color the word names.
import { pick, shuffle } from '../../core/rand';
import { createCountdown } from '../../core/ui/countdown';
import type { GameFactory } from '../../core/types';

const TOTAL_S = 30;
const COLORS = [
  { name: 'RED', hex: '#ff4d6d' },
  { name: 'BLUE', hex: '#3b82f6' },
  { name: 'GREEN', hex: '#34d399' },
  { name: 'YELLOW', hex: '#ffe14d' },
];

const CSS = `
.cc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:18px;padding:84px 16px 24px;background:#1d1238}
.cc-ask{margin:0;color:#b7a8e0;font-weight:800}
.cc-word{flex:1;display:grid;place-items:center;font-weight:900;font-size:clamp(3rem,16vw,5.5rem);letter-spacing:-.02em;transition:transform .1s}
.cc-word.bump{transform:scale(1.08)}
.cc-btns{width:min(420px,100%);display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cc-btns button{height:76px;border:0;border-radius:20px;font-weight:900;font-size:1.05rem;color:#241544;box-shadow:0 6px 0 rgba(0,0,0,.35)}
.cc-btns button:active{transform:translateY(4px);box-shadow:0 2px 0 rgba(0,0,0,.35)}
`;

const game: GameFactory = (ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;
  const wrap = document.createElement('div');
  wrap.className = 'cc';
  wrap.innerHTML = `<p class="cc-ask">Tap the color of the ink</p><div class="cc-word"></div><div class="cc-btns"></div>`;
  const word = wrap.querySelector<HTMLElement>('.cc-word')!;
  const btns = wrap.querySelector<HTMLElement>('.cc-btns')!;
  let score = 0;
  let over = false;
  let ink = 0;
  const clock = createCountdown(TOTAL_S, () => {
    over = true;
    ctx.sfx.play('fail');
    ctx.gameOver({ score, retry: reset });
  });
  wrap.insertBefore(clock.el, wrap.firstChild);
  ctx.root.append(style, wrap);

  const round = () => {
    ink = Math.floor(Math.random() * COLORS.length);
    const others = COLORS.map((_, i) => i).filter((i) => i !== ink);
    const named = Math.random() < 0.2 ? ink : pick(others);
    word.textContent = COLORS[named].name;
    word.style.color = COLORS[ink].hex;
    btns.innerHTML = shuffle(COLORS.map((c, i) => ({ c, i })))
      .map(({ c, i }) => `<button data-i="${i}" style="background:${c.hex}">${c.name.toLowerCase()}</button>`)
      .join('');
  };

  function reset() {
    score = 0;
    over = false;
    clock.reset();
    ctx.hud.set(0);
    round();
  }

  btns.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-i]');
    if (!b || over) return;
    clock.start();
    if (Number(b.dataset.i) === ink) {
      score++;
      ctx.sfx.play('blip', 1.2 + Math.min(0.8, score / 40));
      ctx.haptics.tap();
    } else {
      score = Math.max(0, score - 1);
      ctx.sfx.play('hit', 1.3, 0.6);
      ctx.haptics.buzz(40);
    }
    ctx.hud.set(score);
    word.classList.remove('bump');
    void word.offsetWidth;
    word.classList.add('bump');
    round();
  });

  reset();
  ctx.hint('Ink color, not the word!');

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
