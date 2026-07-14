#!/usr/bin/env node
/**
 * stardust/gen/features.mjs — deterministic generator for the 13 baremetrics
 * FEATURE-DETAIL pages (Path A′: reuse existing blocks, no new blocks).
 *
 * Source of truth (VERBATIM, invent nothing): the captured page JSON at
 *   ../baremetrics/stardust/current/pages/<slug>.json
 * Output (David's-model body fragment): content/features/<name>.html
 *
 * Every literal (heading / lede / cta label+href / img alt+src) traces to the
 * capture. Prose is never fabricated; where the capture is thin (body:0) the
 * page is built from headings + media.imgs + the CTA canon, and the feature's
 * own json.description is the only hero lede (a sourced field).
 *
 * Blocks used (all pre-existing "The Ledger" blocks):
 *   feature-hero (recover variant) — masthead: h1 + description lede + primary CTA + chip
 *   logos (strip)                  — customer/trust logo run (deduped)
 *   steps                          — "How it works" numbered walkthrough (cancellation)
 *   band (split)                   — one eyebrow+heading+screenshot feature beat
 *   band (tint cta / ink cta)      — pricing beat / closing + imageless-beat CTA
 *   cards (triptych)               — "Keep exploring features." cross-link trio/quad
 *
 * Deterministic: same JSON in → byte-identical HTML out.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..'); // baremetrics-eds
const PAGES = join(REPO, '..', 'baremetrics', 'stardust', 'current', 'pages');
const OUT = join(REPO, 'content', 'features');

const SLUGS = [
  'features-cancellation-insights', 'features-trial-insights', 'features-email-reports',
  'features-forecasting', 'features-control-center', 'features-augmentation',
  'features-smart-dashboards', 'features-people-insights', 'features-segmentation',
  'features-slack-tools', 'features-benchmarks', 'features-metrics', 'features-api',
];

/* ------------------------------------------------------------------ helpers */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.…]+$/, '');

function buildTitle(t) {
  const s = (t || '').trim();
  if (s.length <= 60) return s;
  const parts = s.split(/\s*[|–—-]\s+/).filter(Boolean);
  let acc = '';
  for (const p of parts) {
    const cand = acc ? `${acc} | ${p}` : p;
    if (cand.length <= 60) acc = cand; else break;
  }
  return acc || `${s.slice(0, 57).trim()}…`;
}

function img(m) {
  const attrs = [
    `src="${escAttr(m.src)}"`,
    `alt="${escAttr(m.alt || '')}"`,
    m.w ? `width="${m.w}"` : '',
    m.h ? `height="${m.h}"` : '',
    'loading="lazy"',
  ].filter(Boolean).join(' ');
  return `<img ${attrs}>`;
}

/* -------------------------------------------------------------- CTA canon */
function contentCtas(json) {
  const ctas = json.ctas || [];
  // everything from the first nav sentinel ("javascript:;") onward is header/
  // footer chrome — the megamenu + footer link forest. Content CTAs precede it.
  let navAt = ctas.findIndex((c) => c.href === 'javascript:;');
  if (navAt < 0) navAt = ctas.length;
  return ctas.slice(0, navAt).filter((c) => c && c.label);
}

function primaryCta(cctas) {
  return cctas.find((c) => /sign_up/.test(c.href || ''))
    || cctas.find((c) => /app\.baremetrics\.com/.test(c.href || ''))
    || { label: 'Get Started', href: 'https://app.baremetrics.com/users/sign_up' };
}

/* --------------------------------------------------------- image triage */
function isLogoMark(m) {
  const alt = (m.alt || '').trim();
  const ratio = m.w && m.h ? m.w / m.h : 0;
  return /(^|\s)logo$/i.test(alt)
    || /customers--/.test(m.src)
    || (ratio >= 1.9 && ratio <= 2.1 && m.h && m.h <= 300);
}

const isSiteChrome = (m) => /front page logo|verified partner|check mark/i.test((m.alt || '').trim());

