/**
 * stardust/gen/misc.mjs — USERCASE, HELP-KB, TOOL and OPEN-DATA pages (Path A′).
 *
 * usercase (index)             masthead + cards[cases] linking the 3 stories
 * usercase-{localize,badgermaps,readme}
 *                              masthead h1 (story name) + captured prose
 *                              (Problem/Solution/Outcome, levels normalised
 *                              under the single h1)
 * help-kb-404                  help masthead + captured message + back link
 * help-kb-search-results       help masthead[search] — inert search chrome +
 *                              "results at launch" sr-note (no fabricated hits)
 * max-mrr, build-vs-buy        masthead + captured prose/sections; the
 *                              interactive calculators are NOT reproduced
 *                              (inert per the fragments rule), noted on-page
 * open-benchmarks              masthead[art] + ledger/stats treatment of the
 *                              server-rendered benchmark figures (verbatim)
 *
 * Run from the repo root: node stardust/gen/misc.mjs
 */
/* eslint-disable no-console */
import {
  readJson, write, page, metadata, section, block, row, prose, esc, escAttr, T,
  extract, withBrowser, ctaBand, HUB,
} from './lib.mjs';

const TRIAL = ['Get Baremetrics for your company', 'Start your free trial', 'https://app.baremetrics.com/users/sign_up'];

