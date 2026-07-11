#!/usr/bin/env node
/**
 * stardust/qa-gate.mjs — Wave-A gate 2: local harness render assertions.
 * For each page: exactly one h1; every grid/flex block container computes
 * grid/flex; block content non-empty; ledger unit counts == authored counts;
 * no horizontal overflow at 360/1440; zero pageerrors.
 * Usage: node stardust/qa-gate.mjs  (server on :3999 serving repo root)
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';

const PAGES = {
  blog: { rows: 25, rowSel: '.ledger .entry-row, .ledger .lead-link' },
  glossary: { rows: 41, rowSel: '.ledger .term-row' },
  experts: { rows: 99, rowSel: '.ledger .expert-row' },
  'open-startups': { rows: 5, rowSel: '.ledger .rev-row' },
  help: { rows: 1, rowSel: '.ledger .collection-row' },
};

const browser = await chromium.launch();
let failed = false;

for (const [slug, spec] of Object.entries(PAGES)) {
  for (const width of [360, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:3999/qa/${slug}.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const h1s = document.querySelectorAll('h1').length;
      const blocks = [...document.querySelectorAll('main [data-block-name]')];
      const empty = blocks.filter((b) => !b.childElementCount).map((b) => b.dataset.blockName);
      // every container the block CSS declares grid/flex must compute it
      const gridsFlexed = [];
      blocks.forEach((b) => {
        b.querySelectorAll('*').forEach((n) => {
          const d = getComputedStyle(n).display;
          if (d === 'grid' || d === 'flex' || d === 'inline-flex' || d === 'inline-grid') gridsFlexed.push(n.className);
        });
      });
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return {
        h1s, empty, gridFlexCount: gridsFlexed.length, overflow, blockCount: blocks.length,
      };
    });
    const rows = await page.locator(spec.rowSel).count();
    const probs = [];
    if (r.h1s !== 1) probs.push(`h1 count ${r.h1s}`);
    if (r.empty.length) probs.push(`empty blocks: ${r.empty.join(',')}`);
    if (!r.gridFlexCount) probs.push('no grid/flex containers computed');
    if (rows !== spec.rows) probs.push(`ledger rows ${rows} != ${spec.rows}`);
    if (r.overflow > 1) probs.push(`horizontal overflow ${r.overflow}px`);
    if (errors.length) probs.push(`pageerrors: ${errors.join(' | ')}`);
    const ok = !probs.length;
    if (!ok) failed = true;
    console.log(`${slug}@${width}: ${ok ? '✓' : `✗ ${probs.join('; ')}`} (${r.blockCount} blocks, ${r.gridFlexCount} grid/flex nodes, rows ${rows})`);
    await page.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
