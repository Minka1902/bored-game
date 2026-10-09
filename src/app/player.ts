import { shade } from '../core/color';
import { createHud, showGameOver, showHint } from '../core/ui/overlay';
import type { GameContext, GameInstance, GameMeta } from '../core/types';
import { esc, ICONS, type Deps, type Nav } from './deps';
import { fmtScore } from './format';
import { openSettings } from './settings';

const MIN_PLAY_MS = 800;

/** Mounts one game with its top bar and owns its whole lifecycle. Returns a disposer. */
export function renderPlayer(app: HTMLElement, meta: GameMeta, d: Deps, nav: Nav): () => void {
  const root = document.createElement('div');
  root.className = 'player';
  root.style.cssText = `--c:${meta.color};--c-dark:${shade(meta.color, -0.5)}`;
  root.innerHTML = `
    <header class="bar">
      <button class="icon-btn" data-act="home" aria-label="Back to all games">${ICONS.back}</button>
      <div class="bar-title"><span aria-hidden="true">${meta.emoji}</span>${esc(meta.title)}</div>
      <button class="icon-btn fav" data-act="fav" aria-label="Favorite" aria-pressed="${d.stats.favs().includes(meta.id)}">${ICONS.star}</button>
      <button class="icon-btn" data-act="settings" aria-label="Sound and vibration settings">${ICONS.gear}</button>
      <button class="shuffle-btn" data-act="shuffle" aria-label="Random game">${ICONS.shuffle}<span>Next</span></button>
    </header>
    <main id="stage" class="stage"></main>`;
  app.replaceChildren(root);
  const stage = root.querySelector<HTMLElement>('#stage')!;

  let game: GameInstance | null = null;
  let disposed = false;
  let closeOverlay: (() => void) | null = null;
  let closeHint: (() => void) | null = null;
  const pausedBy = new Set<string>();
  let activeMs = 0;
  let since = performance.now();

  const setPaused = (why: string, on: boolean) => {
    const was = pausedBy.size > 0;
    if (on) pausedBy.add(why);
    else pausedBy.delete(why);
    const now = pausedBy.size > 0;
    if (was === now) return;
    const t = performance.now();
    if (now) {
      activeMs += t - since;
      game?.pause();
    } else {
      since = t;
      game?.resume();
    }
  };

  const hud = createHud(stage);
  const ctx: GameContext = {
    root: stage,
    meta,
    sfx: d.sfx,
    haptics: d.haptics,
    store: d.store.scoped(meta.id),
    hud,
    submitScore: (v) => d.stats.submit(meta.id, v, meta.scoring),
    best: () => d.stats.get(meta.id).best,
    gameOver({ score, text, retry }) {
      const r = d.stats.submit(meta.id, score, meta.scoring);
      closeOverlay?.();
      const isNew = r.isNew && meta.scoring !== 'none';
      if (isNew) setTimeout(() => !disposed && d.sfx.play('win'), 250);
      closeOverlay = showGameOver(stage, {
        title: text ?? 'Game over',
        score: fmtScore(score, meta.unit),
        best: fmtScore(r.best, meta.unit),
        isNew,
        onRetry: () => {
          closeOverlay = null;
          retry();
        },
        onNext: () => nav.shuffle(),
      });
    },
    hint(text) {
      closeHint?.();
      closeHint = showHint(stage, text);
    },
  };

  const notice = (msg: string, action: string, onAct: () => void) => {
    const n = document.createElement('div');
    n.className = 'notice';
    n.innerHTML = `<p>${esc(msg)}</p><button class="btn btn-primary">${esc(action)}</button>`;
    n.querySelector('button')!.addEventListener('click', () => {
      n.remove();
      onAct();
    });
    stage.appendChild(n);
  };

  const start = () => {
    const spin = setTimeout(() => stage.classList.add('loading'), 150);
    meta
      .load()
      .then((mod) => {
        clearTimeout(spin);
        stage.classList.remove('loading');
        if (disposed) return;
        try {
          game = mod.default(ctx);
          if (pausedBy.size) game.pause();
          stage.dataset.ready = '1';
        } catch (err) {
          console.warn(`[${meta.id}] crashed on start`, err);
          notice('This game crashed while starting. Try another one.', 'Play something else', () => nav.shuffle());
        }
      })
      .catch(() => {
        clearTimeout(spin);
        stage.classList.remove('loading');
        if (!disposed) notice("Couldn't load this game. Check your connection, then try again.", 'Try again', start);
      });
  };

  const onVisibility = () => setPaused('hidden', document.hidden);
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') nav.home();
    else if (e.key === 'n' || e.key === 'N') nav.shuffle();
  };
  root.querySelector('.bar')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'home') nav.home();
    else if (act === 'shuffle') {
      d.sfx.play('whoosh');
      nav.shuffle();
    } else if (act === 'fav') {
      const on = d.stats.toggleFav(meta.id);
      root.querySelector('.fav')!.setAttribute('aria-pressed', String(on));
      d.sfx.play(on ? 'score' : 'click');
      d.haptics.tap();
    } else if (act === 'settings') {
      setPaused('settings', true);
      void openSettings(d).then(() => setPaused('settings', false));
    }
  });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('keydown', onKey);
  d.stats.pushRecent(meta.id);
  if (document.hidden) pausedBy.add('hidden');
  start();

  return () => {
    disposed = true;
    if (!pausedBy.size) activeMs += performance.now() - since;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('keydown', onKey);
    closeOverlay?.();
    closeHint?.();
    try {
      game?.destroy();
    } catch (err) {
      console.warn(`[${meta.id}] failed to clean up`, err);
    }
    if (activeMs >= MIN_PLAY_MS) d.stats.played(meta.id, activeMs);
    root.remove();
  };
}
