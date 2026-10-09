// Renders public/icon.svg into the PNG app icons the manifest needs.
// Run with `node scripts/icons.mjs` after editing the SVG; the PNGs are committed.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/icon.svg', 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const variants = [
  { file: 'public/icon-192.png', size: 192, pad: 0, bg: 'transparent' },
  { file: 'public/icon-512.png', size: 512, pad: 0, bg: 'transparent' },
  // maskable icons get cropped to a circle or squircle: keep the art inside the central 80%
  { file: 'public/icon-maskable.png', size: 512, pad: 0.12, bg: '#1d1238' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const v of variants) {
  await page.setViewportSize({ width: v.size, height: v.size });
  const inner = Math.round(v.size * (1 - v.pad * 2));
  await page.setContent(
    `<body style="margin:0;background:${v.bg};display:grid;place-items:center;width:${v.size}px;height:${v.size}px">
       <img src="${dataUrl}" width="${inner}" height="${inner}"></body>`,
  );
  await page.screenshot({ path: v.file, omitBackground: v.bg === 'transparent' });
  console.log('wrote', v.file);
}
await browser.close();
