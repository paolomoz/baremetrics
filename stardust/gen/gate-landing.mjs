#!/usr/bin/env node
/**
 * stardust/gen/gate-landing.mjs — harness render gate for the INTEGRATION +
 * COMPARE landing pages (this task's deliverables). Serves the repo on :3022
 * decorated by the real /scripts/scripts.js + /styles/styles.css, then probes
 * the 3 required samples (chargebee, compare-chartmogul-alternative, recurly).
 * Per page @1440 (and @360): exactly one h1, first heading is h1, no heading-
 * level jump, every [data-block-name] decorated + non-empty, grid/flex layout
 * computes, 0 horizontal overflow, 0 pageerrors, no broken (0×0) raster images.
 *
 * Separate file from the sibling gate.mjs (another Path-A′ agent's samples).
 * Run: node stardust/gen/gate-landing.mjs
 */
/* eslint-disable no-console */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { OUT, here } from './_lib.mjs';

const ROOT = path.resolve(here, '../..');
const PORT = 3022;
const SAMPLES = [
  { slug: 'chargebee', file: 'chargebee.html' },
  { slug: 'compare-chartmogul-alternative', file: 'compare/chartmogul-alternative.html' },
  { slug: 'recurly', file: 'recurly.html' },
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
SAMPLES.forEach((s) => {
  const raw = fs.readFileSync(path.join(OUT, s.file), 'utf8');
  let inner = raw.replace(/^[\s\S]*?<main>/, '').replace(/<\/main>[\s\S]*$/, '');
  inner = inner.replace(/\s*<div>\s*<div class="metadata">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');
  fs.writeFileSync(path.join(ROOT, 'qa', `gen-landing-${s.slug}.html`), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>QA — ${s.slug}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/styles/styles.css">
<script src="/scripts/scripts.js" type="module"></script>
<link rel="icon" href="/favicon.png"></head>
<body>
<main>${inner}</main>
</body></html>`);
});

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const fp = path.join(ROOT, url === '/' ? '/index.html' : url);
  fs.readFile(fp, (err, data) => {
    if (err) { res.statusCode = 404; res.end('nf'); return; }
    res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
    res.end(data);
  });
});
await new Promise((r) => server.listen(PORT, r));
console.log(`serving ${ROOT} on :${PORT}`);

const browser = await chromium.launch();
let failed = false;
const check = (probs, cond, msg) => { if (!cond) probs.push(msg); };

for (const s of SAMPLES) {
  for (const width of [1440, 360]) {
    const pg = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.goto(`http://localhost:${PORT}/qa/gen-landing-${s.slug}.html`, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(700);
    const r = await pg.evaluate(() => {
      const blocks = [...document.querySelectorAll('main [data-block-name]')];
      let gridFlex = 0;
      blocks.forEach((b) => [b, ...b.querySelectorAll('*')].forEach((n) => {
        const d = getComputedStyle(n).display;
        if (d.includes('grid') || d.includes('flex')) gridFlex += 1;
      }));
      const levels = [...document.querySelectorAll('main h1,main h2,main h3,main h4,main h5,main h6')].map((h) => +h.tagName[1]);
      let jump = null;
      for (let i = 1; i < levels.length; i += 1) if (levels[i] - levels[i - 1] > 1) jump = `${levels[i - 1]}->${levels[i]}`;
      const broken = [...document.querySelectorAll('main img')].filter((im) => im.complete && im.naturalWidth === 0 && !/\.svg/i.test(im.src)).length;
      return {
        h1s: document.querySelectorAll('main h1').length,
        blocks: blocks.length,
        empty: blocks.filter((b) => !b.childElementCount).map((b) => b.dataset.blockName),
        gridFlex,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        jump,
        broken,
        firstLevel: levels[0],
      };
    });
    const probs = [];
    check(probs, r.h1s === 1, `h1 count ${r.h1s}`);
    check(probs, r.firstLevel === 1, `first heading h${r.firstLevel}`);
    check(probs, !r.jump, `heading jump ${r.jump}`);
    check(probs, !r.empty.length, `empty blocks: ${r.empty.join(',')}`);
    check(probs, r.gridFlex > 0, 'no grid/flex computed');
    check(probs, r.overflow <= 1, `overflow ${r.overflow}px`);
    check(probs, !errors.length, `pageerrors: ${errors.join(' | ')}`);
    if (width === 1440) check(probs, r.broken === 0, `broken images ${r.broken}`);
    const ok = !probs.length;
    if (!ok) failed = true;
    console.log(`  ${ok ? '✓' : '✗'} ${s.slug}@${width}: ${ok ? '' : probs.join('; ')} (${r.blocks} blocks, ${r.gridFlex} grid/flex)`);
    await pg.close();
  }
}

await browser.close();
server.close();
console.log(failed ? 'GATE: FAIL' : 'GATE: PASS');
process.exit(failed ? 1 : 0);
