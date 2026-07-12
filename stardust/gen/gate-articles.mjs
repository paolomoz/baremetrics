/* Playwright gate for the bulk article generator (4 samples). */
/* eslint-disable no-console */
import { chromium } from 'playwright';

const samples = [
  'blog-what-is-net-revenue-retention',
  'blog-new-metric-refunds',
  'academy-churn',
  'academy-charge-from-day-one',
];

const browser = await chromium.launch();
let anyFail = false;

for (const s of samples) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`http://localhost:3026/qa/gen/${s}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const out = {};
    out.h1Count = document.querySelectorAll('main h1').length;
    const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')]
      .map((h) => Number(h.tagName[1]));
    out.firstIsH1 = hs[0] === 1;
    let skip = false;
    for (let i = 1; i < hs.length; i += 1) if (hs[i] > hs[i - 1] + 1) skip = true;
    out.noSkip = !skip;
    out.headings = hs.join(',');

    const dc = document.querySelector('main .section.article-body .default-content');
    out.hasProse = !!dc && dc.querySelectorAll('p').length > 0;
    let interleave = false;
    if (dc) {
      const kids = [...dc.children];
      for (let i = 0; i < kids.length - 1; i += 1) {
        if (/^H[2-6]$/.test(kids[i].tagName)) {
          for (let j = i + 1; j < kids.length; j += 1) {
            if (kids[j].tagName === 'P') { interleave = true; break; }
            if (/^H[2-6]$/.test(kids[j].tagName)) break;
          }
          if (interleave) break;
        }
      }
      out.pCount = dc.querySelectorAll('p').length;
      out.hCount = dc.querySelectorAll('h2,h3,h4,h5,h6').length;
    }
    out.readingOrder = interleave || (dc && dc.querySelectorAll('h2,h3,h4,h5,h6').length === 0);

    const blocks = [...document.querySelectorAll('main [data-block-name]')];
    out.blocks = blocks.map((b) => ({
      name: b.dataset.blockName,
      decorated: b.childElementCount > 0,
      text: (b.textContent || '').replace(/\s+/g, ' ').trim().length,
    }));
    out.allBlocksOk = blocks.every((b) => b.childElementCount > 0 && (b.textContent || '').trim().length > 0);

    let measure = null;
    if (dc) {
      const cs = getComputedStyle(dc);
      const w = dc.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const probe = document.createElement('span');
      probe.textContent = '0';
      probe.style.font = cs.font || `${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
      probe.style.visibility = 'hidden';
      document.body.appendChild(probe);
      const cw = probe.getBoundingClientRect().width;
      probe.remove();
      measure = cw ? w / cw : null;
    }
    out.measureCh = measure ? Math.round(measure * 10) / 10 : null;

    out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  });

  const measureOk = r.measureCh == null || (r.measureCh >= 60 && r.measureCh <= 75);
  const pass = r.h1Count === 1 && r.firstIsH1 && r.noSkip && r.hasProse
    && r.readingOrder && r.allBlocksOk && measureOk && r.overflow <= 0 && errors.length === 0;
  if (!pass) anyFail = true;
  console.log(`\n=== ${s} === ${pass ? 'PASS' : 'FAIL'}`);
  console.log(`  h1Count=${r.h1Count} firstIsH1=${r.firstIsH1} noSkip=${r.noSkip} (${r.headings})`);
  console.log(`  prose: p=${r.pCount} h=${r.hCount} reading-order-interleave=${r.readingOrder}`);
  console.log(`  measureCh=${r.measureCh} (60-75 ${measureOk}) overflow=${r.overflow} pageerrors=${errors.length}`);
  console.log(`  blocks: ${r.blocks.map((b) => `${b.name}(${b.decorated ? 'ok' : 'EMPTY'},${b.text}ch)`).join(' ')}`);
  if (errors.length) console.log('  ERR:', errors.slice(0, 3));
  await page.close();
}

await browser.close();
console.log(`\nGATE ${anyFail ? 'FAILED' : 'PASSED'}`);
process.exit(anyFail ? 1 : 0);
