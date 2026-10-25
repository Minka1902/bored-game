# Bored Game

A pocket arcade for the few minutes you need to kill: 27 arcade mini games and quick brain challenges. Open it, tap a tile (or **Surprise me**), and you're playing in under a second. You can switch to a random game at any time with **Next**.

- **No account.** Scores, favorites and "time killed" are stored on the device.
- **Tiny.** 13.1 KB gzipped to start, about 1–6 KB per game, 122 KB for everything, icons included.
- **Works offline.** It's an installable PWA. Each game downloads the first time you open it and is cached for offline play after that.
- **Picks up where you left off.** Ball Sort, Ant Feast, Bus Loop and Zombie Siege remember your level; the three puzzles also bring back the exact puzzle you were on.
- **No assets.** Every graphic is drawn in code and every sound is synthesized with WebAudio.

## The games

| Arcade (score and fail) | Brain (quick challenges) |
|---|---|
| Flapper · Stacker · Knife Throw · Chop · Hop Run · Brick Breaker · Snake · Dodge · Tile Tap · Slice · Merge Drop · Block Fit · Keepy Up · Icy Tower · Zombie Siege · Peg Drop | 2048 · Perfect Circle · Ten Seconds · Reaction · Odd Color · Color Clash · Math Sprint · Echo · Ball Sort · Ant Feast · Bus Loop |

The design spec explains why the first 36 were picked and which candidates were rejected: [docs/superpowers/specs/2026-10-09-bored-game-design.md](docs/superpowers/specs/2026-10-09-bored-game-design.md).

## Run it

```bash
npm install
npm run dev            # http://localhost:5173 — add `-- --host` to open it on a phone on the same Wi-Fi
npm run build          # type-check + production build into dist/
npm run preview        # serve dist/ (service worker active)
```

## Check it

```bash
npm test               # Vitest: engine, storage, stats, router and every game's rules
npm run size           # fails if initial > 35 KB, any game > 12 KB, or total > 400 KB (gzipped)
npx playwright install chromium   # once
npm run e2e            # every game boots, takes input, survives a resize, returns home;
                       # 40× shuffle storm; works offline (Pixel 7 + iPhone 15 viewports)
```

Before running `npm run e2e`, stop any server you started on port 4173. Otherwise Playwright reuses it and tests whatever `dist/` it is serving.

## Deploy

`npm run build` and upload `dist/` to any static host, such as Cloudflare Pages, Netlify, GitHub Pages or Vercel. There is no backend.

## How it's built

```
src/main.ts              boot: settings, router, service worker
src/app/                 shell: home grid, player (top bar + game lifecycle), settings sheet, shuffle
src/core/                micro-engine shared by every game
  canvas-game.ts           stage + frame loop + pointers + keys + cleanup, in one call
  stage.ts loop.ts input.ts  DPR-aware canvas, dt-clamped rAF loop, multi-touch tracking
  audio.ts haptics.ts      synthesized sound presets; Android vibration (iOS: best effort)
  storage.ts stats.ts      namespaced localStorage with in-memory fallback; best/plays/time/favorites
  physics/circles.ts       small circle physics (Merge Drop, Peg Drop)
  fx/ ui/                  particles, screen shake, HUD, game-over card, countdown bar, joystick, shop
src/games/registry.ts    metadata + lazy import() for every game
src/games/<id>/index.ts  one folder per game; rule-heavy games keep pure rules in logic.ts
```

Each game is a `GameFactory`: `(ctx) => { pause, resume, destroy }`. The `ctx` it receives provides `root`, `sfx`, `haptics`, `store`, `hud`, `hint()` and `gameOver()`. Vite splits every game into its own chunk, which loads only when you open that game.

### Add a game

1. Create `src/games/<id>/index.ts` that default-exports a `GameFactory`. Most games use `canvasGame(ctx, (stage) => ({ update, render, pointer }))`.
2. Put any real rules in `src/games/<id>/logic.ts`, and write their test in `tests/unit/<id>.test.ts` first.
3. Call `ctx.hint('…')` once (one line, no tutorial). Give the core action a `ctx.sfx` sound and a `ctx.haptics` pulse. End scored runs with `ctx.gameOver({ score, retry })`.
4. Add a `GameMeta` line to `src/games/registry.ts`. Use an emoji from Unicode 12 or older so it renders on older Android and Windows.
5. Run `npm test && npm run build && npm run size && npm run e2e`. The e2e suite picks up new games automatically.

## Later: optional Google/Apple sign-in

All persistence goes through `Store` (`src/core/storage.ts`, keys under `bg1:`). To sync across devices, add a `SyncedStore` with the same `get`/`set` API. It would keep the local copy and push and pull one JSON blob (stats, favorites, settings) through Supabase Auth with Google and Apple providers. No game code changes. Apple sign-in needs a paid Apple Developer account.
