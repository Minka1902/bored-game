import type { Hud } from '../types';

const el = (tag: string, cls: string, text = ''): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Big score readout at the top of the stage; pointer-transparent. */
export function createHud(root: HTMLElement): Hud {
  let box: HTMLElement | null = null;
  let main: HTMLElement;
  let subEl: HTMLElement;
  const ensure = () => {
    if (box) return;
    box = el('div', 'hud');
    main = el('div', 'hud-main');
    subEl = el('div', 'hud-sub');
    box.append(main, subEl);
    root.appendChild(box);
  };
  return {
    set(text) {
      ensure();
      main.textContent = String(text);
    },
    sub(text) {
      ensure();
      subEl.textContent = text;
    },
    clear() {
      box?.remove();
      box = null;
    },
  };
}

export interface GameOverOpts {
  title: string;
  score: string;
  best: string;
  isNew: boolean;
  onRetry(): void;
  onNext(): void;
}

/** Shared game-over card. Ignores input briefly so the tap that ended the run doesn't instantly retry. */
export function showGameOver(root: HTMLElement, o: GameOverOpts): () => void {
  const wrap = el('div', 'gameover');
  const card = el('div', 'go-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', `${o.title}: ${o.score}`);
  const title = el('div', 'go-title', o.title);
  const score = el('div', 'go-score', o.score);
  const best = el('div', 'go-best', o.isNew ? '★ New best!' : `Best ${o.best}`);
  if (o.isNew) best.classList.add('is-new');
  const row = el('div', 'go-row');
  const retry = el('button', 'btn btn-primary', '↻ Again') as HTMLButtonElement;
  const next = el('button', 'btn', '⏭ Next game') as HTMLButtonElement;
  retry.dataset.act = 'retry';
  next.dataset.act = 'next';
  row.append(retry, next);
  card.append(title, score, best, row);
  wrap.appendChild(card);
  root.appendChild(wrap);

  let armed = false;
  const armTimer = setTimeout(() => {
    armed = true;
    wrap.classList.add('armed');
    retry.focus({ preventScroll: true });
  }, 450);
  const done = (fn: () => void) => () => {
    if (!armed) return;
    dispose();
    fn();
  };
  retry.addEventListener('click', done(o.onRetry));
  next.addEventListener('click', done(o.onNext));
  // Enter/Space mean "again" only when nothing has focus; a focused button keeps its own meaning
  const onKey = (e: KeyboardEvent) => {
    const a = document.activeElement;
    if (a && a !== document.body) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      done(o.onRetry)();
    }
  };
  window.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => wrap.classList.add('in'));

  function dispose() {
    clearTimeout(armTimer);
    window.removeEventListener('keydown', onKey, true);
    wrap.remove();
  }
  return dispose;
}

/** One-line hint that fades out on the first touch inside root. */
export function showHint(root: HTMLElement, text: string): () => void {
  const h = el('div', 'hint', text);
  root.appendChild(h);
  const hide = () => {
    h.classList.add('out');
    setTimeout(() => h.remove(), 400);
    root.removeEventListener('pointerdown', hide);
    window.removeEventListener('keydown', hide);
  };
  root.addEventListener('pointerdown', hide);
  window.addEventListener('keydown', hide);
  return () => {
    root.removeEventListener('pointerdown', hide);
    window.removeEventListener('keydown', hide);
    h.remove();
  };
}