function isChrome(m, heroText) {
  const alt = (m.alt || '').trim();
  const src = m.src || '';
  const svg = /\.svg(\?|$)/i.test(src);
  if (isSiteChrome(m)) return true; // site chrome
  if (/banner|top-image/i.test(src)) return true; // hero art (recover variant is text-only)
  if (norm(alt) === norm(heroText)) return true; // hero banner labelled with the feature name
  if (/ellipse|graveyard|aesthetic/i.test(src) || /aesthetic shape/i.test(alt)) return true; // decorative
  if (svg && (m.w || 0) <= 160) return true; // feature/section icons + decorative glyphs
  // testimonial avatar with no captured quote text — a lone square photo
  if (!svg && m.w && m.h && Math.abs(m.w - m.h) < 12 && m.w <= 420) return true;
  if (/\/user-/.test(src)) return true;
  return false;
}

/* -------------------------------------------------------- heading walk */
const isFaq = (t) => /frequently asked questions|^faq\b/i.test(t);
const isExplore = (t) => /keep exploring|機能を探究|機能を探|他の機能/i.test(t); // EN + JA ("explore features" / "other features") — localized captures use two JA phrasings
const isHowItWorks = (t) => /how it works/i.test(t);
const isPricing = (t) => /\$\s?\d/.test(t) && /(add-?on|\/?\s?month|per month)/i.test(t);
const isShortEyebrow = (t) => t.length <= 22 && !/[.!?]$/.test(t);

/* ---------------------------------------------------------- block emit */
function heroBlock(h1, lede, cta, chip) {
  const rows = [`    <div><div><h1>${esc(h1)}</h1></div></div>`];
  if (lede) rows.push(`    <div><div><p>${esc(lede)}</p></div></div>`);
  rows.push(`    <div><div><p><strong><a href="${escAttr(cta.href)}">${esc(cta.label)}</a></strong></p></div></div>`);
  if (chip) rows.push(`    <div><div>${esc(chip)}</div></div>`);
  return ['  <div>', '    <div class="feature-hero recover">', ...rows, '    </div>', '  </div>'].join('\n');
}

function logosBlock(marks) {
  const cells = marks.map((m) => img(m)).join('');
  return [
    '  <div>',
    '    <div class="logos strip">',
    `      <div><div>${cells}</div></div>`,
    '    </div>',
    '  </div>',
  ].join('\n');
}

function stepsBlock(headText, steps) {
  const rows = steps.map((s) => {
    const cells = [`<div><h3>${esc(s.heading)}</h3></div>`];
    if (s.img) cells.push(`<div>${img(s.img)}</div>`);
    return `      <div>${cells.join('')}</div>`;
  });
  return [
    '  <div>',
    `    <h2>${esc(headText)}</h2>`,
    '    <div class="steps">',
    ...rows,
    '    </div>',
    '  </div>',
  ].join('\n');
}

function beatBand(beat, ground) {
  const cls = `band split${ground ? ` ${ground}` : ''}`;
  const rows = [];
  if (beat.eyebrow) rows.push(`      <div><div><p>${esc(beat.eyebrow)}</p></div></div>`);
  rows.push(`      <div><div><h2>${esc(beat.heading)}</h2></div></div>`);
  if (beat.img) rows.push(`      <div><div>${img(beat.img)}</div></div>`);
  return ['  <div>', `    <div class="${cls}">`, ...rows, '    </div>', '  </div>'].join('\n');
}

function ctaBand(heading, eyebrow, cta, variant) {
  // variant: 'ink cta' (closing / imageless beat) | 'tint cta' (pricing)
  const rows = [];
  if (eyebrow) rows.push(`      <div><div><p>${esc(eyebrow)}</p></div></div>`);
  rows.push(`      <div><div><h2>${esc(heading)}</h2></div></div>`);
  rows.push(`      <div><div><p><strong><a href="${escAttr(cta.href)}">${esc(cta.label)}</a></strong></p></div></div>`);
  return ['  <div>', `    <div class="band ${variant}">`, ...rows, '    </div>', '  </div>'].join('\n');
}

