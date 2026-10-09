# Bored Game: a pocket arcade of fidget and brain-rot mini games

## Context
The user wants a "buffer" app for bored people who have a few minutes to kill. It should hold as many fidget and brain-rot (mindless hyper-casual) mini games as possible, make switching between them instant, need no login, and be as lightweight as possible. They asked for at least 25 games, found, evaluated and built by us. The project folder (`C:\Users\User\Desktop\dev\bored-game`) is empty and is not a git repo yet. Node 24, npm 11 and git 2.39 are available.

**Decisions confirmed with the user**
- **Platform:** installable PWA in vanilla TypeScript with Canvas, built with Vite. No UI framework. Can be wrapped with Capacitor for the app stores later.
- **Sign-in:** not in v1. Everything stays local, and the storage layer is designed so Google/Apple sign-in plus cloud sync can be added later.
- **"Brain rot"** means mindless hyper-casual games (one-tap, satisfying loops) with original content and no meme characters.

**Assumptions** (the user can override them at review): mobile-first portrait that also works on desktop with a mouse or keyboard; works offline after the first visit; no ads, payments or analytics in v1; working name "Bored Game".

**Success criteria**
- 36 games ship (more than the minimum of 25).
- Any game is playable less than 2 s after tapping it, with no tutorial screens.
- One-tap switching (Home / Shuffle) is reachable from inside every game.
- Initial download is 35 KB gzipped or less; the whole app with all games is 400 KB gzipped or less.
- The app works fully offline.

## Architecture (approach: shared micro-engine and lazy-loaded game modules)
Alternatives rejected: Phaser or Kaboom, because they cost 300 KB to 1 MB before writing a single game; one iframe per game, because it duplicates the engine and makes switching slow.

- **Shell** (plain DOM): a hash router (`#/`, `#/play/<id>`) so the browser or Android back button returns home and games can be deep-linked.
  - The home screen has a category filter (All / Fidget / Arcade / Brain), a Favorites row, a Recent row, and a large **"Surprise me"** button.
  - The in-game top bar has Home, the title, Favorite and **Shuffle** (a random game not played recently). On desktop, Esc goes home and N goes to the next game.
- **Game contract** (`src/core/types.ts`):
  ```ts
  type Category = 'fidget' | 'arcade' | 'brain';
  interface GameMeta { id; title; category; emoji; color; blurb; scoring: 'high'|'low'|'none';
                       load: () => Promise<{ default: GameFactory }> }
  type GameFactory = (ctx: GameContext) => GameInstance;
  interface GameContext { root: HTMLElement; sfx: Sfx; haptics: Haptics; store: ScopedStore;
                          submitScore(v: number): { best: number; isNew: boolean }; ui: { hud; overlay } }
  interface GameInstance { pause(): void; resume(): void; destroy(): void }
  ```
  The registry (`src/games/registry.ts`) holds only metadata plus `import()` calls, so each game is its own chunk of about 3–10 KB that loads on demand. The service worker precaches every chunk, so the whole arcade works offline.
- **Core modules** (`src/core/`), shared so each game stays small:
  - `stage.ts`: a canvas that respects device pixel ratio and resizes with the screen.
  - `loop.ts`: a requestAnimationFrame loop that caps the time step and pauses automatically when the tab is hidden.
  - `input.ts`: pointer and multi-touch handling, plus swipe and drag helpers.
  - `audio.ts`: the ZzFX sound generator (MIT, about 1 KB, sounds generated in code so there are no audio files), unlocked on the first tap, with presets for pop, click, whoosh, hit, score and fail.
  - `haptics.ts`: `navigator.vibrate` on Android, a best-effort iOS fallback using the checkbox `switch` trick (Apple patched this in iOS 26.5, so iOS falls back to sound only), and a settings toggle.
  - `storage.ts`: a `Store` interface over localStorage. Keys are namespaced under `bg1:` (`stats`, `favs`, `settings`, `g:<id>:<key>`) and the store can be swapped for a cloud-synced version later.
  - `stats.ts`: best score, play count and time played per game. The home screen also shows total time spent ("time killed").
  - Effects: `fx/particles.ts` (pooled), `fx/shake.ts` and `ease.ts`.
  - Math helpers: `math.ts`, `rand.ts` (seedable random numbers) and `color.ts`.
  - `physics/circles.ts`: a small circle physics solver used by Merge Drop, Peg Drop and Keepy Up. Replaces matter.js, which is about 90 KB.
  - `ui/overlay.ts`: a shared game-over card ("Score / Best / tap to retry / ⏭ next game") and the score display.
