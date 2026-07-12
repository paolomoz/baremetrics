/**
 * stardust/gen/gate-static.mjs — local harness render gate for the Path A′
 * STATIC/USERCASE/HELP-KB/TOOL/OPEN-DATA pages. Builds a qa harness for the 3
 * briefed samples (privacy, wall-of-love, open-benchmarks), serves the repo
 * root on :3024, and asserts per sample:
 *   one h1 · every block decorated + non-empty · grid/flex containers compute
 *   · 0 horizontal overflow @1440 · 0 pageerrors · (legal) prose text present.
 * Run from the repo root: node stardust/gen/gate-static.mjs
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../..');
const PORT = 3024;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon',
};

function harness(slug, contentRel) {
  const html = fs.readFileSync(path.join(REPO, 'content', contentRel), 'utf8');
  const mainInner = html.match(/<main>([\s\S]*?)<\/main>/)[1];
  const isArticle = /<div>Template<\/div><div>article<\/div>/.test(html);
  const body = mainInner.replace(/\s*<div>\s*<div class="metadata">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');
  const templMeta = isArticle ? '<meta name="template" content="article">\n' : '';
  const out = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>QA harness — ${slug}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${templMeta}<link rel="stylesheet" href="/styles/styles.css">
<script src="/scripts/ak.js" type="module"></script>
<script src="/scripts/scripts.js" type="module"></script>
<link rel="icon" href="/favicon.png"></head>
<body>
<main>${body}</main>
</body></html>`;
  fs.writeFileSync(path.join(REPO, 'qa', `${slug}-static.html`), out);
  return `/qa/${slug}-static.html`;
}

const SAMPLES = [
  { slug: 'privacy', content: 'privacy.html', article: true },
  { slug: 'wall-of-love', content: 'wall-of-love.html' },
  { slug: 'open-benchmarks', content: 'open-benchmarks.html' },
];
SAMPLES.forEach((s) => { s.url = harness(s.slug, s.content); });

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(REPO, p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(PORT, r));
console.log(`serving ${REPO} on :${PORT}`);

const browser = await chromium.launch();
let failed = false;
for (const s of SAMPLES) {
  for (const width of [1440, 360]) {
    const pg = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.goto(`http://localhost:${PORT}${s.url}`, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(700);
    const r = await pg.evaluate(() => {
      const h1s = document.querySelectorAll('main h1').length;
      const blocks = [...document.querySelectorAll('main [data-block-name]')];
      const empty = blocks.filter((b) => !b.childElementCount).map((b) => b.dataset.blockName);
      let gf = 0;
      blocks.forEach((b) => b.querySelectorAll('*').forEach((n) => {
        const d = getComputedStyle(n).display;
        if (['grid', 'flex', 'inline-flex', 'inline-grid'].includes(d)) gf += 1;
      }));
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const dc = [...document.querySelectorAll('main .default-content, main .default-content-wrapper')];
      const proseText = dc.map((d) => (d.innerText || '').trim()).join(' ').length;
      const mastDecorated = !!document.querySelector('main .masthead .mast-inner');
      return {
        h1s, empty, gf, overflow, mastDecorated, blocks: blocks.map((b) => b.dataset.blockName), proseText,
      };
    });
    const probs = [];
    if (r.h1s !== 1) probs.push(`h1=${r.h1s}`);
    if (r.empty.length) probs.push(`empty:${r.empty.join(',')}`);
    /* grid/flex "where used": layout blocks (band/cards) must compute it;
       a default masthead (legal h1 banner) is block-level by design, so the
       article sample instead asserts the masthead decorated + prose present. */
    if (s.article) {
      if (!r.mastDecorated) probs.push('masthead not decorated');
      if (width === 1440 && r.proseText < 500) probs.push(`legal prose thin (${r.proseText} chars)`);
    } else if (!r.gf) probs.push('no grid/flex computed');
    if (width === 1440 && r.overflow > 1) probs.push(`overflow ${r.overflow}px`);
    if (errors.length) probs.push(`pageerrors:${errors.join('|')}`);
    if (probs.length) failed = true;
    console.log(`${s.slug}@${width}: ${probs.length ? `FAIL ${probs.join('; ')}` : 'OK'} [blocks: ${r.blocks.join(',')}; grid/flex ${r.gf}; prose ${r.proseText}c; overflow ${r.overflow}]`);
    await pg.close();
  }
}
await browser.close();
server.close();
console.log(failed ? 'GATE: FAIL' : 'GATE: PASS');
process.exit(failed ? 1 : 0);
