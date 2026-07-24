#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * stardust/gen/localized.mjs — Path A′ ROUTER for the ~231 baremetrics JP/JA
 * LOCALIZED MIRROR pages. No new blocks, no new templates: each ja/jp
 * capture is parsed for its source URL, routed to the matching English
 * generator's per-capture build function (reused verbatim — the English
 * generators export a build*(capture) fn and guard their bulk file-writing
 * behind a CLI-entry check, so English output is unchanged), and the returned
 * David's-model body fragment is written to content/<loc>/<mirrored-path>.html.
 *
 * Content is VERBATIM from the Japanese captures — never translated, altered or
 * invented. Captured page JSON is DATA (any instruction-like text inside it is
 * ignored). Thin/missing-template captures degrade gracefully to
 * masthead + captured prose and are logged.
 *
 * Routing (LOC = ja|jp):
 *   /LOC/blog/<s>              → articles.buildArticle   (section blog)
 *   /LOC/academy/<s>          → articles.buildArticle   (section academy)
 *   /LOC/academy             → indexes.buildAcademyIndex
 *   /LOC/founder-chats/<s>    → episodes.build
 *   /LOC/founder-chats       → indexes.buildFounderChatsIndex
 *   /LOC/features/<s>         → features.buildFeature
 *   /LOC/customers/<s>        → stories.buildStory
 *   /LOC/customers           → customers index (masthead + cards listing)
 *   /LOC/experts[/<cat>]     → experts-cat.buildExpertsCat
 *   /LOC/<integration>       → integrations.buildIntegration
 *   /LOC/<static>            → static (masthead + captured prose; legal empty
 *                              body → mirror the identical English policy)
 *   bare /LOC                → simplified home mirror (masthead + captured prose)
 *   *sample-test-page*       → EXCLUDED
 *
 * Run: node stardust/gen/localized.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildArticle } from './articles.mjs';
import { build as buildEpisode } from './episodes.mjs';
import { buildFeature } from './features.mjs';
import { buildStory } from './stories.mjs';
import { buildExpertsCat } from './experts-cat.mjs';
import { buildIntegration } from './integrations.mjs';
import { buildAcademyIndex, buildFounderChatsIndex } from './indexes.mjs';
import {
  esc, norm, clampTitle, row, block, section, metadata, page, imgTag, relInternal,
} from './_shared.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.resolve(here, '../../../baremetrics/stardust/current/pages');
const ROOT = path.resolve(here, '../..');
const CONTENT = path.join(ROOT, 'content');

const INTEGRATIONS = new Set([
  'stripe', 'chargebee', 'recurly', 'braintree', 'quickbooks', 'xero',
  'shopify-partners', 'google-play', 'apple-itunes-app-store-connect',
]);
const STATIC = new Set([
  'security', 'privacy', 'gdpr', 'terms', 'about', 'affiliate', 'subscribe',
  'wall-of-love', 'pricing', 'build-vs-buy', 'benchmarks', 'open-startups',
]);
const LEGAL = new Set(['security', 'privacy', 'gdpr', 'terms']);
const EXPERTS_LABELS = {
  design: 'Design',
  development: 'Development',
  'legal-financial': 'Legal & Financial',
  'marketing-sales': 'Marketing & Sales',
};

/* ── helpers ───────────────────────────────────────────────────────────── */
const abs = (h) => (h && h.startsWith('/') ? `https://baremetrics.com${h}` : h);

