import { shade } from '../core/color';
import type { GameMeta } from '../core/types';
import { esc } from '../core/ui/html';
import { GAMES } from '../games/registry';
import { ICONS, type Deps } from './deps';
import { fmtDuration, fmtScore } from './format';
import { playHref } from './router';
import { openSettings } from './settings';

const tileStyle = (g: GameMeta) => `--c:${g.color};--c-dark:${shade(g.color, -0.5)}`;

function tile(g: GameMeta, d: Deps): string {
  const best = d.stats.get(g.id).best;
  const sub = g.levels ? `Level ${d.store.scoped(g.id).get('level', 1)}` : best !== undefined ? `Best ${fmtScore(best, g.unit)}` : g.blurb;
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
  const byId = (ids: string[]) => ids.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is GameMeta => !!g);
  const total = d.stats.totalMs();

  const root = document.createElement('div');
  root.className = 'home';
  root.innerHTML = `
    <header class="home-head">
      <div>
        <h1 class="logo">Bored Game</h1>
        <p class="tagline">${total > 0 ? `${fmtDuration(total)} of boredom killed so far` : 'Tap a game, or let the big button pick one.'}</p>
      </div>
      <button class="icon-btn" data-act="settings" aria-label="Sound and vibration settings">${ICONS.gear}</button>
    </header>
    <button class="surprise" data-act="surprise"><span class="surprise-top">🎲 Surprise me</span></button>
    ${row('Favorites', byId(d.stats.favs()))}
    <div class="grid">${GAMES.map((g) => tile(g, d)).join('')}</div>
    <p class="foot">${GAMES.length} ${GAMES.length === 1 ? 'game' : 'games'} · works offline · no account needed</p>`;

  root.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'surprise') {
      d.sfx.play('blip');
      d.haptics.tap();
      onSurprise();
    } else if (act === 'settings') openSettings(d);
  });

  app.replaceChildren(root);
  return () => root.remove();
}