function exploreCards(headText, lede, cards) {
  const rows = cards.map((c) => {
    const cells = [`<div><h3>${esc(c.heading)}</h3></div>`];
    if (c.teaser) cells.push(`<div><p>${esc(c.teaser)}</p></div>`);
    if (c.href) cells.push(`<div><a href="${escAttr(c.href)}">${esc(c.linkLabel || 'Learn More')}</a></div>`);
    return `      <div>${cells.join('')}</div>`;
  });
  const head = [`    <h2>${esc(headText)}</h2>`];
  if (lede) head.push(`    <p>${esc(lede)}</p>`);
  return ['  <div>', ...head, '    <div class="cards triptych">', ...rows, '    </div>', '  </div>'].join('\n');
}

/* ---------------------------------------------------------- page build */
function buildPage(slug, json) {
  const description = (json.description || '').replace(/\s+/g, ' ').trim();
  const headings = (json.headings || []).map((h) => ({
    level: parseInt(h.tag.replace(/\D/g, ''), 10) || 2,
    text: (h.text || '').trim(),
  })).filter((h) => h.text);
  const body = (json.body || []).map((b) => String(b).trim()).filter(Boolean);
  const cctas = contentCtas(json);
  const primary = primaryCta(cctas);
  const learnMore = cctas.filter((c) => /learn more/i.test(c.label));

  /* --- hero heading --- */
  let idx = 0;
  let heroEyebrow = null;
  let heroHeading = null;
  const first = headings[0];
  if (first && first.level === 1) {
    heroHeading = first.text; idx = 1;
  } else if (first && isShortEyebrow(first.text) && headings[1]
    && !isFaq(headings[1].text) && !isExplore(headings[1].text)) {
    heroEyebrow = first.text; heroHeading = headings[1].text; idx = 2;
  } else if (first) {
    heroHeading = first.text; idx = 1;
  } else {
    heroHeading = buildTitle(json.title);
  }

  /* --- image queues --- */
  const imgs = (json.media && json.media.imgs ? json.media.imgs : []);
  const logoSeen = new Set();
  const logoMarks = [];
  const contentImgs = [];
  imgs.forEach((m) => {
    if (isSiteChrome(m)) return; // the header wordmark + verified badge are never content
    if (isLogoMark(m)) { // customer/trust marks — before the small-svg icon rule
      if (!logoSeen.has(m.src)) { logoSeen.add(m.src); logoMarks.push(m); }
      return;
    }
    if (isChrome(m, heroHeading)) return;
    contentImgs.push(m);
  });

  /* --- walk the remaining headings into ordered sections --- */
  const sections = [];
  const beats = [];
  let steps = null;
  let explore = null;
  let pricing = null;
  const closings = [];

  while (idx < headings.length) {
    const t = headings[idx];
    if (isFaq(t.text)) { idx += 1; continue; } // no answers captured — cannot fabricate
    if (isExplore(t.text)) {
      const cards = [];
      idx += 1;
      let ci = 0;
      while (idx < headings.length && headings[idx].level > t.level) {
        cards.push({ heading: headings[idx].text, teaserIdx: ci });
        idx += 1; ci += 1;
      }
      explore = { headText: t.text, cards };
      continue;
    }
    if (isHowItWorks(t.text)) {
      const items = [];
      idx += 1;
      while (idx < headings.length && headings[idx].level > t.level) {
        items.push({ heading: headings[idx].text });
        idx += 1;
      }
      steps = { headText: t.text, items };
      continue;
    }
    if (isPricing(t.text)) { pricing = { heading: t.text }; idx += 1; continue; }
    // ordinary beat: optional eyebrow + heading. An eyebrow is either a deeper
    // heading (h5/h6 kicker before an h2/h3/h4 heading — the standard feature
    // beat) or a short same-level kicker before a longer headline (the
    // editorial "Key Benefit" / "Countless Options" pattern).
    let eyebrow = null;
    let heading = t.text;
    const next = headings[idx + 1];
    const nextOk = next && !isFaq(next.text) && !isExplore(next.text)
      && !isHowItWorks(next.text) && !isPricing(next.text);
    const isKicker = nextOk && (
      (t.level >= 5 && next.level <= 4)
      || (t.level === next.level && isShortEyebrow(t.text) && next.text.length > t.text.length)
    );
    if (isKicker) {
      eyebrow = t.text; heading = next.text; idx += 2;
    } else {
      idx += 1;
    }
    beats.push({ eyebrow, heading });
  }

  /* --- assign images: steps first (they lead in DOM order), then beats --- */
  if (steps) steps.items.forEach((s) => { s.img = contentImgs.shift() || null; });
  beats.forEach((b) => { b.img = contentImgs.shift() || null; });

  /* --- assemble sections in reading order --- */
  const heroChip = heroEyebrow || heroHeading;
  sections.push(heroBlock(heroHeading, description, primary, heroChip));
  if (logoMarks.length) sections.push(logosBlock(logoMarks));
  if (steps && steps.items.length) sections.push(stepsBlock('How it works', steps.items));

  let beatN = 0;
  beats.forEach((b) => {
    if (b.img) {
      const ground = beatN % 2 === 1 ? 'mist' : '';
      sections.push(beatBand(b, ground));
      beatN += 1;
    } else {
      // an imageless beat — a closing / statement headline. Render as a CTA band.
      closings.push(b);
    }
  });

  if (pricing) sections.push(ctaBand(pricing.heading, null, primary, 'tint cta'));

  if (explore) {
    const lede = body[0] || null;
    const cards = explore.cards.map((c, i) => ({
      heading: c.heading,
      teaser: body[i + 1] || null,
      href: (learnMore[i] && learnMore[i].href) || null,
      linkLabel: (learnMore[i] && learnMore[i].label) || 'Learn More',
    }));
    sections.push(exploreCards(explore.headText, lede, cards));
  }

  closings.forEach((c) => sections.push(ctaBand(c.heading, c.eyebrow, primary, 'ink cta')));

  /* --- metadata --- */
  const meta = [
    '  <div>',
    '    <div class="metadata">',
    `      <div><div>Title</div><div>${esc(buildTitle(json.title))}</div></div>`,
    `      <div><div>Description</div><div>${esc(description)}</div></div>`,
    '    </div>',
    '  </div>',
  ].join('\n');

  const usedBlocks = new Set(['feature-hero']);
  if (logoMarks.length) usedBlocks.add('logos');
  if (steps && steps.items.length) usedBlocks.add('steps');
  if (beatN) usedBlocks.add('band(split)');
  if (pricing || closings.length) usedBlocks.add('band(cta)');
  if (explore) usedBlocks.add('cards');

  const html = [
    '<body>',
    '<header></header>',
    '<main>',
    meta,
    ...sections,
    '</main>',
    '<footer></footer>',
    '</body>',
    '',
  ].join('\n');

  return {
    html,
    stats: {
      slug,
      title: buildTitle(json.title),
      h1: heroHeading,
      bodyCount: body.length,
      beats: beatN,
      steps: steps ? steps.items.length : 0,
      logos: logoMarks.length,
      exploreCards: explore ? explore.cards.length : 0,
      closings: closings.length,
      pricing: !!pricing,
      leftoverImgs: contentImgs.length,
      blocks: [...usedBlocks],
    },
  };
}

/* --------------------------------------------------------------- main */
function nameFor(slug) {
  // features-cancellation-insights -> cancellation-insights.html (under content/features/)
  return `${slug.replace(/^features-/, '')}.html`;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const report = [];
  for (const slug of SLUGS) {
    const json = JSON.parse(readFileSync(join(PAGES, `${slug}.json`), 'utf8'));
    const { html, stats } = buildPage(slug, json);
    const out = join(OUT, nameFor(slug));
    writeFileSync(out, html);
    report.push(stats);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

export { buildPage as buildFeature };

/* ── CLI entry (English bulk generation — unchanged output) ─────────────── */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
