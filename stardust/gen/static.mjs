/**
 * stardust/gen/static.mjs — STATIC + LEGAL content pages (Path A′).
 *
 * Pages: security, privacy, gdpr, terms, privacy-shield  (article-template
 *   legal/prose: metadata[Template:article] + masthead h1 + prose default
 *   content, captured heading levels preserved);
 * affiliate, accelerator (masthead + captured body sections + closing trial
 *   band); subscribe (masthead form, inert email chrome + trial band);
 * book-a-demo (masthead + captured lede + inert "Talk to us" band —
 *   the HubSpot scheduler is inert per the fragments rule + owner decision);
 * wall-of-love (testimonial wall → cards[cases] grid of captured testimonials).
 *
 * Copy/hrefs/images are captured (JSON + live DOM, same origin/day); nothing
 * invented. Run from the repo root: node stardust/gen/static.mjs
 */
/* eslint-disable no-console */
import {
  readJson, write, page, metadata, section, block, row, prose, esc, escAttr, T,
  extract, orderByRaw, withBrowser, ctaBand, HUB,
} from './lib.mjs';

const TRIAL = ['Get Baremetrics for your company', 'Start your free trial', 'https://app.baremetrics.com/users/sign_up'];

/* ── legal / prose (article template) ────────────────────────────────── */
async function legal(pg, slug) {
  const j = readJson(slug);
  let items = await extract(pg, `${HUB}/${slug}`, { waitMs: 1800 });
  /* keep prose only; drop chrome imgs (logo / stripe-verified) */
  items = items.filter((it) => it.type !== 'img');
  /* the first heading is the h1 → masthead; the rest is prose */
  const h1idx = items.findIndex((it) => it.type === 'heading' && it.level === 1);
  const h1 = h1idx >= 0 ? items[h1idx].text : (j.headings[0]?.text || j.title);
  const bodyItems = items.filter((_, i) => i !== h1idx)
    .map((it) => (it.type === 'heading' ? { ...it, level: Math.max(2, it.level) } : it));
  console.log(`  ${slug}: h1=${JSON.stringify(h1)} prose items=${bodyItems.length}`);
  const sections = [
    metadata(j.title, j.description, { Template: 'article' }),
    block('masthead', [row([`<h1>${esc(h1)}</h1>`])]),
    section(prose(bodyItems, { minHeading: 2 })),
  ];
  write(`${slug}.html`, page(sections));
}

/* ── marketing prose page (affiliate) ────────────────────────────────── */
async function marketing(pg, slug, { fromRaw = false } = {}) {
  const j = readJson(slug);
  const h1 = j.headings[0]?.text || j.title;
  let items;
  if (fromRaw) {
    const heads = j.headings.slice(1); // drop the h1 (masthead)
    items = await orderByRaw(slug, heads, j.body);
  } else {
    items = await extract(pg, `${HUB}/${slug}`, { waitMs: 1800, scroll: true });
    items = items.filter((it) => !(it.type === 'heading' && it.level === 1));
    /* drop chrome logos (baremetrics-logo / stripe-verified) */
    items = items.filter((it) => !(it.type === 'img' && /baremetrics-logo|stripe-verified|logo\.svg$/.test(it.src)));
  }
  const lede = j.description;
  /* drop a leading body paragraph that merely repeats the masthead lede */
  if (items[0] && items[0].type === 'p' && T(items[0].html.replace(/<[^>]+>/g, '')) === T(lede)) items = items.slice(1);
  console.log(`  ${slug}: h1=${JSON.stringify(h1)} items=${items.length}`);
  const sections = [
    metadata(j.title, j.description),
    block('masthead', [row([`<h1>${esc(h1)}</h1>`]), row([`<p>${esc(lede)}</p>`])]),
    section(prose(items, { minHeading: 2 })),
    ctaBand(...TRIAL),
  ];
  write(`${slug}.html`, page(sections));
}

/* ── subscribe (masthead form + trial band) ──────────────────────────── */
function subscribe() {
  const j = readJson('subscribe');
  const sections = [
    metadata(j.title, j.description),
    block('masthead form', [
      row([`<h1>${esc(j.headings[0]?.text || 'Subscribe')}</h1>`]),
      row([`<p>${esc(j.description)}</p>`]),
      row(['Email address', 'Enter your email to subscribe', 'Subscribe']),
    ]),
    ctaBand(...TRIAL),
  ];
  write('subscribe.html', page(sections));
  console.log('  subscribe: masthead form (inert email chrome) + trial band');
}

