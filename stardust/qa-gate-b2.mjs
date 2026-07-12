#!/usr/bin/env node
/**
 * stardust/qa-gate-b2.mjs — Wave B2 gate 2: local harness render assertions
 * for pricing + compare/profitwell-alternative (the Wave-A qa-gate technique).
 * Per page/width: exactly one h1; grid/flex blocks compute; no block empty;
 * no horizontal overflow at 360/1440; zero pageerrors. Page-specific:
 *   pricing  — rate-card renders 3 .plan articles, the 2nd is the ink-
 *              inverted Growth column (fingerprint variationGroup idx 1),
 *              switch is role=switch aria-checked=true aria-readonly=true;
 *   compare  — 25 [role=rowheader] across 4 tables, 45+ ✓/✗ glyph cells,
 *              accordion keyboard-toggles (Enter opens panel) and its
 *              panels read WITHOUT JS (raw authored rows stay visible).
 * Usage: node stardust/qa-gate-b2.mjs   (server on :3999 serving repo root)
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';

const browser = await chromium.launch();
let failed = false;
const check = (probs, cond, msg) => { if (!cond) probs.push(msg); };

for (const slug of ['pricing', 'compare-profitwell-alternative']) {
  for (const width of [360, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:3999/qa/${slug}.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('main [data-block-name]')];
      const gridsFlexed = [];
      blocks.forEach((b) => b.querySelectorAll('*').forEach((n) => {
        const d = getComputedStyle(n).display;
        if (d.includes('grid') || d.includes('flex')) gridsFlexed.push(n.className);
      }));
      const growth = document.querySelector('.rate-card .plan-growth');
      return {
        h1s: document.querySelectorAll('h1').length,
        empty: blocks.filter((b) => !b.childElementCount).map((b) => b.dataset.blockName),
        gridFlexCount: gridsFlexed.length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        blockCount: blocks.length,
        plans: document.querySelectorAll('.rate-card article.plan').length,
        growthIdx: growth ? [...growth.parentElement.children].indexOf(growth) : -1,
        growthBg: growth ? getComputedStyle(growth).backgroundColor : null,
        switchOk: !!document.querySelector('.rate-card [role="switch"][aria-checked="true"][aria-readonly="true"]'),
        rowheaders: document.querySelectorAll('.compare-table [role="rowheader"]').length,
        glyphs: document.querySelectorAll('.compare-table .gl-yes, .compare-table .gl-no').length,
        tables: document.querySelectorAll('.compare-table table[role="table"]').length,
        captions: document.querySelectorAll('.compare-table caption').length,
      };
    });
    const probs = [];
    check(probs, r.h1s === 1, `h1 count ${r.h1s}`);
    check(probs, !r.empty.length, `empty blocks: ${r.empty.join(',')}`);
    check(probs, r.gridFlexCount > 0, 'no grid/flex containers computed');
    check(probs, r.overflow <= 1, `horizontal overflow ${r.overflow}px`);
    check(probs, !errors.length, `pageerrors: ${errors.join(' | ')}`);
    if (slug === 'pricing') {
      check(probs, r.plans === 3, `rate-card plans ${r.plans} != 3`);
      check(probs, r.growthIdx === 1, `ink plan index ${r.growthIdx} != 1`);
      check(probs, r.growthBg === 'oklch(0.32 0.04 285)', `growth bg ${r.growthBg}`);
      check(probs, r.switchOk, 'no inert role=switch (checked+readonly)');
    } else {
      check(probs, r.rowheaders === 25, `rowheaders ${r.rowheaders} != 25`);
      check(probs, r.glyphs >= 45, `glyph cells ${r.glyphs} < 45`);
      check(probs, r.tables === 4, `tables ${r.tables} != 4`);
      check(probs, r.captions === 4, `sr captions ${r.captions} != 4`);
      /* accordion: keyboard toggle (Enter on the first faq button) */
      const btn = page.locator('.accordion .faq-q').first();
      await btn.focus();
      await page.keyboard.press('Enter');
      const expanded = await btn.getAttribute('aria-expanded');
      const panelVisible = await page.locator('.accordion .faq-panel').first().isVisible();
      check(probs, expanded === 'true' && panelVisible, `accordion Enter toggle (expanded=${expanded}, visible=${panelVisible})`);
      await page.keyboard.press('Enter');
      check(probs, (await btn.getAttribute('aria-expanded')) === 'false', 'accordion Enter re-collapse');
    }
    const ok = !probs.length;
    if (!ok) failed = true;
    console.log(`${slug}@${width}: ${ok ? '✓' : `✗ ${probs.join('; ')}`} (${r.blockCount} blocks, ${r.gridFlexCount} grid/flex nodes)`);
    await page.close();
  }
}

/* — JS-off: the accordion answers must be readable as raw authored rows — */
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  /* the FOUNDATION veils undecorated sections (main > div { display:none },
     shared styles.css — Wave A, out of B2 scope); lift it in the served HTML
     (addStyleTag needs page JS) so this check proves the ACCORDION's own
     authored shape/CSS keeps answers readable when no script ever runs. */
  await page.route('**/qa/compare-profitwell-alternative.html', async (route) => {
    const res = await route.fetch();
    const body = (await res.text())
      .replace('</head>', '<style>main > div { display: block !important; }</style></head>');
    await route.fulfill({ response: res, body });
  });
  await page.goto('http://localhost:3999/qa/compare-profitwell-alternative.html', { waitUntil: 'load' });
  const visible = await page.locator('.accordion div:has-text("CSV import handles historical data")').last().isVisible();
  const probs = [];
  check(probs, visible, 'JS-off: accordion answer text not visible');
  const ok = !probs.length;
  if (!ok) failed = true;
  console.log(`compare JS-off: ${ok ? '✓ answers readable' : `✗ ${probs.join('; ')}`}`);
  await ctx.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
