// Fails the build when the app gets heavier than the spec allows.
// initial = index.html + the JS/CSS it references directly; game-* = each lazily loaded game chunk.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET = { initial: 35_000, game: 12_000, total: 400_000 };

const gz = (path) => gzipSync(readFileSync(path), { level: 9 }).length;
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const initial = gz(join(DIST, 'index.html')) + refs.reduce((n, r) => n + gz(join(DIST, r)), 0);

const files = walk(DIST).filter((p) => !p.endsWith('.map'));
const total = files.reduce((n, p) => n + gz(p), 0);
const games = files
  .filter((p) => /[\/]game-[^\/]+\.js$/.test(p))
  .map((p) => ({ name: p.replace(/^.*[\/]game-(.+)-[^-]+\.js$/, '$1'), size: gz(p) }))
  .sort((a, b) => b.size - a.size);

const kb = (n) => (n / 1000).toFixed(1).padStart(6) + ' KB';
const fails = [];
const row = (label, size, max) => {
  const ok = size <= max;
  if (!ok) fails.push(label);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(18)} ${kb(size)}  / ${kb(max)}`);
};

console.log('gzipped sizes');
row('initial', initial, BUDGET.initial);
for (const g of games) row(`game ${g.name}`, g.size, BUDGET.game);
row('total', total, BUDGET.total);
console.log(`${games.length} game chunks`);
if (fails.length) {
  console.error(`\nOver budget: ${fails.join(', ')}`);
  process.exit(1);
}
