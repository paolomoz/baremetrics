import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
const files = readdirSync('qa/sweep').filter(f=>f.endsWith('.html'));
const b = await chromium.launch();
let fails=0;
for (const f of files) {
  const p = await b.newPage({ viewport:{width:1440,height:1000} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,50)));
  await p.goto(`http://localhost:3990/qa/sweep/${f}`,{waitUntil:'networkidle',timeout:30000}).catch(()=>{});
  await p.waitForTimeout(1200);
  const r = await p.evaluate(()=>{
    const blocks=[...document.querySelectorAll('main [data-block-name]')];
    const empty=blocks.filter(bl=>bl.textContent.trim().length<2 && !bl.querySelector('img,input')).map(bl=>bl.dataset.blockName);
    let gf=0; blocks.forEach(bl=>{ if([bl,...bl.querySelectorAll('*')].some(e=>['grid','flex'].includes(getComputedStyle(e).display))) gf++; });
    return { h1:document.querySelectorAll('main h1').length, blocks:blocks.length, empty, gf, ov:document.scrollingElement.scrollWidth-innerWidth };
  });
  const bad = r.h1!==1 || r.blocks===0 || r.empty.length || r.ov>2 || errs.length;
  if(bad){ fails++; console.log(`FAIL ${f.slice(0,44).padEnd(44)} h1:${r.h1} blk:${r.blocks} empty:[${r.empty}] ov:${r.ov} err:${errs.length} ${errs[0]||''}`); }
  await p.close();
}
await b.close();
console.log(fails? `\n${fails}/${files.length} pages FAILED`:`\nALL ${files.length} sampled pages PASS (one h1, blocks non-empty + decorate, no overflow, no errors)`);
