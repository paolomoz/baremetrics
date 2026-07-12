/* Playwright gate for the localized (ja/jp) mirror router — 5 samples across
   templates. Serves the repo root on an ephemeral port and asserts per page:
   one h1, Japanese/CJK body text rendered, blocks decorate + non-empty,
   no heading-level jumps, 0 overflow @1440, 0 pageerrors, mirrored output path. */
/* eslint-disable no-console */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const fp = path.join(ROOT, rel);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => { server.listen(0, r); });
const BASE = `http://localhost:${server.address().port}`;

/* harness → mirrored content path (asserts output mirrors source URL).
   expectCJK: Japanese-content templates carry CJK body text; episode
   transcripts and legal policies are English in the SOURCE (Founder Chats is an
   English podcast; the JP privacy page serves the identical English policy —
   verbatim), so those require rendered body text but not CJK. */
const samples = [
  { name: 'jp/blog/churn (article)', harness: 'qa/gen/loc-jp-blog-churn.html', content: 'content/jp/blog/churn.html', expectCJK: true },
  { name: 'ja/academy/churn (article)', harness: 'qa/gen/loc-ja-academy-churn.html', content: 'content/ja/academy/churn.html', expectCJK: true },
  { name: 'jp/founder-chats/ankur-nagpal (episode)', harness: 'qa/gen/loc-jp-founder-ankur.html', content: 'content/jp/founder-chats/ankur-nagpal.html', expectCJK: false },
  { name: 'ja/features/api (feature)', harness: 'qa/gen/loc-ja-features-api.html', content: 'content/ja/features/api.html', expectCJK: true },
  { name: 'ja/privacy (static/legal, English-source policy)', harness: 'qa/gen/loc-ja-privacy.html', content: 'content/ja/privacy.html', expectCJK: false },
];

const browser = await chromium.launch();
let anyFail = false;

for (const s of samples) {
  const pathOk = fs.existsSync(path.join(ROOT, s.content));
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/${s.harness}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const out = {};
    out.h1Count = document.querySelectorAll('main h1').length;
    const hs = [...document.querySelectorAll('main h1,main h2,main h3,main h4,main h5,main h6')].map((h) => Number(h.tagName[1]));
    out.firstIsH1 = hs[0] === 1;
    let skip = false;
    for (let i = 1; i < hs.length; i += 1) if (hs[i] > hs[i - 1] + 1) skip = true;
    out.noSkip = !skip;
    out.headings = hs.join(',');

    const bodyText = (document.querySelector('main') || document).textContent || '';
    out.cjk = (bodyText.match(/[぀-ヿ一-鿿]/g) || []).length;
    out.textLen = bodyText.replace(/\s+/g, ' ').trim().length;

    const blocks = [...document.querySelectorAll('main [data-block-name]')];
    out.blocks = blocks.map((b) => ({ name: b.dataset.blockName, decorated: b.childElementCount > 0, text: (b.textContent || '').trim().length }));
    out.allBlocksOk = blocks.every((b) => b.childElementCount > 0 && (b.textContent || '').trim().length > 0);

    out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return out;
  });

  const textOk = s.expectCJK ? (r.cjk > 5 && r.textLen > 50) : (r.textLen > 50);
  const pass = pathOk && r.h1Count === 1 && r.firstIsH1 && r.noSkip
    && textOk && r.allBlocksOk && r.overflow <= 0 && errors.length === 0;
  if (!pass) anyFail = true;
  console.log(`\n=== ${s.name} === ${pass ? 'PASS' : 'FAIL'}`);
  console.log(`  outputPathMirrorsURL=${pathOk} (${s.content})`);
  console.log(`  h1Count=${r.h1Count} firstIsH1=${r.firstIsH1} noSkip=${r.noSkip} (${r.headings})`);
  console.log(`  bodyText=${textOk ? 'ok' : 'MISSING'} CJK=${r.cjk}${s.expectCJK ? ' (required)' : ' (English-source)'} textLen=${r.textLen} overflow=${r.overflow} pageerrors=${errors.length}`);
  console.log(`  blocks: ${r.blocks.map((b) => `${b.name}(${b.decorated ? 'ok' : 'EMPTY'},${b.text}ch)`).join(' ')}`);
  if (errors.length) console.log('  ERR:', errors.slice(0, 3));
  await page.close();
}

await browser.close();
server.close();
console.log(`\nGATE ${anyFail ? 'FAILED' : 'PASSED'}`);
process.exit(anyFail ? 1 : 0);