- **Mobile hardening:**
  - Turn off browser gestures that fight the games: `touch-action: none` and `overscroll-behavior: none` on the play area, and no long-press menu or text selection there.
  - Respect safe-area insets.
  - Every game pauses on `visibilitychange`, and `destroy()` must remove every listener, the animation loop and any audio nodes.
- **Visuals:** zero image assets. Everything is drawn in code on canvas or SVG, with emoji as game icons and the system font stack. Dark-first, candy/neon palette, chunky rounded tiles. Light mode follows the system setting. The shell's look gets polished with the frontend-design skill during Wave 0.
- **PWA:** `vite-plugin-pwa` handles the manifest (standalone, portrait), precaching and automatic updates. App icons are generated from one SVG.
- **Later, not in v1:** a `SyncedStore` using Supabase Auth (Google/Apple) that syncs one JSON blob of stats and favorites. Apple sign-in needs a $99/yr Apple developer account.

## Game evaluation
Each candidate was scored on five criteria:
1. Understood within 2 s with no tutorial.
2. Fun in sessions of 10 s to 3 min, and fine to quit at any moment.
3. Satisfying feedback potential (sound, particles, vibration).
4. Buildable procedurally with zero assets.
5. Plays well one-handed in portrait.

Build cost: S is about 100–250 lines, M is about 250–500 lines. Names are original, avoiding the Flappy, Plinko, Simon and Pop It trademarks.

**Fidget: no fail state (13)**
| Game | Loop | Cost |
|---|---|---|
| Bubble Wrap | Tap or drag to pop bubbles; a fresh sheet rolls in; pop counter | S |
| Poppers | Rainbow silicone pop grid; pop every cell and it flips over | S |
| Spinner | Flick a fidget spinner; friction physics; live and best RPM | S |
| Switchboard | Toggles, clicky keys, sliders, dials and a click-pen, all clicking and buzzing | S |
| Swirl | Thousands of particles stream and orbit around your fingers | S |
| Fireworks | Tap to launch; hold for a bigger shell; multi-touch | S |
| Power Wash | Scrub grime off a hidden pattern; % cleaned; then the next surface | S |
| Kaleido | Neon drawing mirrored 6–12 ways that slowly fades | S |
| Beat Pads | 4×4 pentatonic and drum pads that can't sound bad | S |
| Slime | Poke, pinch and stretch a jiggly soft-body blob | M |
| Sandfall | Pour sand, water and stone (falling-sand simulation) | M |
| Ripples | Tap a pond to make waves; light patterns shimmer on the water | M |
| Soap Cut | Swipe to slice soap blocks that crumble into cubes | M |

**Arcade brain rot: score and fail (14)**
| Game | Loop | Cost |
|---|---|---|
| Flapper | Tap to flap through gaps | S |
| Stacker | Tap to drop the sliding slab; the overhang gets sliced off | S |
| Knife Throw | Throw into a spinning log without hitting other knives | S |
| Chop | Tap left or right to chop the trunk and dodge branches as the timer drains | S |
| Hop Run | Auto-runner; tap to jump; speeds up | S |
| Brick Breaker | Drag the paddle and break the bricks | S |
| Snake | Swipe to steer, eat and grow | S |
| Dodge | Drag a dot to dodge falling blocks; survival time | S |
| Tile Tap | Tap only the dark tiles as they scroll; speeds up | S |
| Keepy Up | Tap the ball to keep it in the air | S |
| Peg Drop | Drop balls through pegs into multiplier buckets | S |
| Slice | Swipe through flying shapes; avoid bombs; combos | M |
| Merge Drop | Drop balls; matching sizes merge into bigger ones; don't overflow | M |
| Block Fit | Drag 3 pieces onto an 8×8 grid to clear rows and columns | M |