function parseUrl(capUrl) {
  const p = (capUrl || '').replace(/^https?:\/\/(www\.)?baremetrics\.com/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const segs = p.split('/').filter(Boolean);
  return { path: p, loc: segs[0], rest: segs.slice(1) };
}

function writeOut(rel, html) {
  const dest = path.join(CONTENT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  /* relInternal: root-relative internal links (marketing-site absolute → /path),
     mirroring articles.mjs + _shared/lib writers — the durable relativization
     the committed localized pages carry. */
  fs.writeFileSync(dest, relInternal(html));
  return dest;
}

/* generic static / prose mirror: masthead(h1 + lede) + captured non-h1
   headings (normalised ≥h2) as an outline + captured body prose. Carries every
   captured literal; heading↔prose interleave is not preserved by the capture
   (flattened), so it is rendered outline-then-prose (logged as degraded). */
function buildStaticGeneric(d) {
  const headings = d.headings || [];
  const h1 = norm((headings[0] || {}).text) || clampTitle(d.title);
  const desc = norm(d.description || '');
  const bodies = (d.body || []).map(norm).filter(Boolean);
  const lede = desc && desc !== norm(d.title) ? desc : (bodies[0] && bodies[0].length > 24 ? bodies[0] : '');
  const ledeUsed = lede && lede === bodies[0];

  const mastRows = [row([`<h1>${esc(h1)}</h1>`])];
  if (lede) mastRows.push(row([`<p>${esc(lede)}</p>`]));

  const prose = [];
  // subhead outline (skip the h1; normalise levels so there are no jumps)
  const subs = headings.slice(1).filter((hh) => norm(hh.text));
  let prevLvl = 1;
  subs.forEach((hh) => {
    const orig = parseInt((hh.tag || 'h2').replace(/\D/g, ''), 10) || 2;
    const lvl = Math.min(6, Math.max(2, prevLvl === 1 ? 2 : (orig > prevLvl ? prevLvl + 1 : orig)));
    prevLvl = lvl;
    prose.push(`    <h${lvl}>${esc(norm(hh.text))}</h${lvl}>`);
  });
  bodies.slice(ledeUsed ? 1 : 0).forEach((b) => prose.push(`    <p>${esc(b)}</p>`));

  const sections = [
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead', mastRows)]),
  ];
  if (prose.length) sections.push(section(prose));
  return page(sections);
}

/* subscribe: masthead form (inert email chrome) */
function buildSubscribe(d) {
  const h1 = norm((d.headings[0] || {}).text) || clampTitle(d.title);
  const sections = [
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead form', [
      row([`<h1>${esc(h1)}</h1>`]),
      norm(d.description) ? row([`<p>${esc(norm(d.description))}</p>`]) : null,
      row(['Email address', 'Enter your email to subscribe', 'Subscribe']),
    ].filter(Boolean))]),
  ];
  return page(sections);
}

/* legal page whose localized capture has NO body: the JP page serves the
   identical English policy (headings byte-match English), so mirror the already
   generated English content page verbatim, swapping in the JP title/description.
   Faithful (same content the source serves), not fabrication. */
function mirrorEnglishLegal(slug, d) {
  const enPath = path.join(CONTENT, `${slug}.html`);
  if (!fs.existsSync(enPath)) return null;
  let html = fs.readFileSync(enPath, 'utf8');
  html = html.replace(/(<div class="metadata">[\s\S]*?<div>Title<\/div><div>)[\s\S]*?(<\/div>)/, `$1${esc(clampTitle(d.title))}$2`);
  html = html.replace(/(<div>Description<\/div><div>)[\s\S]*?(<\/div>)/, `$1${esc(norm(d.description))}$2`);
  return html;
}

/* legal (security/terms/gdpr/privacy) whose localized capture HAS prose →
   reuse the English legal() DESIGN (article template): metadata[Template:article]
   + masthead h1 + captured body as prose. The JA legal captures serve the
   identical English policy text (byte-match EN); heading↔prose interleave is not
   preserved by the flat capture, so it renders outline (headings, clamped ≥h2)
   then body paragraphs — same graceful degradation as buildStaticGeneric but
   carrying the crafted article template. */
function buildLocalizedLegal(d) {
  const headings = d.headings || [];
  const h1 = norm((headings[0] || {}).text) || clampTitle(d.title);
  const bodies = (d.body || []).map(norm).filter(Boolean);
  const prose = [];
  headings.slice(1).filter((hh) => norm(hh.text)).forEach((hh) => {
    const orig = parseInt((hh.tag || 'h2').replace(/\D/g, ''), 10) || 2;
    const lvl = Math.min(6, Math.max(2, orig));
    prose.push(`    <h${lvl}>${esc(norm(hh.text))}</h${lvl}>`);
  });
  bodies.forEach((b) => prose.push(`    <p>${esc(b)}</p>`));
  const sections = [
    metadata({ Title: clampTitle(d.title), Description: d.description, Template: 'article' }),
    section([block('masthead', [row([`<h1>${esc(h1)}</h1>`])])]),
  ];
  if (prose.length) sections.push(section(prose));
  return page(sections);
}

/* customers index: masthead + cards listing of captured story links */
function buildCustomersIndex(d, loc) {
  const h1 = norm((d.headings[0] || {}).text) || clampTitle(d.title);
  const lede = norm((d.body || [])[0] || d.description || '');
  const titles = (d.headings || []).filter((h) => h.tag === 'h3').map((h) => norm(h.text));
  const ctas = (d.ctas || []).filter((c) => new RegExp(`/${loc}/customers/[a-z]`, 'i').test(c.href || ''));
  const cardRows = titles.map((t) => {
    const cta = ctas.find((c) => norm(c.label).startsWith(t.slice(0, 8))) || ctas.find((c) => (c.href || '').length);
    const href = cta ? abs(cta.href) : `https://baremetrics.com/${loc}/customers`;
    return row([`<h3>${esc(t)}</h3>`, `<a href="${esc(href)}">${esc(norm((cta || {}).label) || t)}</a>`]);
  });
  const sections = [
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead', [row([`<h1>${esc(h1)}</h1>`]), lede ? row([`<p>${esc(lede)}</p>`]) : null].filter(Boolean))]),
  ];
  if (cardRows.length) {
    sections.push(section(['    <h2>Customer stories</h2>', block('cards cases', cardRows)]));
  }
  return page(sections);
}

