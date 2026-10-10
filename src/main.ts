import './app/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { createSfx } from './core/audio';
import { createHaptics } from './core/haptics';
import { Stats } from './core/stats';
import { Store } from './core/storage';
import { applySettings, loadSettings, type Deps, type Nav } from './app/deps';
import { renderHome } from './app/home';
import { renderPlayer } from './app/player';
import { parseRoute, playHref, startRouter, type Route } from './app/router';
import { pickNext } from './app/shuffle';
import { findGame, GAMES } from './games/registry';

const store = new Store();
const d: Deps = { store, stats: new Stats(store), sfx: createSfx(), haptics: createHaptics() };
applySettings(d, loadSettings(store));

// Browsers only allow audio after a user gesture; resume on every first touch or key.
const unlock = () => d.sfx.unlock();
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', unlock, { capture: true });

const ids = GAMES.map((g) => g.id);
(window as unknown as { __GAMES__: string[] }).__GAMES__ = ids;

const app = document.getElementById('app')!;
let dispose = () => {};
let prev: Route | null = null;
let cameFromHome = false;
let homeScroll = 0;

const randomGame = (current?: string) => pickNext(ids, d.stats.recent(), Math.random, current);

const nav: Nav = {
  // Going back keeps history tidy when the game was opened from the home screen.
  home: () => (cameFromHome ? history.back() : location.replace('#/')),
  shuffle: () => {
    const r = parseRoute(location.hash);
    location.replace(playHref(randomGame(r.name === 'play' ? r.id : undefined)));
  },
};

startRouter((r) => {
  if (prev?.name === 'home') homeScroll = window.scrollY;
  dispose();
  const meta = r.name === 'play' ? findGame(r.id) : undefined;
  if (meta) {
    cameFromHome = prev?.name === 'home' || (prev?.name === 'play' && cameFromHome);
    document.body.classList.add('playing');
    dispose = renderPlayer(app, meta, d, nav);
  } else {
    if (r.name === 'play') history.replaceState(null, '', '#/');
    document.body.classList.remove('playing');
    dispose = renderHome(app, d, () => (location.hash = playHref(randomGame())));
    window.scrollTo(0, homeScroll);
  }
  prev = meta ? r : { name: 'home' };
});

registerSW({ immediate: true });
