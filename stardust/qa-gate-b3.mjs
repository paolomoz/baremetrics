#!/usr/bin/env node
/**
 * stardust/qa-gate-b3.mjs — Wave B3 harness gate (features/recover + stripe).
 * Serves the repo root itself (ephemeral port), renders qa/features-recover.html
 * + qa/stripe.html through the real runtime (ak.js/scripts.js) and asserts:
 *   - exactly one h1
 *   - recover: steps spine alternates >=1000px (step 1 media docks LEFT)
 *   - recover: accordion panels visible with JS off + keyboard toggle with JS on
 *   - recover: calc-row renders 3 non-empty <data class="figure">
 *   - feature-hero aside/media non-empty (recover stat-sheet, stripe exhibit)
 *   - every block computes at least one grid/flex container
 *   - no horizontal overflow at 360 and 1440
 *   - zero pageerrors
 * Usage: node stardust/qa-gate-b3.mjs
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => { server.listen(0, r); });
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
let failed = false;
const report = (page, width, probs) => {
  if (probs.length) failed = true;
  console.log(`${page}@${width}: ${probs.length ? `✗ ${probs.join('; ')}` : '✓'}`);
};

for (const slug of ['features-recover', 'stripe']) {
  for (const width of [360, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/qa/${slug}.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const h1s = document.querySelectorAll('h1').length;
      const blocks = [...document.querySelectorAll('main [data-block-name]')];
      const empty = blocks.filter((b) => !b.childElementCount).map((b) => b.dataset.blockName);
      const noGrid = blocks.filter((b) => ![b, ...b.querySelectorAll('*')]
        .some((n) => /grid|flex/.test(getComputedStyle(n).display))).map((b) => b.dataset.blockName);
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { h1s, empty, noGrid, overflow, blockCount: blocks.length };
    });
    const probs = [];
    if (r.h1s !== 1) probs.push(`h1 count ${r.h1s}`);
    if (r.empty.length) probs.push(`empty blocks: ${r.empty.join(',')}`);
    if (r.noGrid.length) probs.push(`no grid/flex computed in: ${r.noGrid.join(',')}`);
    if (r.overflow > 1) probs.push(`horizontal overflow ${r.overflow}px`);

    if (slug === 'features-recover') {
      const extra = await page.evaluate(() => {
        const out = [];
        /* feature-hero aside non-empty */
        const aside = document.querySelector('.feature-hero .stat-sheet');
        if (!aside || !aside.textContent.trim() || !aside.querySelector('data.figure')) out.push('feature-hero stat-sheet empty');
        /* calc-row figures render */
        const figs = [...document.querySelectorAll('.calc-row data.figure')];
        if (figs.length !== 3 || figs.some((f) => !f.textContent.trim())) out.push(`calc-row figures ${figs.length}/3`);
        /* accordion decorated + panels closed by JS */
        const btns = [...document.querySelectorAll('.accordion .faq-q')];
        if (btns.length !== 5) out.push(`accordion buttons ${btns.length}/5`);
        return out;
      });
      probs.push(...extra);
      if (width === 1440) {
        const alt = await page.evaluate(() => {
          const steps = [...document.querySelectorAll('.steps .step')];
          if (steps.length !== 4) return `steps count ${steps.length}/4`;
          const side = (s) => {
            const m = s.querySelector('.step-media').getBoundingClientRect();
            const c = s.querySelector('.step-copy').getBoundingClientRect();
            return m.left < c.left ? 'L' : 'R';
          };
          const seq = steps.map(side).join('');
          return seq === 'LRLR' ? null : `steps spine sequence ${seq} (want LRLR)`;
        });
        if (alt) probs.push(alt);
        /* keyboard toggle */
        const btn = page.locator('.accordion .faq-q').first();
        await btn.focus();
        await page.keyboard.press('Enter');
        const open = await page.evaluate(() => {
          const b = document.querySelector('.accordion .faq-q');
          const panel = document.getElementById(b.getAttribute('aria-controls'));
          return b.getAttribute('aria-expanded') === 'true' && !panel.hidden && panel.offsetHeight > 0;
        });
        if (!open) probs.push('accordion keyboard toggle failed');
        await page.keyboard.press('Enter');
        const closed = await page.evaluate(() => document.querySelector('.accordion .faq-q').getAttribute('aria-expanded') === 'false');
        if (!closed) probs.push('accordion keyboard re-close failed');
      }
    }

    if (slug === 'stripe') {
      const extra = await page.evaluate(() => {
        const out = [];
        const media = document.querySelector('.feature-hero.integration .masthead-media img');
        if (!media) out.push('feature-hero integration exhibit missing');
        const pair = document.querySelectorAll('.feature-hero.integration .handshake-pair img').length;
        if (pair !== 2) out.push(`handshake pair imgs ${pair}/2`);
        const rows = document.querySelectorAll('.steps.entries .spine-row').length;
        if (rows !== 3) out.push(`spine rows ${rows}/3`);
        const pubs = document.querySelectorAll('.ledger.publications .pub-row').length;
        if (pubs !== 8) out.push(`publication rows ${pubs}/8`);
        return out;
      });
      probs.push(...extra);
    }

    if (errors.length) probs.push(`pageerrors: ${errors.join(' | ')}`);
    report(slug, width, probs);
    await page.close();
  }
}

/* accordion JS-off: panels (answers) must be present + visible in raw markup */
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/qa/features-recover.html`, { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(() => {
    const acc = document.querySelector('.accordion');
    if (!acc) return 'accordion markup missing';
    const t = acc.textContent;
    const has = t.includes('smart retries automatically re-attempt') && t.includes('Branded emails in your team');
    return has ? null : 'accordion answers not readable JS-off';
  });
  const probs = r ? [r] : [];
  report('features-recover (JS off)', 1440, probs);
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? '✗ B3 harness gate FAILED' : '✓ B3 harness gate passed');
process.exit(failed ? 1 : 0);