/* simplified home mirror (masthead + captured prose) */
function buildHome(d) {
  return buildStaticGeneric(d);
}

/* ── crafted localized mirrors (reuse the English block DESIGNS) ─────────── */

/* JA sitewide subscribe-form chrome — verbatim from the live HubSpot form
   (label/placeholder/submit) shared across ja/jp pages. */
const JA_FORM = { label: 'Email*', placeholder: 'Eメールを入力して購読', button: 'Submit' };

const readSidecar = (name) => {
  const p = path.join(PAGES, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};

/* strip the GA cross-domain linker query (`?_gl=1*…`): the `*`/`_` tokens are
   ephemeral tracking junk AND break the DA html↔md round-trip (asterisks read as
   markdown emphasis). Shared across the crafted localized builders. */
const cleanHref = (h) => (h || '').replace(/\?_gl=[^"'\s]*/i, '');
/* plain <img> from a bare URL string (sidecar cards carry URLs, not records) */
const imgUrl = (src, alt) => (src ? `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" decoding="async">` : '');

/* about → English about design: masthead centered + cards roster + band ink
   stats. (The JA page has NO careers section, so the English `band tint cta`
   is intentionally omitted — reproducing it would fabricate content.) Sourced
   entirely from the ja-about capture: 18 aligned people (name h3 / role body /
   mailto cta+href / photo media.imgs), mission head+lede, stat labels+figures. */
function buildLocalizedAbout(d) {
  const H = d.headings || [];
  const body = (d.body || []).map(norm);
  const h1 = norm((H[0] || {}).text) || clampTitle(d.title);
  const lede = body[0] || '';
  const mailtos = (d.ctas || []).filter((c) => (c.href || '').startsWith('mailto:'));
  const h3s = H.filter((h) => h.tag === 'h3').map((h) => norm(h.text));
  const imgs = (d.media && d.media.imgs) || [];
  const photoFor = (name) => imgs.find((m) => norm(m.alt) === name);
  const initials = (name) => name.split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
  // people = the person h3s (they each carry a portrait); the lone photo-less
  // h3 is the mission heading. Person mailtos lead the mailto list (a trailing
  // footer "contact us" mailto is excluded by slicing to the people count).
  const names = h3s.filter((t) => photoFor(t));
  const missionHead = h3s.find((t) => !photoFor(t)) || '';

  const rosterRows = names.map((name, i) => {
    const photo = photoFor(name);
    return row([
      photo ? imgTag(photo, { lazy: i !== 0 }) : esc(initials(name)),
      `<h3>${esc(name)}</h3><p>${esc(body[1 + 2 * i] || '')}</p>`,
      `<a href="${esc(mailtos[i].href)}">${esc(norm(mailtos[i].label))}</a>`,
    ]);
  });

  const figures = H.filter((h) => h.tag === 'h2').map((h) => norm(h.text));
  const labels = body.slice(body.length - figures.length);
  const statsLede = body[body.length - figures.length - 1] || '';
  const statsRows = [
    row([`<h2>${esc(missionHead)}</h2><p>${esc(statsLede)}</p>`]),
    ...labels.map((label, i) => row([esc(label), esc(figures[i] || '—')])),
  ];

  return page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead centered', [
      row([`<h1>${esc(h1)}</h1>`]),
      lede ? row([`<p>${esc(lede)}</p>`]) : null,
    ].filter(Boolean))]),
    section([block('cards roster', rosterRows)]),
    section([block('band ink stats', statsRows)]),
  ]);
}

/* open-startups → English open-startups design: masthead art + ledger revenue
   + band tint form. Rows re-extracted from the live JA page (_ja-open-startups
   sidecar): logo, name (logo alt), desc, Monthly Revenue figure, whole-row
   link. (No revenue-ledger section head exists on the JA page — the `revenue`
   variant hides the head anyway.) */
