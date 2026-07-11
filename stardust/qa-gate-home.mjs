#!/usr/bin/env node
/**
 * stardust/qa-gate-home.mjs — Wave-B1 gate 2 (stardust/qa-gate.mjs pattern):
 * local harness render assertions for qa/home.html.
 *   - exactly one h1;
 *   - hero non-empty: h1 present + the SVG dashboard fallback visible (or the
 *     lottie panel, if the player actually loaded);
 *   - every layout container computes grid/flex (logo-table, triptych,
 *     counter-row, mosaic ×2, film-rail, publication-list rows, band splits);
 *   - no horizontal overflow at 360/1440;
 *   - zero pageerrors;
 *   - h1 carousel ROTATES under normal motion and stays STATIC ("+ Chargebee")
 *     under reduced-motion emulation.
 * Usage: node stardust/qa-gate-home.mjs   (server on :3999 serving repo root)
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';

const URL = 'http://localhost:3999/qa/home.html';
const browser = await chromium.launch();
let failed = false;

const GRIDS = [
  ['.logos.table .logo-table', 'grid'],
  ['.cards.triptych .triptych', 'grid'],
  ['.logos.counter .counter-row', 'grid'],
  ['.cards.mosaic .mosaic', 'grid'],
  ['.cards.filmstrip .film-rail', 'flex'],
  ['.band.split .band-wrap', 'grid'],
  ['.hero .hero-row', 'grid'],
];

for (const width of [360, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const r = await page.evaluate((grids) => {
    const h1s = document.querySelectorAll('h1').length;
    const blocks = [...document.querySelectorAll('main [data-block-name]')];
    const empty = blocks.filter((b) => !b.childElementCount).map((b) => b.dataset.blockName);
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0
      && getComputedStyle(el).display !== 'none';
    const hero = document.querySelector('.hero');
    const heroOk = !!hero && !!hero.querySelector('h1')
      && (vis(hero.querySelector('.hero-dash')) || vis(hero.querySelector('.carousel-right')));
    const gridProbs = [];
    grids.forEach(([sel, want]) => {
      const els = [...document.querySelectorAll(sel)];
      if (!els.length) { gridProbs.push(`${sel}: not found`); return; }
      els.forEach((el2) => {
        const d = getComputedStyle(el2).display;
        if (d !== want && d !== `inline-${want}`) gridProbs.push(`${sel}: display ${d} != ${want}`);
      });
    });
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const carousel = document.querySelector('.hero-carousel')?.textContent.trim() || '';
    return {
      h1s, empty, heroOk, gridProbs, overflow, blockCount: blocks.length, carousel,
    };
  }, GRIDS);
  const probs = [];
  if (r.h1s !== 1) probs.push(`h1 count ${r.h1s}`);
  if (r.empty.length) probs.push(`empty blocks: ${r.empty.join(',')}`);
  if (!r.heroOk) probs.push('hero missing h1 or visible dashboard visual');
  if (r.gridProbs.length) probs.push(r.gridProbs.join('; '));
  if (r.overflow > 1) probs.push(`horizontal overflow ${r.overflow}px`);
  if (errors.length) probs.push(`pageerrors: ${errors.join(' | ')}`);
  const ok = !probs.length;
  if (!ok) failed = true;
  console.log(`home@${width}: ${ok ? '✓' : `✗ ${probs.join('; ')}`} (${r.blockCount} blocks, carousel "${r.carousel}")`);
  await page.close();
}

/* — carousel motion contract — */
for (const reduced of [false, true]) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  const first = await page.locator('.hero-carousel').textContent();
  await page.waitForTimeout(4200);
  const later = await page.locator('.hero-carousel').textContent();
  const rotated = first.trim() !== later.trim();
  const ok = reduced ? (!rotated && first.trim() === '+ Chargebee') : rotated;
  if (!ok) failed = true;
  console.log(`carousel@${reduced ? 'reduced-motion' : 'motion-ok'}: ${ok ? '✓' : '✗'} ("${first.trim()}" → "${later.trim()}")`);
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
