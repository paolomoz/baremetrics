#!/usr/bin/env node
/**
 * stardust/gen/integrations.mjs — deterministic generator for the 9 Baremetrics
 * INTEGRATION-LANDING pages. Mirrors the approved content/stripe.html archetype:
 *   feature-hero `integration` (provider wordmark pairing if a provider logo is
 *   captured, else a plain hero) → cards trios (feature headings + thumbnails +
 *   verbatim descriptions) → logos strip/counter → quote sheet → feature-hero
 *   `case` promos → band `ink` innovators → ledger `publications` → band `tint`
 *   closing cta.
 *
 * Source of truth: ../baremetrics/stardust/current/pages/<slug>.json (VERBATIM —
 * every heading/paragraph/href/image is read from the capture; nothing invented).
 * Feature cards are bound by a product-copy dictionary: each dictionary entry is
 * a DISTINCTIVE SUBSTRING of a captured Baremetrics feature description, so the
 * card title/href/thumbnail attach to the verbatim captured paragraph.
 *
 * Run: node stardust/gen/integrations.mjs
 */
/* eslint-disable no-console */
import { pathToFileURL } from 'url';
import {
  esc, escAttr, img, clean, metadata, sectionMeta, row, block, section, page, ctaP,
  loadCapture, writePage, pageTitle,
  isBmLogo, isVerified, isCustomerMark, isPaymentStripLogo, isFeatureThumb, isG2, fnOf,
} from './_lib.mjs';

const SLUGS = [
  'shopify-partners', 'chargebee', 'quickbooks', 'xero',
  'apple-itunes-app-store-connect', 'google-play', 'recurly', 'braintree',
  'hubspot-integration',
];

/* product-feature dictionary: distinctive substring of the captured description
   → { title, href token, thumbnail src token, group }. Titles/hrefs/thumbnails
   are all present in the captures (cta labels / feature links / img alts); the
   substring binds them to the verbatim paragraph regardless of provider. */
const FEATURES = [
  { sub: 'lifeblood of your business', title: 'Control Center', href: 'https://baremetrics.com/features/control-center', thumb: 'control-center', group: 'know' },
  { sub: 'how it compares to previous months', title: 'Smart Dashboards', href: 'https://baremetrics.com/features/smart-dashboards', thumb: 'dashboard', group: 'know' },
  { sub: 'well-informed projections for hiring', title: 'Forecasting', href: 'https://baremetrics.com/features/forecasting', thumb: 'forecast', group: 'know' },
  { sub: 'right context by looking at how you compare', title: 'Benchmarks', href: 'https://baremetrics.com/features/benchmarks', thumb: 'benchmarks', group: 'know' },
  { sub: 'rally the team to meet them', title: 'Goals', href: null, thumb: 'goals', group: 'know' },
  { sub: 'new campaigns, experiments, and enhancements', title: 'Trial Insights', href: 'https://baremetrics.com/features/trial-insights', thumb: 'trial-insights', group: 'know' },
  { sub: 'rich customer profiles and precise segments', title: 'Augmentation', href: 'https://baremetrics.com/features/augmentation', thumb: 'augmentation', group: 'data' },
  { sub: 'most profitable customer segments', title: 'Segmentation', href: 'https://baremetrics.com/features/segmentation', thumb: 'segmentation', group: 'data' },
  { sub: 'full history of payments, events, and changes', title: 'People Insights', href: 'https://baremetrics.com/features/people-insights', thumb: 'customers', group: 'data' },
];

const NAV_LABELS = new Set(['Plans & Pricing', 'Sign In', 'Get Started', 'FEATURES', 'Compare', 'Company', 'Publications', 'Open Project', 'Support', 'LEGAL', 'Privacy', 'Security', 'Terms of Use', 'GDPR', 'English', '日本語', 'About', 'Careers', 'Customers', 'Wall of Love', 'Experts', 'Affiliate Partners', 'Contact', 'Blog', 'Academy', 'Founder Chats', 'Startups', 'Benchmarks', 'Build vs Buy', 'Developers', 'Help Center', 'Status', 'Control Center', 'People Insights', 'Smart Dashboards', 'Recover', 'Cancellation Insights', 'Email Reports', 'Trial Insights', 'Segmentation', 'Augmentation', 'Slack Tools', 'Analytics API', 'Hubspot Integration', 'ProfitWell', 'ChartMogul', 'FirstOfficer', 'SaaSOptics', 'MRR.io', 'Stripe Analytics & Dunning', '🇬🇧English▼']);