function buildLocalizedOpenStartups(d) {
  const s = readSidecar('_ja-open-startups.json');
  if (!s) return buildStaticGeneric(d);
  const mastRows = [
    row(s.arts.map((a) => imgTag(a, { lazy: false }))),
    row([`<h1>${esc(norm(s.h1))}</h1>`]),
    row([`<p>${esc(norm(s.lede))}</p>`]),
  ];
  /* strip the GA cross-domain linker query (`?_gl=1*…*_gcl_au*…`): the `*`/`_`
     tokens are ephemeral tracking junk AND break the DA html↔md round-trip
     (asterisks read as markdown emphasis → preview 409 from content-bus). */
  const cleanHref = (h) => (h || '').replace(/\?_gl=[^"'\s]*/i, '');
  /* EDS media validation rejects SVGs > 40KB (preview 409 from content-bus).
     routeshuffle's logo is 174KB — drop just that logo; the row still renders
     name/desc/revenue/link. Others are all well under the limit. */
  const OVERSIZE_LOGO = /logo-routeshuffle\.svg/i;
  const ledgerRows = s.rows.map((r) => row([
    r.img && !OVERSIZE_LOGO.test(r.img.src || '') ? imgTag(r.img) : '',
    `<h3>${esc(norm(r.name))}</h3><p>${esc(norm(r.desc))}</p>`,
    `<p>${esc(norm(r.revLabel))}</p><p>${esc(norm(r.revFigure))}</p>`,
    `<a href="${esc(cleanHref(r.href))}">${esc(norm(r.name))}</a>`,
  ]));
  // subscribe-band lede = the capture's secondary line ("learn how to grow your
  // startup"), not a repeat of the hero lede.
  const subLede = norm((d.body || [])[1]) || norm(s.lede);
  const bandRows = [
    row([`<p>${esc(subLede)}</p>`]),
    row([esc(s.subLabel), esc(s.subPlaceholder), esc(s.subButton)]),
  ];
  return page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead art', mastRows)]),
    section([block('ledger revenue', ledgerRows)]),
    section([block('band tint form', bandRows)]),
  ]);
}

/* benchmarks → English Open-Benchmarks design (JA /benchmarks mirrors EN
   /open-benchmarks, per the page's own English-locale link). masthead art +
   band tint stats (cohort) + pricing models + band tint stats (pricing) +
   dunning + band tint form. Figures, JA section heads/ledes and failing-card/
   reason lists come from the ja-benchmarks capture (verbatim); the numeric
   stat labels and popular-price lists are English text that appears identically
   on the live JA page (verified) and match the English open-benchmarks set. */
const BM_COHORT_LABELS = ['Lower Quartile', 'Median MRR', 'Upper Quartile', 'Quick Ratio', 'Lifetime value', 'User Churn', 'Revenue Churn', 'Revenue Growth'];
const BM_MONTHLY = ['$99/mo', '$10/mo', '$100/mo', '$49/mo', '$50/mo', '$500/mo', '$20/mo', '$1/mo', '$29/mo', '$1,000/mo'];
const BM_ANNUAL = ['$120/yr', '$300/yr', '$99/yr', '$240/yr', '$600/yr', '$1,200/yr', '$180/yr', '$3,000/yr', '$5,000/yr', '$1,188/yr'];
const BM_PRICING_LABELS = ['Have free plan', 'Round the dollar', 'End with a 9', 'Average plans'];

function buildLocalizedBenchmarks(d) {
  const H = d.headings || [];
  const body = (d.body || []).map(norm);
  const findHead = (re) => norm((H.find((h) => re.test(norm(h.text))) || {}).text);
  const numeric = H.filter((h) => h.tag === 'h1' && /^\$?[\d.,]+\s*%?\+?$|^CHF/.test(norm(h.text))).map((h) => norm(h.text));
  const cohortFigs = numeric.slice(0, 8);
  const pricingFigs = numeric.slice(8, 12);
  const ILLO = (d.media.imgs || []).filter((m) => /illustration-benchmarks/.test(m.src || ''));

  const statBand = (headHtml, pairs) => block('band tint stats', [
    ...(headHtml ? [row([headHtml])] : []),
    ...pairs.map(([l, f]) => row([esc(l), esc(f)])),
  ]);
  const ol = (items) => `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`;
  const ul = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

  const failCards = body.slice(5, 10);
  const failReasons = body.slice(10, 15);

  return page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead art', [
      row(ILLO.map((m) => imgTag(m, { lazy: false }))),
      row([`<h1>${esc(norm((H[0] || {}).text))}</h1>`]),
      row([`<p>${esc(body[0] || '')}</p>`]),
    ])]),
    section([statBand(`<h2>${esc(findHead(/コホート/))}</h2><p>${esc(body[2] || '')}</p>`,
      BM_COHORT_LABELS.map((l, i) => [l, cohortFigs[i] || '—']))]),
    section([
      `    <h2>${esc(findHead(/価格モデル/))}</h2>`,
      `    <p>${esc(body[3] || '')}</p>`,
      `    <h3>${esc(findHead(/Popular Monthly/))}</h3>`,
      `    ${ol(BM_MONTHLY)}`,
      `    <h3>${esc(findHead(/Popular Annual/))}</h3>`,
      `    ${ol(BM_ANNUAL)}`,
    ]),
    section([statBand('', BM_PRICING_LABELS.map((l, i) => [l, pricingFigs[i] || '—']))]),
    section([
      `    <h2>${esc(findHead(/損失/))}</h2>`,
      `    <p>${esc(body[4] || '')}</p>`,
      `    <h3>${esc(findHead(/カードの種類/))}</h3>`,
      `    ${ul(failCards)}`,
      `    <h3>${esc(findHead(/理由/))}</h3>`,
      `    ${ul(failReasons)}`,
    ]),
    section([block('band tint form', [
      row([`<p>${esc(body[1] || '')}</p>`]),
      row([esc(JA_FORM.label), esc(JA_FORM.placeholder), esc(JA_FORM.button)]),
    ])]),
  ]);
}

