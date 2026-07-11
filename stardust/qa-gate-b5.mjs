#!/usr/bin/env node
/**
 * stardust/qa-gate-b5.mjs — Wave-B5 gate 2: local harness render assertions
 * for customers / about / ltv-calc (qa/*.html on a local server).
 * Per page: exactly one h1; grids/flex compute; blocks non-empty; no
 * horizontal overflow at 360/1440; zero pageerrors; JS-off readable.
 * Page-specific: roster 11 people (FM monogram); cases 6 story units all
 * with imgs; stats 4 em-dash figures; calculator 24 readonly inputs +
 * 3 inert switches + the metrics table scrolls INTERNALLY at 360.
 * Usage: node stardust/qa-gate-b5.mjs  (server on :4055 serving repo root)
 */
/* eslint-disable no-console, no-await-in-loop */
import { chromium } from 'playwright';

const PORT = 4055;

const CHECKS = {
  customers: async (page) => {
    const probs = [];
    const units = await page.evaluate(() => {
      const cases = [...document.querySelectorAll('.cards.cases .case-lead, .cards.cases .entry')];
      return { count: cases.length, withImg: cases.filter((c) => c.querySelector('img')).length };
    });
    if (units.count !== 6) probs.push(`case units ${units.count} != 6`);
    if (units.withImg !== 6) probs.push(`case units with img ${units.withImg} != 6`);
    const labels = await page.evaluate(() => [...document.querySelectorAll('.cards.cases .surface-link')]
      .filter((a) => !a.getAttribute('aria-label')).length);
    if (labels) probs.push(`${labels} story links missing aria-label`);
    const pull = await page.locator('.masthead h1 em').count();
    if (pull !== 1) probs.push(`h1 counter pull count ${pull} != 1`);
    const logos = await page.locator('.logos .logo-table li').count();
    if (logos !== 10) probs.push(`logo cells ${logos} != 10`);
    return probs;
  },
  about: async (page) => {
    const probs = [];
    const roster = await page.evaluate(() => ({
      people: document.querySelectorAll('.cards.roster .person').length,
      monogram: document.querySelector('.cards.roster .person-monogram')?.textContent.trim() || null,
      mails: document.querySelectorAll('.cards.roster .person-mail').length,
    }));
    if (roster.people !== 11) probs.push(`roster people ${roster.people} != 11`);
    if (roster.monogram !== 'FM') probs.push(`FM monogram missing (got ${roster.monogram})`);
    if (roster.mails !== 11) probs.push(`person mails ${roster.mails} != 11`);
    const stats = await page.evaluate(() => [...document.querySelectorAll('.band.stats .stat dd .figure')]
      .map((f) => f.textContent.trim()));
    if (stats.length !== 4 || stats.some((s) => s !== '—')) probs.push(`stats figures ${JSON.stringify(stats)} != 4 em-dashes`);
    const careers = await page.locator('#careers').count();
    if (careers !== 1) probs.push(`#careers anchor count ${careers} != 1`);
    return probs;
  },
  'ltv-calc': async (page, width) => {
    const probs = [];
    const calc = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('.calculator .cell-input')];
      const switches = [...document.querySelectorAll('.calculator [role="switch"]')];
      const scroll = document.querySelector('.calculator .metrics-scroll');
      return {
        inputs: inputs.length,
        readonly: inputs.filter((i) => i.readOnly && i.getAttribute('aria-readonly') === 'true').length,
        switches: switches.length,
        inert: switches.filter((s) => s.getAttribute('aria-checked') === 'false' && s.getAttribute('aria-readonly') === 'true').length,
        scrollable: scroll ? scroll.scrollWidth > scroll.clientWidth : null,
        scrollFocusable: scroll ? scroll.getAttribute('tabindex') === '0' && scroll.getAttribute('role') === 'region' : false,
        srNote: document.querySelectorAll('#calc-note').length,
      };
    });
    if (calc.inputs !== 24) probs.push(`cell inputs ${calc.inputs} != 24`);
    if (calc.readonly !== 24) probs.push(`readonly inputs ${calc.readonly} != 24`);
    if (calc.switches !== 3) probs.push(`switches ${calc.switches} != 3`);
    if (calc.inert !== 3) probs.push(`inert switches ${calc.inert} != 3`);
    if (!calc.scrollFocusable) probs.push('metrics-scroll not a keyboard-reachable region');
    if (calc.srNote !== 1) probs.push(`sr-note count ${calc.srNote} != 1`);
    if (width === 360 && calc.scrollable !== true) probs.push('metrics table does NOT scroll internally at 360');
    return probs;
  },
};

const browser = await chromium.launch();
let failed = false;

for (const [slug, extra] of Object.entries(CHECKS)) {
  for (const width of [360, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/qa/${slug}.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const h1s = document.querySelectorAll('h1').length;
      const blocks = [...document.querySelectorAll('main [data-block-name]')];
      const empty = blocks.filter((b) => !b.childElementCount).map((b) => b.dataset.blockName);
      const gridsFlexed = [];
      blocks.forEach((b) => {
        b.querySelectorAll('*').forEach((n) => {
          const d = getComputedStyle(n).display;
          if (d === 'grid' || d === 'flex' || d === 'inline-flex' || d === 'inline-grid') gridsFlexed.push(n.className);
        });
      });
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { h1s, empty, gridFlexCount: gridsFlexed.length, overflow, blockCount: blocks.length };
    });
    const probs = [];
    if (r.h1s !== 1) probs.push(`h1 count ${r.h1s}`);
    if (r.empty.length) probs.push(`empty blocks: ${r.empty.join(',')}`);
    if (!r.gridFlexCount) probs.push('no grid/flex containers computed');
    if (r.overflow > 1) probs.push(`horizontal overflow ${r.overflow}px`);
    if (errors.length) probs.push(`pageerrors: ${errors.join(' | ')}`);
    probs.push(...await extra(page, width));
    const ok = !probs.length;
    if (!ok) failed = true;
    console.log(`${slug}@${width}: ${ok ? '✓' : `✗ ${probs.join('; ')}`} (${r.blockCount} blocks, ${r.gridFlexCount} grid/flex nodes)`);
    await page.close();
  }
  /* Block-JS-off readable: when every block's decorate fails to load, the raw
     authored rows must still expose the page's copy (progressive readability
     of the AUTHORED shapes). NOTE: full noscript is dark site-wide — the
     Wave-A foundation hides `main > div` until ak.js adds .section; that is a
     foundation-level finding, not a per-page one (reported). */
  const noJs = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await noJs.route('**/blocks/**/*.js', (route) => route.abort());
  await noJs.goto(`http://localhost:${PORT}/qa/${slug}.html`, { waitUntil: 'networkidle' });
  await noJs.waitForTimeout(400);
  const visible = await noJs.evaluate(() => {
    const h1s = document.querySelectorAll('h1').length;
    const textLen = (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').length;
    return { h1s, textLen };
  });
  const jsOffOk = visible.h1s === 1 && visible.textLen > 200;
  if (!jsOffOk) failed = true;
  console.log(`${slug}@block-js-off: ${jsOffOk ? '✓' : '✗'} (${visible.textLen} chars readable, ${visible.h1s} h1)`);
  await noJs.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
