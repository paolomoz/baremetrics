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
import fs from 'node:fs';
import path from 'node:path';
import {
  readJson, write, page, metadata, section, block, row, blockWithHead, prose, esc, escAttr, T,
  extract, withBrowser, ctaBand, HUB, PAGES,
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

/* ── affiliate (masthead + steps walkthrough + 3 feature promos + FAQ) ──── */
/* Content re-extracted by stardust/scripts/extract-affiliate.mjs →
   _affiliate.json (masthead h1/lede/CTA; 3 steps with intro paras + bullet
   lists + side graphics; 3 feature promos with category, screenshot, record
   quote + avatar attribution, "Learn More" link; closing CTA; 4-Q FAQ). The
   flat marketing-prose path lost all of this structure. Nothing invented —
   every string, href and image URL is captured; the only added labels are the
   "Step N" ordinal eyebrows for the walkthrough sequence. */
function affiliate() {
  const j = readJson('affiliate');
  const a = JSON.parse(fs.readFileSync(path.join(PAGES, '_affiliate.json'), 'utf8'));
  const img = (m) => (m && m.src
    ? `<img src="${escAttr(m.src)}" alt="${escAttr(m.alt)}"${m.w ? ` width="${m.w}"` : ''}${m.h ? ` height="${m.h}"` : ''}>`
    : '');
  const headText = (re, fallback) => j.headings.find((h) => re.test(h.text))?.text || fallback;

  /* masthead — h1 + lede + primary CTA (strong>a → primary btn via ak.js) */
  const masthead = block('masthead', [
    row([`<h1>${esc(a.masthead.h1)}</h1>`]),
    row([`<p>${esc(a.masthead.lede)}</p>`]),
    row([`<p><strong><a href="${escAttr(a.masthead.cta.href)}">${esc(a.masthead.cta.label)}</a></strong></p>`]),
  ]);

  /* steps — one authored row per step: "Step N" eyebrow (pre-heading meta),
     h3, intro paragraph(s), bullet list, side graphic. Section head carried as
     an absorbed <h2>. Step 3 ("Earn every month") is a live slider on the
     source with no static image/bullets — only its two paragraphs are kept. */
  const stepRows = a.steps.map((s, i) => {
    const copy = [
      `<p>Step ${i + 1}</p>`,
      `<h3>${esc(s.h2)}</h3>`,
      ...s.paras.map((p) => `<p>${esc(p)}</p>`),
      s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '',
    ].filter(Boolean).join('');
    return row(s.image ? [copy, img(s.image)] : [copy]);
  });
  const steps = blockWithHead(
    `    <h2>${esc(headText(/how our affiliate/i, "Here's how our affiliate partner program works:"))}</h2>`,
    'steps', stepRows,
  );

  /* feature promos — chip category, h2 + in-cell lede, "Learn More" secondary
     CTA (em>a), record quote (long text after the CTA), avatar + attribution,
     window-chromed screenshot exhibit. mirror+mist alternates the media dock
     and ground on the 2nd promo (source alternates its grounds). */
  const promoHead = section(`    <h2>${esc(headText(/customers you refer/i, "Here's what the customers you refer get with Baremetrics:"))}</h2>`);
  const promoBlocks = a.promos.map((p, i) => block(i === 1 ? 'feature-hero case mirror mist' : 'feature-hero case', [
    row([`<p>${esc(p.category)}</p>`]),
    row([`<h2>${esc(p.h2)}</h2><p>${esc(p.body)}</p>`]),
    row([`<p><em><a href="${escAttr(p.link.href)}">${esc(p.link.label)}</a></em></p>`]),
    row([`<p>${esc(p.quote)}</p>`]),
    row([img(p.avatar), `${esc(p.citeName)}${p.citeRole ? `, ${esc(p.citeRole)}` : ''}`]),
    row([img(p.shot)]),
  ]));

  /* FAQ — head <h2>FAQ</h2> absorbed; one row per Q/A (answer HTML preserves
     the inline Rewardful link). */
  const faq = blockWithHead('    <h2>FAQ</h2>', 'accordion',
    a.faq.map((f) => row([`<h3>${esc(f.q)}</h3>`, `<p>${f.a}</p>`])));

  const sections = [
    metadata(j.title, j.description),
    masthead,
    steps,
    promoHead,
    ...promoBlocks,
    ctaBand(a.cta.h2, a.cta.label, a.cta.href),
    faq,
  ];
  write('affiliate.html', page(sections));
  console.log(`  affiliate: masthead + ${a.steps.length} steps + ${a.promos.length} feature promos + closing band + FAQ (${a.faq.length} Q)`);
}

/* ── accelerator (SaaS cohort → cards cohort grid) ───────────────────── */
/* Content re-extracted per-card (logo, industry tag, blurb, external link) by
   stardust/scripts/extract-accelerator.mjs → _accelerator-cards.json; the flat
   marketing-prose path flattened the grid, so this composes the crafted cards
   `cohort` variant instead. Nothing invented — all fields captured. */
function accelerator() {
  const j = readJson('accelerator');
  const cards = JSON.parse(fs.readFileSync(path.join(PAGES, '_accelerator-cards.json'), 'utf8'));
  /* near-white captured tiles are the default mist tile; only carry a <code>
     background for logos designed on a distinct/dark ground (keeps light marks
     legible — e.g. Growth Forum on black, SymphonyOS on purple) */
  const isDefaultTile = (bg) => !bg || /rgba\(2(?:55|50), 2(?:55|50), 2(?:55|50)/.test(bg);
  const rows = cards.map((c) => {
    const bg = isDefaultTile(c.logoBg) ? '' : `<code>${esc(c.logoBg)}</code>`;
    const logo = c.logo ? `<img src="${escAttr(c.logo)}" alt="${escAttr(c.name)} logo">${bg}` : bg;
    const copy = [
      c.tag ? `<p>${esc(c.tag)}</p>` : '',
      `<h3>${esc(c.name)}</h3>`,
      c.blurb ? `<p>${esc(c.blurb)}</p>` : '',
    ].join('');
    const link = c.href ? `<a href="${escAttr(c.href)}">Click to learn more</a>` : '';
    return row([logo, copy, link]);
  });
  const h1 = j.headings[0]?.text || j.title;
  const sections = [
    metadata(j.title, j.description),
    block('masthead', [row([`<h1>${esc(h1)}</h1>`]), row([`<p>${esc(j.description)}</p>`])]),
    `  <div>
    <p>${cards.length} companies</p>
    <h2>Accelerator companies</h2>
    <div class="cards cohort">
${rows.join('\n')}
    </div>
  </div>`,
    ctaBand(...TRIAL),
  ];
  write('accelerator.html', page(sections));
  console.log(`  accelerator: cards cohort (${cards.length} companies)`);
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

/* selective run: `node stardust/gen/static.mjs accelerator` regenerates only
   the accelerator page (no browser / network) */
if (process.argv.includes('accelerator')) {
  accelerator();
  console.log('static.mjs done (accelerator only)');
  process.exit(0);
}

/* selective run: `node stardust/gen/static.mjs affiliate` regenerates only the
   affiliate page (no browser / network) */
if (process.argv.includes('affiliate')) {
  affiliate();
  console.log('static.mjs done (affiliate only)');
  process.exit(0);
}

await withBrowser(async (pg) => {
  console.log('legal / prose (article template):');
  for (const slug of ['security', 'privacy', 'gdpr', 'terms', 'privacy-shield']) {
    await legal(pg, slug);
  }
  console.log('marketing:');
  affiliate();
  accelerator();
  console.log('forms / demo / wall:');
  subscribe();
  bookADemo();
  await wallOfLove(pg);
});
console.log('static.mjs done');