/* blog index → English blog design: masthead form + ledger entries. Titles +
   URLs re-extracted from the live JA index (_jp-blog sidecar); teaser for each
   entry is that linked post's own captured meta description (faithful to the
   post — the JA index itself renders no teaser/date). No date/pagination chrome
   is fabricated. */
function buildLocalizedBlogIndex(d) {
  const s = readSidecar('_jp-blog.json');
  if (!s || !(s.entries || []).length) return null;
  const mastRows = [
    row([`<h1>${esc(norm(s.h1)) || clampTitle(d.title)}</h1>`]),
    s.lede ? row([`<p>${esc(norm(s.lede))}</p>`]) : null,
    s.subLine ? row([`<p>${esc(norm(s.subLine))}</p>`]) : null,
    row([esc(JA_FORM.label), esc(JA_FORM.placeholder), esc(JA_FORM.button)]),
  ].filter(Boolean);
  const entryRows = s.entries.map((e, i) => row([
    String(i + 1).padStart(2, '0'),
    `<h3>${esc(norm(e.title))}</h3>${e.teaser ? `<p>${esc(norm(e.teaser))}</p>` : ''}`,
    `<a href="${esc(e.href)}">${esc(norm(e.go) || 'Continue Reading')}</a>`,
  ]));
  return page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead form', mastRows)]),
    section([block('ledger entries', entryRows)]),
  ]);
}

/* wall-of-love → English wall-of-love DESIGN: masthead + `cards cases` grid of
   testimonials + `band tint cta` trial band. Testimonials re-extracted from the
   live JA page (_ja-wall-of-love sidecar) with the same 4-state logo→quote→
   avatar→name machine the English wallOfLove() scrape uses. Each card carries
   the captured avatar (or logo), name, company and quote — verbatim. The trial
   band reuses the JA page's own sign-up CTA; no band heading exists on the JA
   page, so none is invented. */
function buildLocalizedWallOfLove(d) {
  const s = readSidecar('_ja-wall-of-love.json');
  if (!s || !(s.testimonials || []).length) return buildStaticGeneric(d);
  const h1 = norm(s.h1) || clampTitle(d.title);
  const lede = norm(d.description || s.desc || '');
  const cardRows = s.testimonials.map((c) => {
    const cells = [];
    const src = c.avatar || c.logo;
    if (src) cells.push(imgUrl(src, c.name || c.company || ''));
    cells.push(c.name ? `<h3>${esc(norm(c.name))}</h3>` : '');
    if (norm(c.company)) cells.push(esc(norm(c.company)));
    cells.push(`<p>${esc(norm(c.quote))}</p>`);
    return row(cells);
  });
  const sections = [
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead', [
      row([`<h1>${esc(h1)}</h1>`]),
      lede ? row([`<p>${esc(lede)}</p>`]) : null,
    ].filter(Boolean))]),
    section([block('cards cases', cardRows)]),
  ];
  if (s.trial && s.trial.href) {
    sections.push(section([block('band tint cta', [
      row([`<p><strong><a href="${esc(cleanHref(s.trial.href))}">${esc(norm(s.trial.label))}</a></strong></p>`]),
    ])]));
  }
  return page(sections);
}

