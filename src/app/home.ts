import { shade } from '../core/color';
import type { Category, GameMeta } from '../core/types';
import { GAMES } from '../games/registry';
import { esc, ICONS, type Deps } from './deps';
import { fmtDuration, fmtScore } from './format';
import { playHref } from './router';
import { openSettings } from './settings';

type Filter = 'all' | Category;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fidget', label: '🧸 Fidget' },
  { id: 'arcade', label: '🕹️ Arcade' },
  { id: 'brain', label: '🧠 Brain' },
];

const tileStyle = (g: GameMeta) => `--c:${g.color};--c-dark:${shade(g.color, -0.5)}`;

function tile(g: GameMeta, d: Deps): string {
  const best = d.stats.get(g.id).best;
  const sub = best !== undefined && g.scoring !== 'none' ? `Best ${fmtScore(best, g.unit)}` : g.blurb;
  return `<a class="tile" href="${playHref(g.id)}" style="${tileStyle(g)}" data-id="${esc(g.id)}">
    <span class="tile-emoji" aria-hidden="true">${g.emoji}</span>
    <span class="tile-title">${esc(g.title)}</span>
    <span class="tile-sub">${esc(sub)}</span>
  </a>`;
}

function chip(g: GameMeta): string {
  return `<a class="mini" href="${playHref(g.id)}" style="${tileStyle(g)}">
    <span aria-hidden="true">${g.emoji}</span>${esc(g.title)}</a>`;
}

function row(title: string, games: GameMeta[]): string {
  if (!games.length) return '';
  return `<section class="row"><h2>${title}</h2><div class="row-scroll">${games.map(chip).join('')}</div></section>`;
}

export function renderHome(app: HTMLElement, d: Deps, onSurprise: () => void): () => void {
  let filter = d.store.get<Filter>('ui:cat', 'all');
  const byId = (ids: string[]) => ids.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is GameMeta => !!g);
  const total = d.stats.totalMs();

  const root = document.createElement('div');
  root.className = 'home';
  root.innerHTML = `
    <header class="home-head">
      <div>
        <h1 class="logo">Bored Game</h1>
        <p class="tagline">${total > 0 ? `${fmtDuration(total)} of boredom killed so far` : 'Tap a toy, or let the big button pick one.'}</p>
      </div>
      <button class="icon-btn" data-act="settings" aria-label="Sound and vibration settings">${ICONS.gear}</button>
    </header>
    <button class="surprise" data-act="surprise"><span class="surprise-top">🎲 Surprise me</span></button>
    ${row('Favorites', byId(d.stats.favs()))}
    ${row('Played lately', byId(d.stats.recent()))}
    <nav class="filters" aria-label="Game type">
      ${FILTERS.map((f) => `<button class="filter" data-filter="${f.id}" aria-pressed="${f.id === filter}">${f.label}</button>`).join('')}
    </nav>
    <div class="grid"></div>
    <p class="foot">${GAMES.length} ${GAMES.length === 1 ? 'game' : 'games'} · works offline · no account needed</p>`;

  const grid = root.querySelector<HTMLElement>('.grid')!;
  const paint = () => {
    grid.innerHTML = GAMES.filter((g) => filter === 'all' || g.category === filter)
      .map((g) => tile(g, d))
      .join('');
    root.querySelectorAll<HTMLButtonElement>('.filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  };
  paint();

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const f = t.closest<HTMLElement>('[data-filter]');
    if (f) {
      filter = f.dataset.filter as Filter;
      d.store.set('ui:cat', filter);
      paint();
      d.sfx.play('click');
      return;
    }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'surprise') {
      d.sfx.play('blip');
      d.haptics.tap();
      onSurprise();
    } else if (act === 'settings') openSettings(d);
  });

  app.replaceChildren(root);
  return () => root.remove();
}
