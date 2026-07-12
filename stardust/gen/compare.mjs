#!/usr/bin/env node
/**
 * stardust/gen/compare.mjs — deterministic generator for the 6 Baremetrics
 * COMPARE pages. Mirrors content/compare/profitwell-alternative.html:
 *   masthead `versus` → logos strip → [differentiators] → sheets honest/support
 *   (if captured) → accordion FAQ → band `ink` cta close.
 *
 * Matrix decode: NONE of the 6 captures expose ACTUAL comparison rows — the
 * numbered-differentiator pages have no matrix at all, and chartmogul's matrix
 * survives only as bare ✓/✗ icons with NO captured row labels or column text.
 * Per the contract we therefore NEVER fabricate a matrix; every page uses the
 * prose fallback (cards/band/sheets) for its captured differentiator sections.
 *
 * Two capture shapes:
 *   numbered  (stripe-analytics, mrrio, firstofficer, saasoptics, mantle):
 *             numbered h3 differentiators, each with h4 sub-features → cards;
 *             interleaved testimonials → quote sheets; h6 FAQ → accordion.
 *   chartmogul: Why/What-sets-apart (band), WHAT-ONLY feature cards, PRICING
 *             stage cards, BEING-HONEST + SUPPORT sheets, FAQ accordion.
 *
 * Source of truth: ../baremetrics/stardust/current/pages/<slug>.json (VERBATIM).
 * Run: node stardust/gen/compare.mjs
 */
/* eslint-disable no-console */
import {
  esc, escAttr, img, clean, metadata, sectionMeta, row, block, section, page, ctaP,
  loadCapture, writePage, pageTitle, isPaymentStripLogo, fnOf,
} from './_lib.mjs';

const SLUGS = [
  'compare-stripe-analytics-alternative', 'compare-mantle-alternative',
  'compare-mrrio-alternative', 'compare-chartmogul-alternative',
  'compare-firstofficer-alternative', 'compare-saasoptics-alternative',
];