/* affiliate → English affiliate DESIGN: masthead + `steps` + 3× `feature-hero
   case` + `band tint cta` + `accordion`. Re-extracted from the live JA page
   (_ja-affiliate sidecar) with the same scrape as extract-affiliate.mjs — the
   JA page is the identical HubSpot template. Section heads ("Here's how our
   affiliate…", "Here's what the customers you refer…") come from the ja-affiliate
   capture headings; step ordinals ("Step N") are the only authored labels, as in
   the English builder. Everything else is verbatim. */
function buildLocalizedAffiliate(d) {
  const a = readSidecar('_ja-affiliate.json');
  if (!a || !a.masthead) return buildStaticGeneric(d);
  const H = d.headings || [];
  const headText = (re) => norm((H.find((h) => re.test(norm(h.text))) || {}).text);
  const img = (m) => (m && m.src ? imgTag(m) : '');

  const mastRows = [
    row([`<h1>${esc(norm(a.masthead.h1))}</h1>`]),
    a.masthead.lede ? row([`<p>${esc(norm(a.masthead.lede))}</p>`]) : null,
    a.masthead.cta && a.masthead.cta.href
      ? row([`<p><strong><a href="${esc(cleanHref(a.masthead.cta.href))}">${esc(norm(a.masthead.cta.label))}</a></strong></p>`]) : null,
  ].filter(Boolean);

  const stepRows = a.steps.map((s, i) => {
    const copy = [
      `<p>Step ${i + 1}</p>`,
      `<h3>${esc(norm(s.h2))}</h3>`,
      ...s.paras.map((p) => `<p>${esc(norm(p))}</p>`),
      s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${esc(norm(b))}</li>`).join('')}</ul>` : '',
    ].filter(Boolean).join('');
    return row(s.image ? [copy, img(s.image)] : [copy]);
  });

  const promoBlocks = a.promos.map((p, i) => section([block(i === 1 ? 'feature-hero case mirror mist' : 'feature-hero case', [
    row([`<p>${esc(norm(p.category))}</p>`]),
    row([`<h2>${esc(norm(p.h2))}</h2><p>${esc(norm(p.body))}</p>`]),
    p.link && p.link.href ? row([`<p><em><a href="${esc(cleanHref(p.link.href))}">${esc(norm(p.link.label))}</a></em></p>`]) : null,
    p.quote ? row([`<p>${esc(norm(p.quote))}</p>`]) : null,
    (p.avatar || p.citeName) ? row([img(p.avatar), `${esc(norm(p.citeName))}${p.citeRole ? `, ${esc(norm(p.citeRole))}` : ''}`]) : null,
    p.shot ? row([img(p.shot)]) : null,
  ].filter(Boolean))]));

  const sections = [
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead', mastRows)]),
    section([`    <h2>${esc(headText(/how our affiliate/i))}</h2>`, block('steps', stepRows)]),
    section([`    <h2>${esc(headText(/customers you refer/i))}</h2>`]),
    ...promoBlocks,
  ];
  if (a.cta && a.cta.href) {
    sections.push(section([block('band tint cta', [
      row([`<h2>${esc(norm(a.cta.h2))}</h2>`]),
      row([`<p><strong><a href="${esc(cleanHref(a.cta.href))}">${esc(norm(a.cta.label))}</a></strong></p>`]),
    ])]));
  }
  if (a.faq && a.faq.length) {
    sections.push(section([
      '    <h2>FAQ</h2>',
      block('accordion', a.faq.map((f) => row([`<h3>${esc(norm(f.q))}</h3>`, `<p>${f.a}</p>`]))),
    ]));
  }
  return page(sections);
}

/* customers index → English customers DESIGN: masthead + `cards cases` story
   grid. Re-extracted from the live JA page (_ja-customers sidecar): each story
   card carries its banner image (from the tile background), JA title, teaser
   (only where the page has real prose — placeholder "…" teasers dropped) and the
   story link. The English page's `logos table` + `quote band` have no faithful
   JA source, so they are omitted rather than invented. */
function buildLocalizedCustomers(d, loc) {
  const s = readSidecar('_ja-customers.json');
  if (!s || !(s.cards || []).length) return buildCustomersIndex(d, loc);
  const h1 = norm(s.h1) || clampTitle(d.title);
  const mastRows = [row([`<h1>${esc(h1)}</h1>`])];
  if (norm(s.lede)) mastRows.push(row([`<p>${esc(norm(s.lede))}</p>`]));
  if (norm(s.subLine)) mastRows.push(row([`<p>${esc(norm(s.subLine))}</p>`]));
  const caseRows = s.cards.map((c) => {
    const cells = [];
    if (c.img) cells.push(imgUrl(c.img, c.title));
    cells.push(`<h3>${esc(norm(c.title))}</h3>${norm(c.desc) ? `<p>${esc(norm(c.desc))}</p>` : ''}`);
    cells.push(`<a href="${esc(cleanHref(c.href))}">${esc(norm(c.title))}</a>`);
    return row(cells);
  });
  return page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead', mastRows)]),
    section([block('cards cases', caseRows)]),
  ]);
}

