// Right or wrong? Quick equations for 30 seconds; operands grow with the streak.
import { createCountdown } from '../../core/ui/countdown';
import type { GameFactory } from '../../core/types';
import { makeEquation, type Eq } from './logic';

const TOTAL_S = 30;
const PENALTY_S = 2;

const CSS = `
.ms{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:18px;padding:84px 16px 24px;background:#1d1238}
.ms-eq{flex:1;display:grid;place-items:center;color:#fff6e9;font-weight:900;font-size:clamp(2.6rem,13vw,4.6rem);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.ms-eq.right{color:#34d399}.ms-eq.wrong{color:#ff4d6d}
.ms-btns{width:min(420px,100%);display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ms-btns button{height:96px;border:0;border-radius:24px;font-weight:900;font-size:2.4rem;color:#241544;box-shadow:0 7px 0 rgba(0,0,0,.35)}
.ms-btns button:active{transform:translateY(5px);box-shadow:0 2px 0 rgba(0,0,0,.35)}
`;

const game: GameFactory = (ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;
  const wrap = document.createElement('div');
  wrap.className = 'ms';
  wrap.innerHTML = `<div class="ms-eq"></div><div class="ms-btns">
    <button data-a="0" style="background:#ff4d6d" aria-label="Wrong">✗</button>
    <button data-a="1" style="background:#34d399" aria-label="Right">✓</button></div>`;
  const eqEl = wrap.querySelector<HTMLElement>('.ms-eq')!;
  let score = 0;
  let streak = 0;
  let over = false;
  let eq: Eq = makeEquation(0);
  const clock = createCountdown(TOTAL_S, () => {
    over = true;
    ctx.sfx.play('fail');
    ctx.gameOver({ score, retry: reset });
  });
  wrap.insertBefore(clock.el, wrap.firstChild);
  ctx.root.append(style, wrap);

  const next = () => {
    eq = makeEquation(Math.floor(streak / 3));
    eqEl.textContent = eq.text;
  };

  function reset() {
    score = 0;
    streak = 0;
    over = false;
    clock.reset();
    ctx.hud.set(0);
    next();
  }

  const answer = (yes: boolean) => {
    if (over) return;
    clock.start();
    const right = yes === eq.truth;
    eqEl.classList.remove('right', 'wrong');
    void eqEl.offsetWidth;
    eqEl.classList.add(right ? 'right' : 'wrong');
    setTimeout(() => eqEl.classList.remove('right', 'wrong'), 160);
    if (right) {
      score++;
      streak++;
      ctx.sfx.play('blip', 1.1 + Math.min(1, streak / 20));
      ctx.haptics.tap();
    } else {
      streak = 0;
      clock.penalize(PENALTY_S);
      ctx.sfx.play('hit', 1.3, 0.6);
      ctx.haptics.buzz(40);
    }
    ctx.hud.set(score);
    next();
  };

  wrap.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-a]');
    if (b) answer(b.dataset.a === '1');
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') answer(false);
    if (e.key === 'ArrowRight') answer(true);
  };
  window.addEventListener('keydown', onKey);

  reset();
  ctx.hint('Is it right? Tap ✓ or ✗');

  return {
    pause: clock.pause,
    resume: clock.resume,
    destroy() {
      clock.destroy();
      window.removeEventListener('keydown', onKey);
      wrap.remove();
      style.remove();
    },
  };
};

export default game;
