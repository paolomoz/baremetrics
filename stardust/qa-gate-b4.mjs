#!/usr/bin/env node
/**
 * stardust/qa-gate-b4.mjs — Wave-B4 harness assertions (blog article +
 * founder-chats episode). Serve the repo root first, then:
 *   node stardust/qa-gate-b4.mjs [port]
 *
 * Per page: exactly one h1; heading outline has no level skips; every #anchor
 * resolves; prose measure 60–75ch at 1440; rail sits left of the prose at
 * 1440; no horizontal overflow at 360/1440; zero pageerrors. Founder-chats:
 * 128 turns / 142 paragraphs, and the turn grouping (speaker + paragraph
 * count + byte-identical innerHTML sequence) equals the prototype's.
 * Also reports the JS-off state (foundation-level: ak.js reveals sections).
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';

const PORT = process.argv[2] || 4173;
const PROTO = 'http://localhost:8791';

const PAGES = [
  { slug: 'customer-retention-metrics', proto: 'blog-customer-retention-metrics-proposed.html', proseSel: '.article-body > .default-content' },
  { slug: 'natalie-nagele', proto: 'founder-chats-natalie-nagele-proposed.html', proseSel: '.article-body .transcript', transcript: true },
];

const browser = await chromium.launch();
let failed = false;
const flag = (slug, width, msg) => { failed = true; console.log(`✗ ${slug}@${width}: ${msg}`); };

for (const spec of PAGES) {
  /* prototype turn model (founder) */
  let protoTurns = null;
  if (spec.transcript) {
    const p = await browser.newPage();
    await p.goto(`${PROTO}/${spec.proto}`, { waitUntil: 'domcontentloaded' });
    protoTurns = await p.evaluate(() => [...document.querySelectorAll('[data-section="transcript"] .turn')]
      .map((t) => ({
        speaker: t.dataset.speaker,
        paras: [...t.querySelectorAll('p')].map((x) => x.innerHTML.trim()),
      })));
    await p.close();
  }

  for (const width of [360, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/qa/${spec.slug}.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const r = await page.evaluate((proseSel) => {
      const h1s = document.querySelectorAll('h1').length;
      const levels = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')]
        .map((h) => Number(h.tagName[1]));
      let skip = null;
      levels.reduce((prev, l) => { if (l > prev + 1) skip = `${prev}→${l}`; return l; }, 0);
      const unresolved = [...document.querySelectorAll('main a[href^="#"]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => h.length > 1 && !document.getElementById(decodeURIComponent(h.slice(1))));
      const prose = document.querySelector(proseSel);
      let measureCh = null;
      let railLeftOfProse = null;
      if (prose) {
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:17px var(--body-font-family)';
        probe.textContent = '0';
        document.body.appendChild(probe);
        measureCh = prose.getBoundingClientRect().width / probe.getBoundingClientRect().width;
        probe.remove();
        const rail = document.querySelector('.toc .toc-rail');
        if (rail) {
          const rb = rail.getBoundingClientRect();
          const pb = prose.getBoundingClientRect();
          railLeftOfProse = rb.width > 0 ? rb.right <= pb.left : null;
        }
      }
      const turns = [...document.querySelectorAll('.transcript .turn')].map((t) => ({
        speaker: t.dataset.speaker,
        paras: [...t.querySelectorAll('p')].map((x) => x.innerHTML.trim()),
      }));
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const blocks = [...document.querySelectorAll('main [data-block-name]')];
      const empty = blocks.filter((b) => !b.childElementCount).map((b) => b.dataset.blockName);
      return { h1s, skip, unresolved, measureCh, railLeftOfProse, turns, overflow, empty, blockCount: blocks.length };
    }, spec.proseSel);

    if (r.h1s !== 1) flag(spec.slug, width, `h1 count ${r.h1s}`);
    if (r.skip) flag(spec.slug, width, `heading outline skip ${r.skip}`);
    if (r.unresolved.length) flag(spec.slug, width, `unresolved anchors: ${r.unresolved.join(' ')}`);
    if (r.empty.length) flag(spec.slug, width, `empty blocks: ${r.empty.join(',')}`);
    if (r.overflow > 1) flag(spec.slug, width, `horizontal overflow ${r.overflow}px`);
    if (errors.length) flag(spec.slug, width, `pageerrors: ${errors.join(' | ')}`);
    if (width === 1440) {
      if (!r.measureCh || r.measureCh < 60 || r.measureCh > 75) flag(spec.slug, width, `prose measure ${r.measureCh?.toFixed(1)}ch (want 60–75)`);
      if (r.railLeftOfProse === false) flag(spec.slug, width, 'rail not left of prose');
    }
    if (spec.transcript) {
      const nParas = r.turns.reduce((n, t) => n + t.paras.length, 0);
      if (r.turns.length !== 128) flag(spec.slug, width, `turn count ${r.turns.length} != 128`);
      if (nParas !== 142) flag(spec.slug, width, `paragraph count ${nParas} != 142`);
      const mism = [];
      protoTurns.forEach((pt, i) => {
        const et = r.turns[i];
        if (!et) { mism.push(`turn ${i} missing`); return; }
        if (pt.speaker !== et.speaker) mism.push(`turn ${i} speaker ${et.speaker} != ${pt.speaker}`);
        if (pt.paras.length !== et.paras.length) mism.push(`turn ${i} paras ${et.paras.length} != ${pt.paras.length}`);
        else pt.paras.forEach((html, j) => { if (html !== et.paras[j]) mism.push(`turn ${i} para ${j} differs`); });
      });
      if (mism.length) flag(spec.slug, width, `turn grouping: ${mism.slice(0, 5).join('; ')}${mism.length > 5 ? ` (+${mism.length - 5})` : ''}`);
      else if (width === 1440) console.log(`  ${spec.slug}: transcript 142/142 paragraphs byte-identical, 128/128 turns, speaker attachment exact`);
    }
    console.log(`${spec.slug}@${width}: ${errors.length || r.h1s !== 1 ? 'see flags' : '✓'} (${r.blockCount} blocks, measure ${r.measureCh?.toFixed(1)}ch, overflow ${r.overflow}px)`);
    await page.close();
  }

  /* JS-off probe (foundation-level report, not a pass/fail of this page) */
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await ctx.newPage();
  await noJs.goto(`http://localhost:${PORT}/qa/${spec.slug}.html`, { waitUntil: 'domcontentloaded' });
  const visibleText = await noJs.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return 0;
    let n = 0;
    const walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const el = walk.currentNode.parentElement;
      if (el && el.checkVisibility() && walk.currentNode.textContent.trim()) n += 1;
    }
    return n;
  });
  console.log(`  ${spec.slug} JS-off: ${visibleText} visible text nodes ${visibleText ? '(readable)' : '(main hidden — foundation main>div rule, site-wide)'}`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '✗ B4 harness gate FAILED' : '✓ B4 harness gate passed');
process.exit(failed ? 1 : 0);