/* ── book-a-demo (masthead + inert "Talk to us" band) ────────────────── */
function bookADemo() {
  const j = readJson('book-a-demo');
  const lede = T(j.headings.find((h) => h.tag === 'h2')?.text) || j.description;
  const sections = [
    metadata(j.title, j.description),
    block('masthead', [
      row([`<h1>${esc(j.headings[0]?.text || 'Book a Demo')}</h1>`]),
      row([`<p>${esc(lede)}</p>`]),
    ]),
    ctaBand('Talk to us', 'Contact us', 'mailto:hello@baremetrics.com'),
  ];
  write('book-a-demo.html', page(sections));
  console.log('  book-a-demo: masthead + INERT "Talk to us" band (HubSpot scheduler not reproduced)');
}

/* ── wall-of-love (testimonial wall → cards cases) ───────────────────── */
async function wallOfLove(pg) {
  const j = readJson('wall-of-love');
  await pg.goto(`${HUB}/wall-of-love`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pg.waitForTimeout(2000);
  const testimonials = await pg.evaluate(() => {
    const abs = (h) => { try { return new URL(h, location.href).href; } catch { return h; } };
    const bad = (e) => e.closest('header,footer,nav,[class*="header"],[class*="footer"],[class*="menu"],form');
    const nodes = [...document.querySelectorAll('img,p')].filter((e) => !bad(e));
    /* the wall renders each testimonial as a strict cycle:
       logo(img) → quote(p) → avatar(img) → name(p). Drive a 4-state machine
       and start a fresh card whenever an <img> arrives in the logo slot. */
    const out = [];
    let cur = null;
    let slot = 0; // 0 logo, 1 quote, 2 avatar, 3 name
    nodes.forEach((e) => {
      const isImg = e.tagName === 'IMG';
      const t = isImg ? '' : (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (isImg) {
        const src = e.getAttribute('src') || '';
        const alt = e.getAttribute('alt') || '';
        if (!cur || slot >= 2) {
          if (cur && cur.quote) out.push(cur);
          cur = { company: alt.replace(/^Customer\s+/i, '').trim(), logo: abs(src), quote: '', name: '', avatar: '' };
          slot = 1;
        } else {
          cur.avatar = abs(src);
          slot = 3;
        }
        return;
      }
      if (!t || !cur) return;
      if (slot === 1 && !cur.quote) { cur.quote = t; }
      else if (slot === 3 && !cur.name) { cur.name = t; slot = 4; }
    });
    if (cur && cur.quote) out.push(cur);
    return out.filter((c) => c.quote);
  });
  console.log(`  wall-of-love: ${testimonials.length} testimonials`);
  const cards = testimonials.map((c) => {
    const cells = [];
    const img = c.avatar || c.logo;
    if (img) cells.push(`<div><img src="${escAttr(img)}" alt="${escAttr(c.name || c.company || '')}"></div>`);
    const idParts = [];
    if (c.name) idParts.push(`<h3>${esc(c.name)}</h3>`);
    cells.push(`<div>${idParts.join('')}</div>`);
    if (c.company) cells.push(`<div>${esc(c.company)}</div>`);
    cells.push(`<div><p>${esc(c.quote)}</p></div>`);
    return `      <div>${cells.join('')}</div>`;
  });
  const h2 = j.headings.find((h) => h.tag === 'h2');
  const sections = [
    metadata(j.title, j.description),
    block('masthead', [
      row([`<h1>${esc(j.headings[0]?.text || 'Wall of Love')}</h1>`]),
      row([`<p>${esc(j.description)}</p>`]),
    ]),
    `  <div>
    <h2>${esc(h2 ? h2.text : 'What our customers say')}</h2>
    <div class="cards cases">
${cards.join('\n')}
    </div>
  </div>`,
    ctaBand(...TRIAL),
  ];
  write('wall-of-love.html', page(sections));
}

await withBrowser(async (pg) => {
  console.log('legal / prose (article template):');
  for (const slug of ['security', 'privacy', 'gdpr', 'terms', 'privacy-shield']) {
    await legal(pg, slug);
  }
  console.log('marketing:');
  await marketing(pg, 'affiliate');
  await marketing(pg, 'accelerator', { fromRaw: true });
  console.log('forms / demo / wall:');
  subscribe();
  bookADemo();
  await wallOfLove(pg);
});
console.log('static.mjs done');