/* pricing → English pricing DESIGN (`rate-card`). Re-extracted from the live JA
   pricing widget (_ja-pricing sidecar): 4 MRR-based plans, each with product +
   variant name, description, the page's OWN "スタート価格" (starting-price) label +
   figure + "/月額", trial CTA and feature list — all verbatim. Prices are the
   starting prices the page itself displays; nothing is invented. The English
   page's `sheets addons`, trust logos and quote bands have no faithful JA source
   (the JA page has no add-on/quote sections), so they are omitted. */
function buildLocalizedPricing(d) {
  const s = readSidecar('_ja-pricing.json');
  if (!s || !(s.plans || []).length) return buildStaticGeneric(d);
  const h1 = norm(s.h1) || clampTitle(d.title);
  const rateRows = s.plans.map((p) => row([
    `${p.badge ? `<p>${esc(norm(p.badge))}</p>` : ''}<p>${esc(norm(p.product))}</p><h2>${esc(norm(p.name))}</h2>`,
    `<p>${esc(norm(p.desc))}</p>`,
    `<p>${esc(norm(p.priceLabel))}</p><p>${esc(norm(`${p.fig} ${p.per}`))}</p>`,
    p.cta && p.cta.href ? `<p><strong><a href="${esc(cleanHref(p.cta.href))}">${esc(norm(p.cta.label))}</a></strong></p>` : '',
    `<ul>${p.features.map((f) => `<li>${esc(norm(f))}</li>`).join('')}</ul>`,
  ]));
  return page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead center', [row([`<h1>${esc(h1)}</h1>`])])]),
    section([block('rate-card', rateRows)]),
  ]);
}