const isQuote = (t) => /^["“]/.test(t.trim());

/* start-trial (primary) + demo (secondary) CTA from the capture */
function trialCtas(cap) {
  const c = cap.ctas;
  const trial = c.find((x) => /free trial|start free trial|start your free trial/i.test(x.label) && /sign_up/i.test(x.href || ''))
    || c.find((x) => /^get started$/i.test(x.label) && /sign_up|sign-up/i.test(x.href || ''))
    || c.find((x) => /sign_up/i.test(x.href || ''));
  const demo = c.find((x) => /see it in action|talk to the team|demo/i.test(x.label) && /demo\.baremetrics/i.test(x.href || ''))
    || c.find((x) => /demo\.baremetrics/i.test(x.href || ''));
  const out = [];
  if (trial) out.push({ text: trial.label, href: trial.href, kind: 'primary' });
  if (demo && demo !== trial) out.push({ text: demo.label, href: demo.href, kind: 'secondary' });
  return out;
}

function providerLogos(cap) {
  return cap.media.imgs.filter(isPaymentStripLogo);
}

function mastheadSection(cap, body, h1) {
  const rows = [row([`<h1>${esc(h1)}</h1>`])];
  const beats = [];
  // two-beat: h1 has "vs" and body[0]/body[1] are short paired beats
  if (/\bvs\.?\b/i.test(h1) && body[0] && body[0].length <= 60 && body[1] && body[1].length <= 60) {
    beats.push(body[0], body[1]);
    rows.push(row([`<p>${esc(body[0])}</p>`]), row([`<p>${esc(body[1])}</p>`]));
  }
  if (!beats.length && body[0] && body[0].length > 40) rows.push(row([`<p>${esc(body[0])}</p>`]));
  const cta = trialCtas(cap);
  if (cta.length) rows.push(row([ctaP(cta)]));
  return { rows, beats };
}

function logosSection(cap) {
  const label = (cap.headings.find((h) => h.tag === 'h5' && /integrates with/i.test(h.text)) || {}).text;
  const logos = providerLogos(cap);
  if (!logos.length) return null;
  const rows = [];
  if (label) rows.push(row([esc(clean(label))]));
  rows.push(row(logos.map(img)));
  return { block: block('logos strip int', rows), count: logos.length };
}

function faqSection(cap, body) {
  // FAQ questions: h6 headings (numbered family) or null-href "?" ctas (chartmogul)
  let questions = cap.headings.filter((h) => h.tag === 'h6' && /\?$/.test(h.text)).map((h) => clean(h.text));
  if (!questions.length) questions = cap.ctas.filter((x) => x.href === null && /\?$/.test(x.label)).map((x) => clean(x.label));
  if (!questions.length) return null;
  const answers = body.slice(body.length - questions.length);
  const rows = questions.map((q, i) => row([esc(q), `<p>${esc(answers[i] || '')}</p>`]));
  const more = cap.ctas.find((x) => /contact us/i.test(x.label) && /mailto:/i.test(x.href || ''));
  if (more) rows.push(row([`<p>More questions? <a href="${escAttr(more.href)}">${esc(more.label)}</a></p>`]));
  return { section: section(['    <h2>Frequently Asked Questions</h2>', block('accordion', rows)]), count: questions.length, answers };
}

/* ── numbered-differentiator family ─────────────────────────────────── */
function buildNumbered(cap, notes) {
  const H = cap.headings;
  const body = cap.body.map(clean).filter(Boolean);
  const h1 = clean((H.find((h) => h.tag === 'h1') || {}).text);
  const sections = [metadata(pageTitle(cap), clean(cap.description))];

  const { rows: mastRows } = mastheadSection(cap, body, h1);
  sections.push(section([block('masthead versus', mastRows)]));
  notes.push('masthead versus');
  const logos = logosSection(cap);
  if (logos) { sections.push(section([logos.block])); notes.push(`logos strip (${logos.count})`); }

  const faq = faqSection(cap, body);
  const nH6 = (faq ? faq.count : 0);

  // testimonials: a body item equal to an img alt (person name) + preceding quote
  const altSet = new Set(cap.media.imgs.map((m) => clean(m.alt)).filter(Boolean));
  const testim = [];
  const consumed = new Set();
  body.forEach((t, i) => {
    if (i === 0) return;
    if (altSet.has(t) && t.length <= 32 && /^[A-Z][a-zA-Z.]+(\s+[A-Za-z.]+){0,3}$/.test(t) && i > 0 && isQuote(body[i - 1]) === false && body[i - 1].length > 60) {
      const avatar = cap.media.imgs.find((m) => clean(m.alt) === t);
      testim.push({ quote: body[i - 1], name: t, avatar });
      consumed.add(i); consumed.add(i - 1);
    }
  });

  const faqAnswers = faq ? new Set(faq.answers) : new Set();
  const mastheadLede = body[0];
  // "why choose/upgrade" intro
  const whyHead = H.find((h) => h.tag === 'h3' && /why (choose|upgrade)/i.test(h.text));
  const whyIntro = whyHead ? body[1] : null;
  const closingIdx = body.length - nH6 - 1;
  const closingLede = (closingIdx > 0 && body[closingIdx] && body[closingIdx].length > 60 && !consumed.has(closingIdx) && !faqAnswers.has(body[closingIdx])) ? body[closingIdx] : null;

  const descPool = body.filter((t, i) => i !== 0 && !consumed.has(i) && !faqAnswers.has(t)
    && t !== whyIntro && t !== closingLede && t.length > 40 && !isQuote(t));

  // group h4 cards under their parent numbered h3 (heading order)
  const skipH4 = (t) => /^(powering|see why teams|frequently asked)/i.test(t);
  const groups = [];
  let cur = null;
  H.forEach((h) => {
    if (h.tag === 'h3') {
      if (whyHead && clean(h.text) === clean(whyHead.text)) { cur = null; return; }
      cur = { head: clean(h.text), h4s: [] };
      groups.push(cur);
    } else if (h.tag === 'h4' && cur && !skipH4(clean(h.text))) {
      cur.h4s.push(clean(h.text));
    }
  });

  // why-choose section (prose lede)
  if (whyHead) {
    const parts = [`    <h2>${esc(clean(whyHead.text))}</h2>`];
    if (whyIntro) parts.push(`    <p>${esc(whyIntro)}</p>`);
    sections.push(section([block('band mist', [row([`<h2>${esc(clean(whyHead.text))}</h2>${whyIntro ? `<p>${esc(whyIntro)}</p>` : ''}`])])]));
    notes.push('band (why-choose intro)');
  }

  // differentiator cards
  const compImgs = cap.media.imgs.filter((m) => m.w >= 700 && m.w <= 900 && m.h >= 700 && /comparison-|stripe-alternative|recover-/i.test(fnOf(m)));
  let di = 0;
  let ii = 0;
  let cardCount = 0;
  groups.forEach((g) => {
    if (!g.h4s.length) {
      // numbered head with no card h4s — emit as a band with next desc
      const lede = descPool[di]; if (lede) di += 1;
      sections.push(section([block('band tint', [row([`<h2>${esc(g.head)}</h2>${lede ? `<p>${esc(lede)}</p>` : ''}`])])]));
      return;
    }
    const cardRows = g.h4s.map((h4) => {
      const desc = descPool[di]; di += 1;
      const im = compImgs[ii]; ii += 1;
      const cells = [`<h3>${esc(h4)}</h3>${desc ? `<p>${esc(desc)}</p>` : ''}`];
      if (im) cells.push(img(im));
      cardCount += 1;
      return row(cells);
    });
    sections.push(section([`    <h2>${esc(g.head)}</h2>`, block('cards triptych', cardRows)]));
  });
  notes.push(`cards (${cardCount} differentiator sub-features across ${groups.length} sections)`);

  // testimonials → quote sheets
  if (testim.length) {
    testim.forEach((tm) => {
      const qrows = [row([`<p>${esc(tm.quote)}</p>`])];
      if (tm.avatar) qrows.push(row([img(tm.avatar), esc(tm.name), '']));
      else qrows.push(row([`<p>${esc(tm.name)}</p>`]));
      sections.push(section([block('quote sheet mist', qrows)]));
    });
    notes.push(`quote sheet ×${testim.length} (testimonials)`);
  }

  // FAQ
  if (faq) { sections.push(faq.section); notes.push(`accordion (${faq.count} FAQ)`); }

  // closing
  const cta = trialCtas(cap);
  const cRows = [];
  if (closingLede) cRows.push(row([`<p>${esc(closingLede)}</p>`]));
  if (cta.length) cRows.push(row([ctaP(cta)]));
  if (cRows.length) { sections.push(section([block('band ink cta', cRows)])); notes.push('band ink cta (close)'); }

  return page(sections);
}

/* ── chartmogul (structured single page) ────────────────────────────── */
function buildChartmogul(cap, notes) {
  const H = cap.headings;
  const body = cap.body.map(clean).filter(Boolean);
  const h1 = clean((H.find((h) => h.tag === 'h1') || {}).text);
  const idx = (sub) => body.findIndex((t) => t.toLowerCase().includes(sub.toLowerCase()));
  const at = (sub) => { const i = idx(sub); return i >= 0 ? body[i] : null; };
  const sections = [metadata(pageTitle(cap), clean(cap.description))];

  // masthead versus (two-beat)
  const { rows: mastRows } = mastheadSection(cap, body, h1);
  sections.push(section([block('masthead versus', mastRows)]));
  notes.push('masthead versus (two-beat)');
  const logos = logosSection(cap);
  if (logos) { sections.push(section([logos.block])); notes.push(`logos strip (${logos.count})`); }

  // Why Choose Baremetrics? → band
  const why = at('Both tools give you MRR');
  sections.push(section([block('band mist', [row([`<h2>Why Choose Baremetrics?</h2>${why ? `<p>${esc(why)}</p>` : ''}`])])]));
  notes.push('band (why choose)');

  // What sets Baremetrics apart → band (matrix skipped: no captured rows)
  const wa1 = at('Both tools track your SaaS metrics');
  const wa2 = at('The difference shows up');
  const waHead = (H.find((h) => /what sets baremetrics apart/i.test(h.text)) || {}).text;
  sections.push(section([block('band tint', [row([`<h2>${esc(clean(waHead) || 'What sets Baremetrics apart from ChartMogul')}</h2>${wa1 ? `<p>${esc(wa1)}</p>` : ''}${wa2 ? `<p>${esc(wa2)}</p>` : ''}`])])]));
  notes.push('band (what-sets-apart — matrix skipped: no captured rows → prose fallback)');

  // WHAT ONLY BAREMETRICS DOES → 3 feature cards (title/desc/price)
  const featStart = body.findIndex((t, i) => t === 'Recover' && /put dunning on autopilot/i.test(body[i + 1] || ''));
  const feats = [];
  if (featStart >= 0) {
    for (let i = featStart; i < body.length - 2; i += 3) {
      const title = body[i]; const desc = body[i + 1]; const price = body[i + 2];
      if (!/^(recover|cancellation insights|forecast plus)$/i.test(title)) break;
      feats.push({ title, desc, price });
    }
  }
  const featHref = { Recover: 'https://baremetrics.com/features/recover', 'Cancellation Insights': 'https://baremetrics.com/features/cancellation-insights', 'Forecast Plus': 'https://baremetrics.com/features/forecasting' };
  if (feats.length) {
    const rows = feats.map((f) => row([`<h3>${esc(f.title)}</h3><p>${esc(f.desc)}</p><p>${esc(f.price)}</p>`]));
    sections.push(section(['    <h2>WHAT ONLY BAREMETRICS DOES</h2>', '    <h3>Put Action Behind Your SaaS Metrics</h3>', block('cards triptych', rows)]));
    notes.push(`cards (${feats.length} what-only features)`);
  }

  // PRICING REALITY → 3 stage cards
  const priceIntro = at("Where ChartMogul wins on price");
  const stageLabels = body.map((t, i) => ({ t, i })).filter((x) => /^(pre-\$?\d|\$\d.*mrr|\$\d+k\+ mrr)/i.test(x.t) && /mrr/i.test(x.t));
  const stageRows = [];
  stageLabels.forEach((s, k) => {
    const end = k + 1 < stageLabels.length ? stageLabels[k + 1].i : idx('You want a native CRM');
    const chunk = body.slice(s.i, end > s.i ? end : s.i + 5);
    const [label, title, desc, ...rest] = chunk;
    stageRows.push(row([`<h3>${esc(label)}</h3><p>${esc(title || '')}</p><p>${esc(desc || '')}</p>${rest.filter((r) => r && r.length < 60).map((r) => `<p>${esc(r)}</p>`).join('')}`]));
  });
  if (stageRows.length) {
    const prHead = (H.find((h) => /pricing reality/i.test(h.text)) || {}).text;
    const prSub = (H.find((h) => /right tool at every stage/i.test(h.text)) || {}).text;
    const parts = [`    <h2>${esc(clean(prHead) || 'PRICING REALITY')}</h2>`];
    if (prSub) parts.push(`    <h3>${esc(clean(prSub))}</h3>`);
    if (priceIntro) parts.push(`    <p>${esc(priceIntro)}</p>`);
    parts.push(block('cards triptych', stageRows));
    sections.push(section(parts));
    notes.push(`cards (${stageRows.length} pricing stages)`);
  }

  // BEING HONEST → sheets honest (title/desc pairs)
  const honestStart = idx('You want a native CRM');
  const honestIcons = cap.media.imgs.filter((m) => /icons_honest/i.test(fnOf(m)));
  const honest = [];
  if (honestStart >= 0) {
    const supIdx = idx('Hands-on working sessions');
    const chunk = body.slice(honestStart, supIdx > 0 ? supIdx : honestStart + 8);
    for (let i = 0; i + 1 < chunk.length; i += 2) honest.push({ title: chunk[i], desc: chunk[i + 1] });
  }
  if (honest.length) {
    const rows = honest.map((h, i) => row([img(honestIcons[i]), `<h4>${esc(h.title)}</h4><p>${esc(h.desc)}</p>`]));
    const hHead = (H.find((h) => /being honest/i.test(h.text)) || {}).text;
    const hSub = (H.find((h) => /where chartmogul might be a better fit/i.test(h.text)) || {}).text;
    sections.push(section([`    <h2>${esc(clean(hHead) || 'BEING HONEST')}</h2>`, `    <h3>${esc(clean(hSub) || '')}</h3>`, block('sheets honest', rows), sectionMeta('mist')]));
    notes.push(`sheets honest (${honest.length})`);
  }

  // SUPPORT → sheets support (figure/note)
  const supLede = at('Hands-on working sessions');
  const supIcons = cap.media.imgs.filter((m) => /icons_support/i.test(fnOf(m)));
  const sup = [];
  const supStart = idx('~2 min response');
  if (supStart >= 0) {
    const faqIdx = idx('Frequently Asked Questions');
    const chunk = body.slice(supStart, faqIdx > 0 ? faqIdx : supStart + 6);
    for (let i = 0; i + 1 < chunk.length; i += 2) sup.push({ fig: chunk[i], note: chunk[i + 1] });
  }
  if (sup.length) {
    const rows = sup.map((s, i) => row([img(supIcons[i]), esc(s.fig), esc(s.note)]));
    const sHead = (H.find((h) => /^support$/i.test(h.text)) || {}).text;
    const sSub = (H.find((h) => /support model is part of the product/i.test(h.text)) || {}).text;
    const parts = [`    <h2>${esc(clean(sHead) || 'SUPPORT')}</h2>`];
    if (sSub) parts.push(`    <h3>${esc(clean(sSub))}</h3>`);
    if (supLede) parts.push(`    <p>${esc(supLede)}</p>`);
    parts.push(block('sheets support', rows));
    sections.push(section(parts));
    notes.push(`sheets support (${sup.length})`);
  }

  // FAQ
  const faq = faqSection(cap, body);
  if (faq) { sections.push(faq.section); notes.push(`accordion (${faq.count} FAQ)`); }

  // closing
  const closeHead = (H.find((h) => /ready to action your saas metrics/i.test(h.text)) || {}).text;
  const closeLede = body[body.length - 1];
  const cta = trialCtas(cap);
  const cRows = [row([`<h2>${esc(clean(closeHead) || 'Ready to go deeper?')}</h2>`])];
  if (closeLede && closeLede.length > 30) cRows.push(row([`<p>${esc(closeLede)}</p>`]));
  if (cta.length) cRows.push(row([ctaP(cta)]));
  sections.push(section([block('band ink cta', cRows)]));
  notes.push('band ink cta (close)');

  return page(sections);
}

function build(slug) {
  const cap = loadCapture(slug);
  const notes = [];
  const isChartmogul = /chartmogul/i.test(slug);
  const html = isChartmogul ? buildChartmogul(cap, notes) : buildNumbered(cap, notes);
  const name = slug.replace(/^compare-/, '');
  const dest = writePage(`compare/${name}.html`, html);
  return { slug, dest: `compare/${name}.html`, notes, matrix: false };
}

const results = SLUGS.map(build);
results.forEach((r) => console.log(`\n${r.slug} → content/${r.dest}  [matrix: PROSE FALLBACK]\n  ${r.notes.join('\n  ')}`));
console.log(`\ndone: ${results.length} compare pages`);
