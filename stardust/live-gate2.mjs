import { chromium } from 'playwright';
const B='https://stardust-conversion--baremetrics--paolomoz.aem.live';
const paths=['/','/pricing','/features/metrics','/features/recover','/chargebee','/recurly','/compare/chartmogul-alternative','/compare/mrrio-alternative','/blog/what-is-net-revenue-retention','/blog/remote-focus','/academy/churn','/academy/market-size','/founder-chats/aaron-epstein','/founder-chats/brennan-dunn','/customers/how-huntr-doubled-revenue-4-years-straight-while-pivoting-twice','/experts/design','/experts/marketing-sales','/wall-of-love','/gdpr','/open-benchmarks','/jp/blog/saas-business-model','/ja/features/api','/ja/privacy','/academy','/founder-chats'];
const b=await chromium.launch(); let fail=0;
for (const path of paths){
  const p=await b.newPage({viewport:{width:1440,height:1000}}); const errs=[];
  p.on('pageerror',e=>errs.push(e.message.slice(0,50)));
  const resp=await p.goto(B+path,{waitUntil:'networkidle',timeout:45000}).catch(e=>({status:()=>'ERR'}));
  await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>{
    const bl=[...document.querySelectorAll('main [data-block-name]')];
    let gf=0; bl.forEach(x=>{if([x,...x.querySelectorAll('*')].some(e=>['grid','flex'].includes(getComputedStyle(e).display)))gf++;});
    const imgs=[...document.querySelectorAll('main img')];
    return {sec:document.querySelectorAll('main .section').length,h1:document.querySelectorAll('main h1').length,bl:bl.length,gf,broken:imgs.filter(i=>i.complete&&i.naturalWidth===0).length,img:imgs.length};
  });
  const st=typeof resp.status==='function'?resp.status():resp.status;
  const bad=st!==200||r.sec===0||r.h1!==1||r.gf===0||errs.length;
  if(bad)fail++;
  console.log(`${st} ${path.slice(0,40).padEnd(40)} sec:${r.sec} h1:${r.h1} blk:${r.bl} gf:${r.gf} img:${r.img} broken:${r.broken} err:${errs.length}${bad?' <FAIL':''}`);
  await p.close();
}
await b.close(); console.log(fail?`\n${fail} FAILED`:'\nALL '+paths.length+' LIVE PAGES PASS (200, one h1, sections>0, grids compute, no pageerrors)');
