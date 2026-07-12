#!/usr/bin/env node
/**
 * stardust/gen/gate.mjs — harness render gate for the Path-A′ pages.
 * Wraps 3 sample content fragments (one story, experts-design, academy) as
 * standalone harness docs (metadata block → head <title>/<meta template>),
 * serves the repo on :3023 with the real styles.css + ak.js + scripts.js +
 * template CSS, and asserts per sample:
 *   exactly one h1 · every block decorated & non-empty · a grid/flex layout
 *   computes inside each block (no .block display:block fallback) · ledger row
 *   count == captured item count · 0 horizontal overflow @1440 · 0 pageerrors.
 *
 * Run: node stardust/gen/gate.mjs
 */
/* eslint-disable no-console */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const PORT = 3023;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json',
};

/* wrap a David's-model content fragment into a standalone harness doc */
function harness(fragmentPath) {
  const raw = fs.readFileSync(fragmentPath, 'utf8');
  const title = (raw.match(/<div>Title<\/div><div>([^<]*)<\/div>/) || [])[1] || 'QA harness';
  const template = (raw.match(/<div>Template<\/div><div>([^<]*)<\/div>/) || [])[1] || null;
  // drop the metadata section wrapper
  const body = raw.replace(/ {2}<div>\n {4}<div class="metadata">[\s\S]*?<\/div>\n {2}<\/div>\n/, '');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${template ? `<meta name="template" content="${template}">\n` : ''}<link rel="stylesheet" href="/styles/styles.css">
<script src="/scripts/ak.js" type="module"></script>
<script src="/scripts/scripts.js" type="module"></script>
<link rel="icon" href="/favicon.png"></head>
${body.replace(/^<body>/, '<body>')}</html>`;
}

const SAMPLES = [
  { name: 'story', file: 'content/customers/how-grokability-recovered-150k-in-failed-charges-with-baremetrics.html', ledger: null },
  { name: 'experts-design', file: 'content/experts/design.html', ledger: 16 },
  { name: 'academy', file: 'content/academy.html', ledger: 25 },
];

// write harness pages
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
SAMPLES.forEach((s) => {
  fs.writeFileSync(path.join(ROOT, `qa/gen-${s.name}.html`), harness(path.join(ROOT, s.file)));
});

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (err, data) => {
    if (err) { res.statusCode = 404; res.end('404'); return; }
    res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
    res.end(data);
  });
});

await new Promise((r) => server.listen(PORT, r));
console.log(`serving ${ROOT} on :${PORT}`);

const browser = await chromium.launch();
let failed = false;
const flag = (name, msg) => { failed = true; console.log(`  ✗ ${name}: ${msg}`); };

for (const s of SAMPLES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/qa/gen-${s.name}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const r = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('main .masthead, main .ledger, main .article-head, main .band')];
    const blockReport = blocks.map((b) => {
      const decorated = b.dataset.blockStatus === 'loaded' || b.querySelector(':scope > div:not([data-block-name])') || b.children.length > 0;
      const empty = (b.textContent || '').trim().length === 0;
      const all = [b, ...b.querySelectorAll('*')];
      const gridflex = all.some((n) => {
        const disp = getComputedStyle(n).display;
        return disp === 'grid' || disp === 'flex' || disp === 'inline-flex' || disp === 'inline-grid';
      });
      return { cls: b.className, decorated: !!decorated, empty, gridflex };
    });
    return {
      h1: document.querySelectorAll('main h1').length,
      blocks: blockReport,
      ledgerRows: document.querySelectorAll('main .ledger .surface-link').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  if (r.h1 !== 1) flag(s.name, `h1 count = ${r.h1}`);
  r.blocks.forEach((b) => {
    if (b.empty) flag(s.name, `empty block ${b.cls}`);
    if (!b.gridflex) flag(s.name, `no grid/flex in ${b.cls}`);
  });
  if (s.ledger !== null && r.ledgerRows !== s.ledger) flag(s.name, `ledger rows ${r.ledgerRows} != ${s.ledger}`);
  if (r.overflow > 1) flag(s.name, `overflow ${r.overflow}px @1440`);
  if (errors.length) flag(s.name, `${errors.length} pageerror(s): ${errors[0]}`);

  console.log(`  ${failed ? '·' : '✓'} ${s.name}: h1=${r.h1} blocks=${r.blocks.length} ledgerRows=${r.ledgerRows} overflow=${r.overflow} errors=${errors.length}`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? 'GATE: FAIL' : 'GATE: PASS');
process.exit(failed ? 1 : 0);
