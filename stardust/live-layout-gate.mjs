import { chromium } from 'playwright';
const BASE = 'https://stardust-conversion--baremetrics--paolomoz.aem.live';
const paths = ['/','/pricing','/compare/profitwell-alternative','/features/recover','/stripe','/blog/customer-retention-metrics','/founder-chats/natalie-nagele','/customers','/about','/ltv-calc','/blog','/glossary','/experts','/open-startups','/help'];
const b = await chromium.launch();
let anyFail = false;
for (const path of paths) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [], badImgs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0,80)));
  const resp = await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => ({ status: () => 'ERR:'+e.message.slice(0,40) }));
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const blocks = [...document.querySelectorAll('main [data-block-name]')];
    const sections = document.querySelectorAll('main .section').length;
    const h1 = document.querySelectorAll('main h1').length;
    // blocks whose CSS intends grid/flex but compute block
    const stacked = [];
    let gridflex = 0;
    blocks.forEach(bl => {
      const kids = [...bl.querySelectorAll(':scope > *, :scope > * > *')];
      const hasGF = [bl, ...kids].some(el => { const d = getComputedStyle(el).display; return d === 'grid' || d === 'flex'; });
      if (hasGF) gridflex++;
    });
    const imgs = [...document.querySelectorAll('main img')];
    const broken = imgs.filter(im => im.complete && im.naturalWidth === 0).map(im => im.src.split('/').pop().slice(0,30));
    return { blocks: blocks.length, decorated: blocks.filter(x=>x.dataset.blockName).length, sections, h1, gridflex, imgTotal: imgs.length, broken };
  });
  const status = typeof resp.status === 'function' ? resp.status() : resp.status;
  const fail = status !== 200 || r.sections === 0 || r.h1 !== 1 || r.gridflex === 0 || r.decorated !== r.blocks || errs.length;
  if (fail) anyFail = true;
  console.log(`${(status+'').padEnd(4)} ${path.padEnd(38)} sec:${r.sections} h1:${r.h1} blocks:${r.decorated}/${r.blocks} gridflex:${r.gridflex} img:${r.imgTotal} broken:${r.broken.length} errs:${errs.length}${fail?'  <== FAIL':''}`);
  if (r.broken.length) console.log('      broken imgs:', r.broken.slice(0,5).join(', '));
  if (errs.length) console.log('      errs:', errs.slice(0,3).join(' | '));
  await p.close();
}
await b.close();
console.log(anyFail ? '\nSOME PAGES FAILED THE LIVE LAYOUT GATE' : '\nALL 15 LIVE PAGES PASS: 200, 1 h1, sections>0, blocks decorated, grids compute, no pageerrors');