const isQuote = (t) => /^["“]/.test(t.trim());
const has = (body, sub) => body.find((b) => b.toLowerCase().includes(sub.toLowerCase()));

function classifyImgs(imgs) {
  const b = {
    bm: null, verified: null, customer: [], payment: [], thumbs: [], avatars: [],
    exhibits: [], provider: null, other: [],
  };
  imgs.forEach((m) => {
    const fn = fnOf(m);
    if (isBmLogo(m)) { if (!b.bm) b.bm = m; return; }
    if (isVerified(m)) { b.verified = m; return; }
    if (isCustomerMark(m)) { b.customer.push(m); return; }
    if (isPaymentStripLogo(m)) { b.payment.push(m); return; }
    if (isG2(m)) { b.other.push(m); return; }
    if (/^user-|user%20|user /i.test(fn) || (/\.(png|jpe?g)$/i.test(fn) && m.w && m.h && Math.abs(m.w - m.h) <= 5 && m.w <= 500 && /user|matt|ben|tushar/i.test(fn))) { b.avatars.push(m); return; }
    if (/animation-|homepage-|innovators|features_|banner|-boom|_gs_/i.test(fn) && m.w >= 900) { b.exhibits.push(m); return; }
    if (isFeatureThumb(m) && m.w >= 700) { b.thumbs.push(m); return; }
    b.other.push(m);
  });
  /* provider logo: first medium non-feature brand mark near the top */
  b.provider = imgs.find((m) => !isBmLogo(m) && !isVerified(m) && !isCustomerMark(m)
    && !isPaymentStripLogo(m) && !isG2(m) && !b.thumbs.includes(m) && !b.exhibits.includes(m)
    && !b.avatars.includes(m)
    && m.w >= 100 && !(/icon-|-icon\.|_icon/i.test(m.src))
    && !/animation-|homepage-|innovators|features_/i.test(fnOf(m))) || null;
  return b;
}

/* connect (primary) + talk/demo (secondary) CTA from the capture */
function heroCtas(cap) {
  const c = cap.ctas;
  const connect = c.find((x) => /sign-up-with/i.test(x.href || '') && /^connect/i.test(x.label))
    || c.find((x) => /^connect/i.test(x.label))
    || c.find((x) => /sign-up-with/i.test(x.href || ''));
  const talk = c.find((x) => /^(talk to us|book a demo|see it in action)$/i.test(x.label))
    || c.find((x) => /book-a-demo|\/meetings\//i.test(x.href || ''))
    || c.find((x) => /^demo\.baremetrics/i.test((x.href || '').replace(/^https?:\/\//, '')))
    || c.find((x) => /^mailto:hello@baremetrics/i.test(x.href || '') && /talk/i.test(x.label));
  const out = [];
  if (connect) out.push({ text: connect.label, href: connect.href, kind: 'primary' });
  if (talk && talk !== connect) out.push({ text: talk.label, href: talk.href, kind: 'secondary' });
  return out;
}

/* per-capture build (exported for reuse by the localized router) */
export function buildIntegration(cap) {
  const H = cap.headings;
  const body = cap.body.map(clean).filter(Boolean);
  const used = new Set(); // body items consumed
  const consume = (t) => { if (t) used.add(t); return t; };
  const b = classifyImgs(cap.media.imgs);
  const h2s = H.filter((h) => h.tag === 'h2').map((h) => clean(h.text));
  const h5s = H.filter((h) => h.tag === 'h5').map((h) => clean(h.text));
  const h1 = clean((H.find((h) => h.tag === 'h1') || {}).text);
  const notes = [];
  const sections = [metadata(pageTitle(cap), clean(cap.description))];

  /* ── hero ─────────────────────────────────────────────────────────── */
  const cta = heroCtas(cap);
  const heroLede = consume(body[0]);
  const exhibit = b.exhibits[0] || null;
  if (b.provider) {
    const heroRows = [row([img(b.bm), img(b.provider)])]; // wordmark pairing
    if (b.verified) heroRows.push(row([img(b.verified)]));
    if (h1) heroRows.push(row([`<h1>${esc(h1)}</h1>`]));
    if (heroLede) heroRows.push(row([`<p>${esc(heroLede)}</p>`]));
    if (cta.length) heroRows.push(row([ctaP(cta)]));
    if (exhibit) heroRows.push(row([img(exhibit)]));
    sections.push(section([block('feature-hero integration', heroRows)]));
    notes.push('feature-hero integration (wordmark pairing)');
  } else {
    /* plain hero — no provider wordmark captured → masthead (no dangling ×) */
    const mRows = [];
    if (h1) mRows.push(row([`<h1>${esc(h1)}</h1>`]));
    if (heroLede) mRows.push(row([`<p>${esc(heroLede)}</p>`]));
    if (cta.length) mRows.push(row([ctaP(cta)]));
    sections.push(section([block('masthead', mRows)]));
    notes.push('masthead (plain hero — no provider logo captured)');
  }

  /* ── feature cards (dictionary-bound) ─────────────────────────────── */
  const matched = [];
  FEATURES.forEach((f) => {
    const desc = has(body, f.sub);
    if (!desc || used.has(desc)) return;
    consume(desc);
    const thumb = cap.media.imgs.find((m) => new RegExp(`(thumbnail_${f.thumb}|${f.thumb}-thumb|${f.thumb}[-_.0-9]*\\.(png|jpg))`, 'i').test(fnOf(m)) && b.thumbs.includes(m))
      || cap.media.imgs.find((m) => b.thumbs.includes(m) && fnOf(m).includes(f.thumb));
    matched.push({ ...f, desc, thumb });
  });
  const emitCards = (feats, variant, head) => {
    if (!feats.length) return;
    const rows = feats.map((f) => {
      const cells = [`<h3>${esc(f.title)}</h3><p>${esc(f.desc)}</p>`];
      if (f.thumb) cells.push(img(f.thumb));
      return row(cells);
    });
    const parts = [];
    if (head) parts.push(`    <h2>${esc(head)}</h2>`);
    parts.push(block(`cards ${variant}`, rows));
    sections.push(section(parts));
  };
  const know = matched.filter((f) => f.group === 'know');
  const data = matched.filter((f) => f.group === 'data');
  const featureHeads = h2s.filter((t) => /^make more by/i.test(t));
  const cardHeadsUsed = new Set();
  const specialRe = /join the movement|our publications|get baremetrics|keep exploring|learn why|get help/i;
  let knowHead = featureHeads[0]
    || h2s.find((t) => /toolkit|all-in-one|feature/i.test(t))
    || h2s.find((t) => !specialRe.test(t)) || null;
  let dataHead = featureHeads.find((t) => /making data-driven/i.test(t)) || null;
  /* triptych for both (mosaic grid-areas only define a/b/c → >3 panels overlap) */
  if (know.length) { emitCards(know, 'triptych', knowHead); if (knowHead) cardHeadsUsed.add(knowHead); notes.push(`cards triptych (${know.length} feature cards)`); }
  if (data.length) { emitCards(data, 'triptych', dataHead); if (dataHead) cardHeadsUsed.add(dataHead); notes.push(`cards triptych (${data.length} feature cards)`); }

  /* ── logos ────────────────────────────────────────────────────────── */
  const counterH5 = h5s.find((t) => /companies using baremetrics/i.test(t));
  if (b.customer.length) {
    if (counterH5) {
      const m = counterH5.match(/^(\+?[\d,]+)\s+(.*)$/);
      sections.push(section([block('logos counter mist', [
        row([esc(m ? m[1] : '+900'), esc(m ? m[2] : counterH5)]),
        row(b.customer.map(img)),
      ])]));
      notes.push(`logos counter (${b.customer.length} marks)`);
    } else {
      sections.push(section([block('logos strip', [row(b.customer.map(img))])]));
      notes.push(`logos strip (${b.customer.length} marks)`);
    }
  }

  /* ── testimonial quote (first captured quote with an avatar) ──────── */
  const quoteText = body.find((t) => isQuote(t) && !used.has(t));
  const quoteName = clean((H.find((h) => h.tag === 'h4') || {}).text);
  if (quoteText && b.avatars[0]) {
    consume(quoteText);
    const g2 = b.other.find((m) => isG2(m));
    const g2href = (cap.ctas.find((x) => /g2\.com/i.test(x.href || '')) || {}).href
      || (cap.links.find((l) => /g2\.com/i.test(l)) || null);
    const qrows = [
      row([`<p>${esc(quoteText)}</p>`]),
      row([img(b.avatars[0]), esc(quoteName || ''), '']),
    ];
    if (g2) qrows.push(row([`<a href="${escAttr(g2href || '#')}">${img(g2)}</a>`]));
    sections.push(section([block('quote sheet mist', qrows)]));
    notes.push('quote sheet (testimonial)');
  }

  /* ── feature-hero case promos (cancellation / recover) ───────────── */
  const casePromo = (h2match, chip, ledeSub, learnHrefRe, exhibitRe) => {
    const head = h2s.find((t) => h2match.test(t));
    if (!head) return;
    const lede = body.find((t) => t.toLowerCase().includes(ledeSub) && !used.has(t));
    const learn = cap.ctas.find((x) => learnHrefRe.test(x.href || ''));
    const ex = cap.media.imgs.find((m) => exhibitRe.test(fnOf(m)));
    const rows = [row([`<p>${esc(chip)}</p>`]), row([`<h2>${esc(head)}</h2>${lede ? `<p>${esc(consume(lede))}</p>` : ''}`])];
    const cs = [...heroCtas(cap).filter((c) => c.kind === 'primary')];
    if (learn) cs.push({ text: learn.label, href: learn.href, kind: 'plain' });
    if (cs.length) rows.push(row([ctaP(cs)]));
    const q = body.find((t) => isQuote(t) && !used.has(t));
    if (q) rows.push(row([`<p>${esc(consume(q))}</p>`]));
    if (ex) rows.push(row([img(ex)]));
    return { head, rows };
  };
  const cancel = casePromo(/learn why your customers cancel/i, 'Cancellation Insights', 'valuable feedback in minutes', /cancellation-insights/i, /features_cancellation|cancellation-insights/i);
  if (cancel) { sections.push(section([block('feature-hero case mist', cancel.rows)])); notes.push('feature-hero case (cancellation)'); }
  const recover = casePromo(/get help with failing charges/i, 'Recover', 'leaking money every month', /features\/recover/i, /features_recover|homepage-features_recover/i);
  if (recover) { sections.push(section([block('feature-hero case mirror', recover.rows)])); notes.push('feature-hero case mirror (recover)'); }

  /* ── innovators band ──────────────────────────────────────────────── */
  const innoHead = h2s.find((t) => /join the movement/i.test(t));
  if (innoHead) {
    const lede = body.find((t) => t.toLowerCase().includes('land of the brave') && !used.has(t));
    const view = cap.ctas.find((x) => /open-startups/i.test(x.href || ''));
    const innoImg = cap.media.imgs.find((m) => /innovators/i.test(fnOf(m)));
    const rows = [row([`<h2>${esc(innoHead)}</h2>${lede ? `<p>${esc(consume(lede))}</p>` : ''}`])];
    if (view) rows.push(row([ctaP([{ text: view.label, href: view.href, kind: 'primary' }])]));
    if (innoImg) rows.push(row([img(innoImg)]));
    sections.push(section([block('band ink cta split innovators', rows)]));
    notes.push('band ink cta (innovators)');
  }

  /* ── publications ledger ──────────────────────────────────────────── */
  const pubHead = h2s.find((t) => /our publications/i.test(t));
  const pubs = cap.ctas.filter((x) => /^\w+ \d{1,2},? \d{4}/.test(x.label) && /\/blog\//i.test(x.href || ''))
    .map((x) => {
      const mm = x.label.match(/^(\w+ \d{1,2},? \d{4})\s+(.*)$/);
      return { date: mm ? mm[1] : '', title: mm ? mm[2] : x.label, href: x.href };
    });
  if (pubHead && pubs.length) {
    const kicker = h5s.find((t) => /learn about/i.test(t));
    const lede = body.find((t) => t.toLowerCase().includes('thousands of subscribers') && !used.has(t));
    const subLabel = body.find((t) => /industry insights delivered/i.test(t));
    if (lede) consume(lede);
    if (subLabel) consume(subLabel);
    const parts = [];
    if (kicker) parts.push(`    <p>${esc(kicker)}</p>`);
    parts.push(`    <h2>${esc(pubHead)}</h2>`);
    if (lede) parts.push(`    <p>${esc(lede)}</p>`);
    const prows = pubs.map((p) => row([esc(p.date), `<a href="${escAttr(p.href)}">${esc(p.title)}</a>`]));
    if (subLabel) prows.push(row([esc(subLabel), 'Enter your email', 'Subscribe']));
    parts.push(block('ledger publications', prows));
    sections.push(section(parts));
    notes.push(`ledger publications (${pubs.length} entries)`);
  }

  /* ── generic unmatched h2 sections (non-clone pages) ─────────────── */
  const closingRe = /get baremetrics for your (company|shopify)|keep exploring features/i;
  const consumedHeads = new Set([...featureHeads, ...cardHeadsUsed, cancel && cancel.head, recover && recover.head, innoHead, pubHead].filter(Boolean));
  const remainingContent = body.filter((t) => !used.has(t) && !isQuote(t) && t.length > 24
    && !pubs.some((p) => p.title === t) && !/industry insights delivered/i.test(t) && !closingRe.test(t));
  const unmatchedHeads = h2s.filter((t) => !consumedHeads.has(t) && !closingRe.test(t));
  let cp = 0;
  unmatchedHeads.forEach((head, i) => {
    const lede = remainingContent[cp]; cp += 1;
    if (lede) consume(lede);
    const grounds = ['band tint cta', 'band accent', 'band mist'];
    sections.push(section([block(grounds[i % grounds.length], [
      row([`<h2>${esc(head)}</h2>${lede ? `<p>${esc(lede)}</p>` : ''}`]),
    ])]));
  });
  if (unmatchedHeads.length) notes.push(`band (${unmatchedHeads.length} generic sections)`);

  /* ── closing band ─────────────────────────────────────────────────── */
  const closeHead = h2s.find((t) => closingRe.test(t));
  const closeLede = body.slice().reverse().find((t) => !used.has(t) && t.length > 24 && !isQuote(t) && !pubs.some((p) => p.title === t));
  const cRows = [];
  if (closeHead || closeLede) cRows.push(row([`${closeHead ? `<h2>${esc(closeHead)}</h2>` : ''}${closeLede ? `<p>${esc(consume(closeLede))}</p>` : ''}`]));
  const closeCta = heroCtas(cap).filter((c) => c.kind === 'primary');
  if (closeCta.length) cRows.push(row([ctaP(closeCta)]));
  if (b.verified) cRows.push(row([img({ ...b.verified })]));
  const closeImg = cap.media.imgs.find((m) => /homepage-control-center\.jpg/i.test(fnOf(m)));
  if (closeImg) cRows.push(row([img(closeImg)]));
  if (cRows.length >= 2) {
    sections.push(section([block('band tint cta closing', cRows)]));
    notes.push('band tint cta (closing)');
  }

  const html = page(sections);
  return { html, notes };
}

/* ── CLI entry (English bulk generation — unchanged output) ────────────── */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const results = SLUGS.map((slug) => {
    const cap = loadCapture(slug);
    const { html, notes } = buildIntegration(cap);
    const dest = writePage(`${slug}.html`, html);
    return { slug, dest, notes };
  });
  results.forEach((r) => console.log(`\n${r.slug} → content/${r.slug}.html\n  ${r.notes.join('\n  ')}`));
  console.log(`\ndone: ${results.length} integration pages`);
}