/* ── router ────────────────────────────────────────────────────────────── */
function route(d) {
  const { path: urlPath, loc, rest } = parseUrl(d.url);
  if (loc !== 'ja' && loc !== 'jp') return { skip: 'not-localized' };
  if (/sample-test-page/i.test(urlPath)) return { skip: 'sample-test-page' };

  const outBase = urlPath.replace(/^\//, ''); // e.g. jp/blog/churn
  const seg0 = rest[0];

  // bare /ja or /jp root
  if (!seg0) {
    return {
      out: `${loc}/index.html`, html: buildHome(d), template: 'home', degraded: 'home-mirror',
    };
  }

  // blog / academy
  if (seg0 === 'blog' || seg0 === 'academy') {
    if (rest.length > 1) {
      const { html, info } = buildArticle(d, {
        section: seg0,
        defaultBacklink: { text: seg0 === 'academy' ? 'Academy' : 'Blog', href: `https://baremetrics.com/${loc}/${seg0}` },
        titleFallback: rest[rest.length - 1],
      });
      return {
        out: `${outBase}.html`, html, template: `article:${seg0}`, ordered: info.ordered,
      };
    }
    // section index
    if (seg0 === 'academy') {
      const { html } = buildAcademyIndex(d);
      return { out: `${loc}/academy.html`, html, template: 'index:academy' };
    }
    // blog index → crafted ledger-entries design (re-extracted list + per-post
    // teasers); degrade to generic only if the sidecar is unavailable
    const blogHtml = buildLocalizedBlogIndex(d);
    if (blogHtml) {
      return { out: `${outBase}.html`, html: blogHtml, template: 'index:blog' };
    }
    return {
      out: `${outBase}.html`, html: buildStaticGeneric(d), template: 'index:blog', degraded: 'no-blog-index-sidecar',
    };
  }

  // founder-chats
  if (seg0 === 'founder-chats') {
    if (rest.length > 1) {
      const { html } = buildEpisode(d);
      return { out: `${outBase}.html`, html, template: 'episode' };
    }
    const { html } = buildFounderChatsIndex(d);
    return { out: `${loc}/founder-chats.html`, html, template: 'index:founder-chats' };
  }

  // features
  if (seg0 === 'features' && rest.length > 1) {
    const name = rest.slice(1).join('-');
    const { html } = buildFeature(`features-${name}`, d);
    return { out: `${outBase}.html`, html, template: 'feature' };
  }

  // customers
  if (seg0 === 'customers') {
    if (rest.length > 1) {
      const { html } = buildStory(d, { backHref: `https://baremetrics.com/${loc}/customers` });
      return { out: `${outBase}.html`, html, template: 'story' };
    }
    return { out: `${loc}/customers.html`, html: buildLocalizedCustomers(d, loc), template: 'index:customers' };
  }

  // experts (index or category)
  if (seg0 === 'experts') {
    const label = rest.length > 1 ? (EXPERTS_LABELS[rest[1]] || rest[1]) : 'All';
    const { html } = buildExpertsCat(d, { label, locale: loc });
    return { out: `${outBase}.html`, html, template: rest.length > 1 ? 'experts-cat' : 'index:experts' };
  }

  // integrations
  if (INTEGRATIONS.has(seg0)) {
    const { html } = buildIntegration(d);
    return { out: `${outBase}.html`, html, template: 'integration' };
  }

  // static / legal
  if (STATIC.has(seg0)) {
    const bodyEmpty = !(d.body && d.body.length);
    if (seg0 === 'subscribe') {
      return { out: `${outBase}.html`, html: buildSubscribe(d), template: 'static:subscribe' };
    }
    if (seg0 === 'about') {
      return { out: `${outBase}.html`, html: buildLocalizedAbout(d), template: 'static:about' };
    }
    if (seg0 === 'open-startups') {
      return { out: `${outBase}.html`, html: buildLocalizedOpenStartups(d), template: 'static:open-startups' };
    }
    if (seg0 === 'benchmarks') {
      return { out: `${outBase}.html`, html: buildLocalizedBenchmarks(d), template: 'static:benchmarks' };
    }
    if (seg0 === 'wall-of-love') {
      return { out: `${outBase}.html`, html: buildLocalizedWallOfLove(d), template: 'static:wall-of-love' };
    }
    if (seg0 === 'affiliate') {
      return { out: `${outBase}.html`, html: buildLocalizedAffiliate(d), template: 'static:affiliate' };
    }
    // ja/pricing is PARKED: buildLocalizedPricing (below) renders only the plan
    // tiers as a static rate-card, but the live source is an interactive
    // MRR-slider flow (tool-selector + logo strip + scaling prices + comparison
    // sections). Shipping fixed tiers misrepresents the scaling model, so it
    // stays on the generic fallback pending a dedicated pass. The WIP builder +
    // _ja-pricing.json sidecar are kept as a starting point. (see project todo)
    if (LEGAL.has(seg0)) {
      // empty-body legal (e.g. ja/privacy) → mirror the identical English policy
      // (full content); legal WITH captured prose → crafted article template.
      if (bodyEmpty) {
        const html = mirrorEnglishLegal(seg0, d);
        if (html) {
          return {
            out: `${outBase}.html`, html, template: 'static:legal', degraded: 'legal-empty-body→mirrored-english-policy',
          };
        }
      }
      return { out: `${outBase}.html`, html: buildLocalizedLegal(d), template: 'static:legal' };
    }
    return {
      out: `${outBase}.html`, html: buildStaticGeneric(d), template: `static:${seg0}`, degraded: 'flattened-order',
    };
  }

  // unrecognised template → degrade
  return {
    out: `${outBase}.html`, html: buildStaticGeneric(d), template: `unknown:${seg0}`, degraded: 'unrecognised-template',
  };
}

/* ── main ──────────────────────────────────────────────────────────────── */
const files = fs.readdirSync(PAGES).filter((f) => /^(ja|jp)-.*\.json$/.test(f)).sort();
const report = {
  total: files.length, written: 0, byTemplate: {}, byLocale: { ja: 0, jp: 0 }, jpArticleOrdered: 0, jpArticleTotal: 0, degraded: [], skipped: [], errors: [],
};

for (const f of files) {
  let d;
  try {
    d = JSON.parse(fs.readFileSync(path.join(PAGES, f), 'utf8'));
  } catch (e) {
    report.errors.push({ file: f, error: `parse: ${e.message}` });
    continue;
  }
  let r;
  try {
    r = route(d);
  } catch (e) {
    report.errors.push({ file: f, url: d.url, error: e.message });
    continue;
  }
  if (r.skip) { report.skipped.push({ file: f, url: d.url, reason: r.skip }); continue; }
  const dest = writeOut(r.out, r.html);
  report.written += 1;
  report.byTemplate[r.template] = (report.byTemplate[r.template] || 0) + 1;
  const loc = r.out.split('/')[0];
  if (report.byLocale[loc] != null) report.byLocale[loc] += 1;
  if (r.template === 'article:blog' && loc === 'jp') {
    report.jpArticleTotal += 1;
    if (r.ordered) report.jpArticleOrdered += 1;
  }
  if (r.degraded) report.degraded.push({ out: path.relative(ROOT, dest), reason: r.degraded });
}

console.log(JSON.stringify(report, null, 2));
