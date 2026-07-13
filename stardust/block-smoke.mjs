#!/usr/bin/env node
/**
 * stardust/block-smoke.mjs — Wave-A library smoke test.
 * Inlines each block's JS (round-trip harness technique: no module imports),
 * decorates synthetic authored content for EVERY variant, and asserts:
 * decorate ran without throwing, block is non-empty, no pageerrors.
 * Usage: node stardust/block-smoke.mjs
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';
import fs from 'fs';

const IMG = '<img src="https://baremetrics.com/hubfs/x.png" width="100" height="50" alt="">';
const row = (...cells) => `<div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;

const CASES = {
  'masthead|masthead': row('<h1>Title</h1>') + row('<p>A lede paragraph that is long enough to be a lede.</p>'),
  'masthead|masthead form': row('<h1>T</h1>') + row('<p>Lede text that is long enough to read as a lede here.</p>') + row('<p>Subscribe line</p>') + row('Email address', 'Enter your email', 'Subscribe') + row('<p><a href="/a">A</a> <a href="/b">B</a> <strong><a href="/c">C</a></strong></p><p>9 things</p>'),
  'masthead|masthead search': row('<h1>T</h1>') + row('How can we help?', 'Search for answers', 'Search') + row('<p>Search will be active at launch — a long inert note sentence.</p>'),
  'masthead|masthead art': row(IMG, IMG) + row('<h1>T</h1>') + row('<p>A lede paragraph that is long enough to be a lede.</p>'),
  'ledger|ledger entries': row('All entries', '2 entries') + row('01', 'June 1, 2020', '<h2>Lead</h2><p>Teaser</p>', '<a href="/l">Continue Reading</a>') + row('02', '<h3>Row</h3><p>Teaser</p>', '<a href="/r">Continue Reading</a>') + row('Previous', 'Page 1', 'Next', 'Pagination active at launch.'),
  'ledger|ledger terms': row('A') + row('<h3>Alpha Term</h3>', '<a href="/t">Continue Reading</a>'),
  'ledger|ledger experts': row(IMG, '<h3>Name</h3><p>Design</p><p>Longer description text.</p>', '<a href="/e">Click to learn more</a>') + row(`<em>${IMG}</em>`, '<h3>Chip Co</h3><p>Design</p><p>Desc.</p>', '<a href="/e2">Click to learn more</a>') + row('Wordmark Co', '<h3>Wordmark Co</h3><p>Design</p><p>Desc.</p>', '<a href="/e3">Click to learn more</a>'),
  'ledger|ledger revenue': row(IMG, '<h3>rb2b</h3><p>Desc</p>', '<p>Monthly Revenue</p><p>$1,234</p>', '<a href="/r">rb2b</a>'),
  'ledger|ledger publications': row('October 1, 2024', '<a href="/p">A Publication Title</a>') + row('Industry insights to your inbox', 'Enter your email', 'Subscribe'),
  'ledger|ledger collections': row('<a href="/c">Browse all collections</a>', 'help.example.com'),
  'band|band tint cta quiet': row('<p>Support</p>') + row('<p><strong><a href="mailto:x@y.z">Contact us</a></strong></p>'),
  'band|band tint form': row('<p>Join thousands of subscribers and get lessons on growing.</p>') + row('Email address', 'Enter your email', 'Subscribe'),
  'band|band ink cta split': row('<p>Recover</p>') + row('<h2>Big ask headline</h2><p>A supporting lede that is long enough to be one.</p>') + row('<p><strong><a href="/t">Start your free trial</a></strong></p>') + row(IMG) + row('Be honest', 'Get deep insights to grow'),
  'band|band ink stats': row('<h2>Head</h2><p>A mission lede that is long enough to be one here.</p>') + row('Years Old', '—', 'figure not captured') + row('People', '—') + row('Customers', '12') + row('Satisfaction', '99%'),
  'band|band ink author': row(IMG) + row('<p>Written by</p>') + row('<h2>Josh Pigford</h2><p>A long author bio paragraph goes right here for the strip.</p>'),
  'cards|cards cases': row(IMG, '<p>Case Studies</p><h2>Lead Story</h2><p>Lead teaser text.</p>', '<a href="/s">Continue Reading</a>') + row(IMG, '<p>Case Studies</p><h3>Entry One</h3><p>Teaser.</p>', '<a href="/1">Read</a>') + row(IMG, '<h3>Entry Two</h3><p>Teaser.</p>', '<a href="/2">Read</a>'),
  'cards|cards triptych': row('<h3>Col A</h3><p>Body</p>', '<a href="/a">Open the live view</a>', IMG) + row('<h3>Col B</h3><p>Body</p>', '<a href="/b">See numbers</a>', IMG) + row('<h3>Col C</h3><p>Body</p>', '<a href="/c">Run it</a>', IMG),
  'cards|cards mosaic': row('<h3>A</h3><p>Body</p>', '<a href="/a">See how you compare</a>', IMG) + row('<h3>B</h3><p>Body</p>', IMG) + row('<h3>C</h3><p>Body</p>', '<a href="/c">Watch</a>', IMG),
  'cards|cards roster': row(IMG, '<h3>Jane Doe</h3><p>CEO</p><p><a href="mailto:j@x.y">j@x.y</a></p>') + row('FM', '<h3>Felipe Maier</h3><p>Engineer</p><p><a href="mailto:f@x.y">f@x.y</a></p>'),
  'cards|cards filmstrip': row(IMG + IMG + IMG),
  'cards|cards cohort': row(`${IMG}<code>rgba(0, 0, 0,1.0)</code>`, '<p>Developer Tools</p><h3>Acme</h3><p>A blurb that is long enough to read as one.</p>', '<a href="https://acme.io/">Click to learn more</a>') + row(IMG, '<h3>Beta Co</h3><p>Another blurb long enough to read here.</p>', '<a href="https://beta.io/">Click to learn more</a>'),
  'quote|quote sheet': row('Customer record · Later') + row('<p>A long enough quote to be the blockquote text of the sheet.</p>') + row(IMG, 'Matt Smith', 'COO and Founder'),
  'quote|quote sheet mist': row('Customer record') + row('<p>A long enough quote to be the blockquote text of it all.</p>') + row(IMG, 'Name', 'Role') + row(`<a href="/g2">${IMG}</a>`),
  'quote|quote band ink': row(IMG) + row('<p>A long enough quote to be the blockquote text right here.</p>') + row(IMG),
  'quote|quote trio': row(IMG) + row(IMG) + row(IMG),
  'logos|logos table': row(IMG + IMG + IMG + IMG),
  'logos|logos table linked': row('Works with · 4 platforms') + row(`<a href="/1">${IMG}</a><a href="/2">${IMG}</a>`),
  'logos|logos banded': row('<p>Our most notable customers</p>') + row(IMG + IMG + IMG),
  'logos|logos counter accent': row('+900', 'companies use the thing') + row(IMG + IMG),
  'accordion|accordion': row('<h3>Question one?</h3>', '<p>Answer one.</p>') + row('Question two?', '<p>Answer two.</p><ul><li>a</li></ul>') + row('<p>More questions? <a href="mailto:x@y.z">Contact us.</a></p>'),
  'sheets|sheets honest': row(IMG, '<h4>Concession</h4><p>Body prose for it.</p>') + row(IMG, '<h4>Two</h4><p>Body.</p>'),
  'sheets|sheets addons': row('<h3>Payment Recovery</h3>', '+$129/mo', '<ul><li>Bullet</li><li>Two</li></ul>', '<a href="/r">How it pays for itself</a>'),
  'sheets|sheets support': row(IMG, '~2 min response', 'Real-person chat') + row(IMG, 'Unlimited calls', 'No cap'),
  'sheets|sheets note': row('Method') + row('<h2>What is LTV?</h2><p>Prose one.</p>', '<h3>Why it matters:</h3><ul><li>a</li><li>b</li></ul>'),
  'steps|steps': row('<p>Step 1</p><h3>Do the thing</h3><p>Body prose.</p><ul><li>Bullet one</li><li>Bullet two</li></ul>', IMG) + row('<p>Step 2</p><h3>Then this</h3><p>Body prose.</p>', IMG) + row('<p>Step 3</p><h3>No media step</h3><p>Body prose.</p>'),
  'feature-hero|feature-hero case': row('<p>Metrics & Analytics</p>') + row('<h2>Make decisions</h2><p>A supporting lede that is long enough to read as one here.</p>') + row('<p><em><a href="/f">Learn More</a></em></p>') + row('<p>A long enough record quote to be the blockquote text of the case promo split.</p>') + row(IMG, 'Emery Wells, Frame.io') + row('<img src="https://baremetrics.com/hubfs/x.png" width="1160" height="740" alt="">'),
  'steps|steps entries': row('<p>Entry 01</p><h3>Augmentation</h3><p>Body.</p>', '<a href="/a">See it</a>', IMG) + row('<p>Entry 02</p><h3>Segmentation</h3><p>Body.</p>', '<a href="/b">See it</a>', IMG),
  'checklist|checklist': row(IMG, '<p>A bold claim.</p><ul><li>Too few emails</li><li>Not clear</li></ul>') + row(IMG, '<p>Another claim.</p><ul><li>Waste of time</li></ul>'),
  'toc|toc': row('Table of Contents', '<ul><li><a href="#a">One</a></li><li><a href="#b">Two</a></li></ul>') + row('More Articles', '<ul><li><a href="/x">X</a></li><li><strong><a href="/y">Y (current)</a></strong></li></ul>'),
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.setContent('<main id="m"></main>');

const blocks = [...new Set(Object.keys(CASES).map((k) => k.split('|')[0]))];
for (const name of blocks) {
  const js = fs.readFileSync(`blocks/${name}/${name}.js`, 'utf8');
  await page.addScriptTag({ content: `window.__b=window.__b||{};window.__b[${JSON.stringify(name)}]=(function(){${js.replace(/export default\s+/, '')}\nreturn decorate;})();` });
}
const notInstalled = await page.evaluate((ns) => ns.filter((n) => !(window.__b && window.__b[n])), blocks);
if (notInstalled.length) {
  console.error(`✗ failed to install: ${notInstalled.join(', ')}`);
  process.exit(1);
}

let failed = false;
for (const [key, html] of Object.entries(CASES)) {
  const [name, cls] = key.split('|');
  const res = await page.evaluate(async ([n, c, h]) => {
    const main = document.querySelector('#m');
    main.innerHTML = `<div class="section"><div class="block-content"><div class="${c}">${h}</div></div></div>`;
    const block = main.querySelector(`.${n}`);
    try {
      await window.__b[n](block);
    } catch (e) {
      return { ok: false, err: e.message };
    }
    return { ok: block.childElementCount > 0, err: block.childElementCount ? null : 'empty after decorate' };
  }, [name, cls, html]);
  if (!res.ok) failed = true;
  console.log(`${res.ok ? '✓' : '✗'} ${key}${res.err ? ` — ${res.err}` : ''}`);
}
if (errors.length) { failed = true; console.log(errors.join('\n')); }
await browser.close();
process.exit(failed ? 1 : 0);