/* ── usercase index ──────────────────────────────────────────────────── */
async function usercaseIndex(pg) {
  const j = readJson('usercase');
  await pg.goto(`${HUB}/usercase`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pg.waitForTimeout(1800);
  const stories = await pg.evaluate(() => {
    const abs = (h) => { try { return new URL(h, location.href).href; } catch { return h; } };
    const bad = (e) => e.closest('header,footer,nav,[class*="header"],[class*="footer"],[class*="menu"],form');
    const nodes = [...document.querySelectorAll('img,p,a')].filter((e) => !bad(e));
    const out = [];
    let logo = null; let alt = ''; let teaser = '';
    nodes.forEach((e) => {
      if (e.tagName === 'IMG') { logo = abs(e.getAttribute('src') || ''); alt = e.getAttribute('alt') || ''; return; }
      if (e.tagName === 'P') { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (t.length > 30) teaser = t; return; }
      if (e.tagName === 'A') {
        const href = e.getAttribute('href') || '';
        const label = (e.textContent || '').replace(/\s+/g, ' ').trim();
        if (/\/usercase\/[a-z]/i.test(href) && /story/i.test(label)) {
          out.push({ logo, alt: alt.replace(/^Customer\s+/i, '').trim(), teaser, href: abs(href), label });
          teaser = '';
        }
      }
    });
    /* dedupe by href */
    const seen = new Set();
    return out.filter((s) => (seen.has(s.href) ? false : seen.add(s.href)));
  });
  console.log(`  usercase index: ${stories.length} stories`);
  const cards = stories.map((s) => row([
    s.logo ? `<img src="${escAttr(s.logo)}" alt="${escAttr(s.alt)}">` : '',
    `<h3>${esc(s.alt)}</h3>`,
    `<p>${esc(s.teaser)}</p>`,
    `<a href="${escAttr(s.href)}">${esc(s.label)}</a>`,
  ]));
  const sections = [
    metadata(j.title, j.description),
    block('masthead', [
      row([`<h1>${esc(j.headings[0]?.text || 'Powering over 800 amazing businesses.')}</h1>`]),
      row([`<p>${esc(T(j.body[0]) || j.description)}</p>`]),
    ]),
    `  <div>
    <h2>Customer stories</h2>
    <div class="cards cases">
${cards.join('\n')}
    </div>
  </div>`,
    ctaBand(...TRIAL),
  ];
  write('usercase.html', page(sections));
}

/* ── usercase story ──────────────────────────────────────────────────── */
async function usercaseStory(pg, slug, name) {
  const j = readJson(slug);
  let items = await extract(pg, `${HUB}/usercase/${name}`, { waitMs: 2200, wait: 'networkidle' });
  items = items.filter((it) => !(it.type === 'img' && /baremetrics-logo|stripe-verified|logo\.svg$/.test(it.src)));
  /* the story name is the first heading → h1; the first paragraph after = lede */
  const hIdx = items.findIndex((it) => it.type === 'heading');
  const h1 = hIdx >= 0 ? items[hIdx].text : (j.headings[0]?.text || j.title);
  let rest = items.slice(hIdx + 1);
  let lede = '';
  if (rest[0] && rest[0].type === 'p') { lede = rest[0].html; rest = rest.slice(1); }
  console.log(`  usercase/${name}: h1=${JSON.stringify(h1)} prose=${rest.length}`);
  const sections = [
    metadata(j.title, j.description),
    block('masthead', [row([`<h1>${esc(h1)}</h1>`]), lede ? row([`<p>${lede}</p>`]) : null].filter(Boolean)),
    section(prose(rest, { minHeading: 2, headingShift: -2 })),
    ctaBand(...TRIAL),
  ];
  write(`usercase/${name}.html`, page(sections));
}

/* ── help-kb-404 ─────────────────────────────────────────────────────── */
function help404() {
  const j = readJson('help-kb-404');
  const sections = [
    metadata(j.title, j.description),
    block('masthead', [row([`<h1>${esc(j.headings[0]?.text || 'Page not found')}</h1>`])]),
    section(`    <p>${esc(T(j.body[0]) || "We can't seem to find the page you're looking for.")}</p>
    <p><a href="https://baremetrics.com/">Back to Baremetrics</a></p>`),
  ];
  write('help/help-kb-404.html', page(sections));
  console.log('  help-kb-404: masthead + message + back link');
}

/* ── help-kb-search-results (inert search chrome) ────────────────────── */
function helpSearch() {
  const j = readJson('help-kb-search-results');
  const sections = [
    metadata(j.title, j.description),
    block('masthead search', [
      row(['<h1>Search results</h1>']),
      row(['How can we help you?', 'Search for answers', 'Search']),
      row(['<p>Search results appear at launch — the live help center search runs inside the hosted knowledge base and was not captured, so no results are listed here.</p>']),
    ]),
  ];
  write('help/help-kb-search-results.html', page(sections));
  console.log('  help-kb-search-results: help masthead[search] inert chrome + sr-note (no fabricated results)');
}

/* ── max-mrr (tool → prose; interactive widget inert) ────────────────── */
async function maxMrr(pg) {
  const j = readJson('max-mrr');
  let items = await extract(pg, `${HUB}/max-mrr`, { waitMs: 1800 });
  items = items.filter((it) => it.type !== 'img');
  /* h1 → masthead; the "Max MRR Calculator" kicker + formula lede precede it */
  const hIdx = items.findIndex((it) => it.type === 'heading' && it.level === 1);
  const h1 = hIdx >= 0 ? items[hIdx].text : (j.headings[0]?.text || j.title);
  const kicker = items.slice(0, hIdx).map((it) => (it.type === 'p' ? T(it.html.replace(/<[^>]+>/g, '')) : '')).filter(Boolean);
  let rest = items.slice(hIdx + 1).map((it) => (it.type === 'heading' ? { ...it, level: Math.max(2, it.level) } : it));
  /* the formula line is the lede */
  let lede = '';
  if (rest[0] && rest[0].type === 'p') { lede = rest[0].html; rest = rest.slice(1); }
  console.log(`  max-mrr: h1=${JSON.stringify(h1)} kicker=${kicker.length} prose=${rest.length}`);
  const mastRows = [];
  if (kicker[0]) mastRows.push(row([`<p>${esc(kicker[0])}</p>`])); // "Max MRR Calculator" kicker
  mastRows.push(row([`<h1>${esc(h1)}</h1>`]));
  if (lede) mastRows.push(row([`<p>${lede}</p>`]));
  const sections = [
    metadata(j.title, j.description),
    block('masthead', mastRows),
    section(`    <p><em>The interactive Max MRR calculator runs at launch; the model below explains the method.</em></p>
${prose(rest, { minHeading: 2 })}`),
    ctaBand(...TRIAL),
  ];
  write('max-mrr.html', page(sections));
}

/* ── build-vs-buy (tool → prose; calculator inert) ───────────────────── */
function buildVsBuy() {
  const j = readJson('build-vs-buy');
  const intro = T(j.body[0]);
  const sections = [
    metadata(j.title, j.description),
    block('masthead', [
      row([`<h1>${esc(j.headings[0]?.text || 'Build vs Buy Calculator')}</h1>`]),
      row([`<p>${esc(intro)}</p>`]),
    ]),
    section('    <p><em>The interactive Build vs Buy calculator runs at launch and is not reproduced here.</em></p>'),
    ctaBand(...TRIAL),
  ];
  write('build-vs-buy.html', page(sections));
  console.log('  build-vs-buy: masthead + intro + INERT calculator note + trial band');
}

/* ── open-benchmarks (captured server-rendered figures, verbatim) ────── */
function openBenchmarks() {
  const j = readJson('open-benchmarks');
  const ILLO = 'https://baremetrics.com/hubfs/Baremetrics_July2023/images/illustration-benchmarks';
  const cohort = [
    ['Lower Quartile', '$12,500'], ['Median MRR', '$40,500'], ['Upper Quartile', '$164,300'],
    ['Quick Ratio', '0.8'], ['Lifetime value', '$97'], ['User Churn', '6.4%'],
    ['Revenue Churn', '7.5%'], ['Revenue Growth', '5.0%'],
  ];
  const monthly = ['$99/mo', '$10/mo', '$100/mo', '$49/mo', '$50/mo', '$500/mo', '$20/mo', '$1/mo', '$29/mo', '$1,000/mo'];
  const annual = ['$120/yr', '$300/yr', '$99/yr', '$240/yr', '$600/yr', '$1,200/yr', '$180/yr', '$3,000/yr', '$5,000/yr', '$1,188/yr'];
  const pricingStats = [['Have free plan', '35'], ['Round the dollar', '72'], ['End with a 9', '17'], ['Average plans', '13']];
  const failCards = ['VISA', 'Mastercard', 'Discover', 'AMEX', 'Other'];
  const failReasons = ['Too Many Tries', 'Insufficent Funds', 'Incorrect Details', 'Card Expired', 'Declined'];

  const statBand = (headHtml, stats) => block('band tint stats', [
    ...(headHtml ? [row([headHtml])] : []),
    ...stats.map(([l, f]) => row([esc(l), esc(f)])),
  ]);
  const ol = (items) => `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`;
  const ul = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

  const sections = [
    metadata(j.title, j.description),
    block('masthead art', [
      row([`<img src="${ILLO}-left.png" alt="" width="1196" height="1226">`, `<img src="${ILLO}-right.png" alt="" width="1248" height="1240">`]),
      row(['<h1>Open Benchmarks</h1>']),
      row([`<p>${esc(T(j.body[0]))}</p>`]),
    ]),
    statBand('<h2>Cohort Analysis</h2><p>Metrics grouped by average revenue per user.</p>', cohort),
    `  <div>
    <h2>Pricing Models</h2>
    <p>What numbers are working the best.</p>
    <h3>Popular Monthly</h3>
    ${ol(monthly)}
    <h3>Popular Annual</h3>
    ${ol(annual)}
  </div>`,
    statBand('', pricingStats),
    `  <div>
    <h2>10% Lost Every Month</h2>
    <p>Where and why charges are failing.</p>
    <h3>Failing Cards</h3>
    ${ul(failCards)}
    <h3>Failing Reasons</h3>
    ${ul(failReasons)}
  </div>`,
    block('band tint form', [
      row(['<p>Join thousands of subscribers and get lessons on how to grow your startup.</p>']),
      row(['Email address', 'Enter your email to subscribe', 'Subscribe']),
    ]),
  ];
  write('open-benchmarks.html', page(sections));
  console.log('  open-benchmarks: masthead[art] + cohort/pricing/failing stats (captured figures verbatim)');
}

await withBrowser(async (pg) => {
  console.log('usercase:');
  await usercaseIndex(pg);
  await usercaseStory(pg, 'usercase-localize', 'localize');
  await usercaseStory(pg, 'usercase-badgermaps', 'badgermaps');
  await usercaseStory(pg, 'usercase-readme', 'readme');
  console.log('help-kb:');
  help404();
  helpSearch();
  console.log('tools:');
  await maxMrr(pg);
  buildVsBuy();
  console.log('open-data:');
  openBenchmarks();
});
console.log('misc.mjs done');