**Quick brain challenges (9)**
| Game | Loop | Cost |
|---|---|---|
| 2048 | Swipe to merge tiles | S |
| Perfect Circle | Draw a circle freehand and get an accuracy % | S |
| Ten Seconds | Stop a hidden timer at exactly 10.00 s | S |
| Reaction | Wait for green, then tap; average of 5 tries in ms | S |
| Odd Color | Find the tile with a slightly different shade; the grid grows | S |
| Color Clash | Tap the ink color, not the word the letters spell; 30 s | S |
| Math Sprint | Answer true or false on equations; 30 s | S |
| Echo | Repeat a growing sequence of lights and tones | S |
| Ball Sort | Pour balls between tubes until each tube holds one color; generated levels checked by a solver | M |

**Rejected or backlog**
- **3D games** (Helix Jump, Crossy Road): need WebGL and assets, which adds weight.
- **Word games:** a word list costs 30–100 KB.
- **Slots and spin wheels:** gambling vibe and no skill.
- **Idle clicker:** needs an economy to be tuned; strong v2 candidate.
- **Newton's Cradle, Dominoes, Zipper:** a lot of physics or art for a thin payoff.
- **Minesweeper, Sudoku:** sessions run long.
- **Whack-a-mole, Aim trainer, Color-switch clone:** overlap with Tile Tap, Reaction and Flapper.
- **Leaderboards and multiplayer:** need the backend that comes with sign-in.

## Project layout
```
index.html · vite.config.ts · tsconfig.json · package.json
public/icon.svg (+ generated PNG icons)
src/main.ts
src/app/{router,home,player,settings}.ts, styles.css
src/core/{types,stage,loop,input,audio,haptics,storage,stats,math,rand,color,ease}.ts
src/core/fx/*, src/core/physics/circles.ts, src/core/ui/overlay.ts
src/games/registry.ts
src/games/<id>/index.ts           (+ logic.ts for rule-heavy games, kept pure for unit tests)
tests/unit/*.test.ts               (Vitest)
tests/e2e/smoke.spec.ts            (Playwright)
scripts/size-budget.mjs
```
Pure `logic.ts` modules with unit tests: 2048, Block Fit, Snake, Ball Sort (generator and solver), Merge Drop (merge rules), Stacker (slice math), Perfect Circle (scoring), Echo, storage and stats.

## Execution: in waves, with a usable app at the end of each
0. **Setup:** `git init`, save this design to `docs/superpowers/specs/2026-10-09-bored-game-design.md`, write the detailed implementation plan (writing-plans skill), then build the Vite + TS scaffold, the core modules, the shell (home, player, settings), the PWA setup, Vitest, Playwright and the size-budget script.
1. **Wave 1 (10 games):** Bubble Wrap, Poppers, Spinner, Swirl, Flapper, Stacker, 2048, Perfect Circle, Ten Seconds, Reaction. This set tests every core module.
2. **Wave 2 (13 games):** Switchboard, Fireworks, Power Wash, Kaleido, Beat Pads, Knife Throw, Chop, Hop Run, Brick Breaker, Snake, Dodge, Tile Tap, Odd Color.
3. **Wave 3 (13 games):** Slime, Sandfall, Ripples, Soap Cut, Slice, Merge Drop, Block Fit, Keepy Up, Peg Drop, Color Clash, Math Sprint, Echo, Ball Sort.

Each wave ends with the full verification below passing. The games inside a wave are independent of each other, so they can be built in parallel once the core is frozen.

## Verification
- `npm test`: Vitest unit tests for the logic modules, storage and stats.
- `npm run build && npm run size`: fails if the initial load is over 35 KB gzipped, any single game chunk is over 12 KB gzipped, or the total is over 400 KB gzipped.
- `npm run e2e`: Playwright on Pixel 7 and iPhone 15 viewports.
  - For every game in the registry: open `#/play/<id>`, send a few taps or swipes, check that the canvas isn't blank (pixel sample), check there are zero console errors or page errors, press Home, and check the grid is back.
  - Also: Shuffle 40 times in a row with no errors, then an offline test (load, go offline, reload, play a game).
- **Manual:** run `npm run dev -- --host`, open it on a real phone on the same Wi-Fi, install to the home screen, and check that it feels right and that sound and vibration work. Run a Lighthouse PWA and performance check on the production preview.
