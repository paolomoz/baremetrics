#!/usr/bin/env node
/**
 * stardust/gen/features-metrics.mjs — standalone generator that rebuilds the
 * rich content/features/metrics.html from the re-extracted sidecar
 *   ../baremetrics/stardust/current/pages/_features-metrics.json
 * (the crawl capture collapsed the body to 0 and dropped the design). SEO
 * Title/Description are read from the original capture features-metrics.json.
 *
 * Path A′: reuse existing "The Ledger" blocks, invent nothing. Every literal
 * (heading / lede / cta / faq / img) traces to the extraction.
 *
 * Blocks used (all pre-existing):
 *   feature-hero recover — hero masthead (h1 + lede + 2 CTAs + free-trial note)
 *   logos strip          — "Trusted by growing SaaS Companies" mark run
 *   quote sheet          — Matt Smith / Later testimonial + avatar
 *   feature-hero case    — text feature promos (chip? + h2 + lede + Get started)
 *   band split           — a text feature beat (no media)
 *   cards triptych       — the Slack + Email sub-feature pair (Learn More)
 *   accordion            — Frequently Asked Questions
 *   band accent cta      — closing violet/periwinkle CTA (h2 + lede + 2 CTAs)
 *
 * MEDIA RULES: EDS rejects SVGs > 40KB and expiring URLs. Every illustration
 * SVG on this page (integrations / reports / benchmark / trial-insights /
 * visual / metrics-top-image) is 52-342KB, so none can ship as SVG. Instead
 * (hybrid restore):
 *   - the 4 dashboard/illustration SVGs (metrics-top-image, integrations,
 *     reports, visual) are RASTERIZED to lean PNGs at /features/metrics-media/
 *     (by stardust/scripts/rasterize-features-metrics.mjs) and window-chromed;
 *   - the 2 stat-card SVGs (benchmark, trial-insights) are NOT rasterized —
 *     their figures (read off the rendered cards; the glyphs are outlined to
 *     <path>, no <text> to parse) are authored as native Ledger tabular
 *     figures via the band `stats` shape (see s.stats in the sidecar).
 * Logos + the PNG avatar are small hubfs marks and kept as-is.
 * Internal baremetrics.com links are relativized by lib's write().
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  esc, escAttr, block, blockWithHead, row, write, page, PAGES,
} from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SIDECAR = path.join(PAGES, '_features-metrics.json');
const CAPTURE = path.join(PAGES, 'features-metrics.json');

const SVG_MAX = 40 * 1024; // EDS media-validation ceiling for SVG

/* keep a captured image, or null if the EDS media rules reject it */
function keepImg(m) {
  if (!m || !m.src) return null;
  if (/googleusercontent|web\.archive|lh\d+\.google/i.test(m.src)) return null; // expiring / non-fetchable
  if (/\.svg(\?|$)/i.test(m.src) && (m.bytes || 0) > SVG_MAX) return null; // oversized illustration SVG
  return m;
}

/* The 4 dashboard/illustration SVGs exceed the 40KB SVG ceiling, so they are
   rasterized to PNG (no size limit) by stardust/scripts/rasterize-features-metrics.mjs
   in the baremetrics project and committed to this repo at
   /features/metrics-media/<name>.png (code-sync serves that path). Map the
   source SVG basename → its local PNG + intrinsic display size (½ the 2×
   render). The two STAT SVGs (benchmark, trial-insights) are NOT here — their
   figures are authored as native tabular-figure stat cards instead. */
/* The 4 illustration SVGs are oversized (>40KB, EDS rejects) so they're
   rasterized to lean JPEGs (stardust/scripts/png2jpg.mjs) and INLINED as data:
   URIs. Data URIs are the only in-content image form the EDS pipeline leaves
   untouched — a local/same-origin src (repo /img or content-bus media_HASH)
   gets run through createOptimizedPicture, which can't resolve a
   non-authoring-flow media and emits about:error. Total inlined ≈130KB. */
import { readFileSync as _rf } from 'node:fs';
import { fileURLToPath as _f2p } from 'node:url';
import { dirname as _dn, join as _pj } from 'node:path';
const _IMG = _pj(_dn(_f2p(import.meta.url)), '../../img/features-metrics');
const dataUri = (file) => `data:image/jpeg;base64,${_rf(_pj(_IMG, file)).toString('base64')}`;
const RASTER = {
  'metrics-top-image.svg': { file: 'metrics-hero.jpg', w: 760, h: 570 },
  'integrations.svg': { file: 'metrics-integrations.jpg', w: 760, h: 656 },
  'reports.svg': { file: 'metrics-reports.jpg', w: 760, h: 969 },
  'visual.svg': { file: 'metrics-support.jpg', w: 760, h: 656 },
};

/* map a captured SVG media object to its inlined-JPEG descriptor, or null */
function rasterFor(m) {
  if (!m || !m.src) return null;
  const base = decodeURIComponent(m.src.split('/').pop());
  const r = RASTER[base];
  if (!r) return null;
  return { src: dataUri(r.file), alt: m.alt || '', w: r.w, h: r.h };
}

function imgTag(m) {
  const attrs = [
    `src="${escAttr(m.src)}"`,
    `alt="${escAttr(m.alt || '')}"`,
    m.w ? `width="${m.w}"` : '',
    m.h ? `height="${m.h}"` : '',
    'loading="lazy"',
  ].filter(Boolean).join(' ');
  return `<img ${attrs}>`;
}

/* one row/cell of CTAs: primary = strong (button), secondary = em (quiet) */
function ctaCell(ctas) {
  const parts = ctas.map((c, i) => {
    const tag = i === 0 ? 'strong' : 'em';
    return `<${tag}><a href="${escAttr(c.href)}">${esc(c.label)}</a></${tag}>`;
  });
  return `<p>${parts.join(' ')}</p>`;
}

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

function build(data, capture) {
  const sections = [];

  /* ── metadata (SEO from the original capture) ── */
  sections.push([
    '  <div>',
    '    <div class="metadata">',
    `      <div><div>Title</div><div>${esc(buildTitle(capture.title))}</div></div>`,
    `      <div><div>Description</div><div>${esc((capture.description || '').replace(/\s+/g, ' ').trim())}</div></div>`,
    '    </div>',
    '  </div>',
  ].join('\n'));

  /* ── HERO (feature-hero recover): h1 + lede + 2 CTAs + free-trial note ── */
  const hero = data.hero;
  const heroRows = [
    row([`<h1>${esc(hero.h1)}</h1>`]),
    row([`<p>${esc(hero.lede)}</p>`]),
    row([ctaCell(hero.ctas)]),
  ];
  if (hero.note) heroRows.push(row([esc(hero.note)])); // short → renders as the hero note
  const heroShot = rasterFor(hero.shot); // rasterized dashboard exhibit → window-chromed
  if (heroShot) heroRows.push(row([imgTag(heroShot)]));
  sections.push(block('feature-hero recover', heroRows));

  /* ── LOGO STRIP: "Trusted by growing SaaS Companies" ── */
  const logoMarks = data.logos.map(keepImg).filter(Boolean);
  if (logoMarks.length) {
    const headRows = [];
    if (data.logoLabel) headRows.push(row([`<p>${esc(data.logoLabel)}</p>`]));
    headRows.push(row([logoMarks.map(imgTag).join('')]));
    sections.push(block('logos strip', headRows));
  }

  /* ── TESTIMONIAL (quote sheet): quote + avatar/name/role ── */
  const q = data.quote;
  if (q && q.text) {
    const qRows = [row([`<p>${esc(q.text)}</p>`])];
    const avatar = keepImg(q.avatar);
    if (avatar || q.name) {
      const cells = [];
      if (avatar) cells.push(imgTag(avatar));
      if (q.name) cells.push(esc(q.name));
      if (q.role) cells.push(esc(q.role));
      qRows.push(row(cells));
    }
    sections.push(block('quote sheet', qRows));
  }

  /* ── FEATURE SECTIONS (alternating grounds mirror the source) ── */
  data.sections.forEach((s, i) => {
    const shaded = i % 2 === 1;
    const ground = shaded ? ' mist' : '';
    const shot = rasterFor(s.media && s.media[0]); // rasterized PNG for this beat, if any

    /* stat-card beats (benchmark, trial-insights): the source SVGs are stat
       cards whose figures are outlined to <path> (no <text> to keep, and they
       exceed the SVG ceiling anyway), so author the numbers natively as Ledger
       tabular figures via the band `stats` shape. Figures live on s.stats. */
    if (s.stats && s.stats.length) {
      const stRows = [row([`<h2>${esc(s.h2)}</h2>`])];
      s.body.forEach((b) => stRows.push(row([`<p>${esc(b)}</p>`])));
      s.stats.forEach((st) => stRows.push(row([esc(st.label), esc(st.value)])));
      if (s.links.length) stRows.push(row([ctaCell(s.links)]));
      sections.push(block(`band${ground} stats`, stRows));
      return;
    }

    /* the Slack + Email pair → a dashboard band split (h2 + window-chromed
       reports exhibit) followed by the cards triptych for the sub-features */
    if (s.cards && s.cards.length) {
      if (shot) {
        const splitRows = [row([`<h2>${esc(s.h2)}</h2>`])];
        s.body.forEach((b) => splitRows.push(row([`<p>${esc(b)}</p>`])));
        splitRows.push(row([imgTag(shot)]));
        sections.push(block(`band split${ground}`, splitRows));
      }
      const cardRows = s.cards.map((c) => {
        const cells = [`<h3>${esc(c.title)}</h3>${c.body ? `<p>${esc(c.body)}</p>` : ''}`];
        if (c.link && c.link.href) cells.push(`<a href="${escAttr(c.link.href)}">${esc(c.link.label)}</a>`);
        return row(cells);
      });
      if (shot) sections.push(block('cards triptych', cardRows));
      else sections.push(blockWithHead(`    <h2>${esc(s.h2)}</h2>`, 'cards triptych', cardRows));
      return;
    }

    /* a plain heading+lede beat with no chip/CTA → band split (+ window-
       chromed exhibit when the source illustration was rasterized) */
    if (!s.eyebrow && !s.links.length) {
      const bRows = [row([`<h2>${esc(s.h2)}</h2>`])];
      s.body.forEach((b) => bRows.push(row([`<p>${esc(b)}</p>`])));
      if (shot) bRows.push(row([imgTag(shot)]));
      sections.push(block(`band split${ground}`, bRows));
      return;
    }

    /* otherwise a feature-hero case promo: chip? + h2 + lede + Get started +
       window-chromed exhibit (feature-hero case wraps large imgs in .win) */
    const cRows = [];
    if (s.eyebrow) cRows.push(row([`<p>${esc(s.eyebrow)}</p>`]));
    const headCell = `<h2>${esc(s.h2)}</h2>${s.body.map((b) => `<p>${esc(b)}</p>`).join('')}`;
    cRows.push(row([headCell]));
    if (s.links.length) cRows.push(row([ctaCell(s.links)]));
    if (shot) cRows.push(row([imgTag(shot)]));
    const variant = `feature-hero case${shaded ? ' mirror mist' : ''}`;
    sections.push(block(variant, cRows));
  });

  /* ── FAQ (accordion) ── */
  if (data.faq && data.faq.length) {
    const faqRows = data.faq.map((f) => {
      const ansHtml = (f.answerParts || []).map((p) => {
        if (p.type === 'p') return `<p>${p.html}</p>`;
        if (p.type === 'list') {
          const tag = p.ordered ? 'ol' : 'ul';
          return `<${tag}>${p.items.map((li) => `<li>${li}</li>`).join('')}</${tag}>`;
        }
        return '';
      }).join('');
      return `      <div><div>${esc(f.q)}</div><div>${ansHtml}</div></div>`;
    });
    if (data.faqMore) {
      const label = esc(data.faqMore).replace(/(Contact us\.?)$/i, (m) => `<a href="${escAttr(data.faqMoreHref)}">${m}</a>`);
      faqRows.push(`      <div><div><p>${label}</p></div></div>`);
    }
    sections.push(blockWithHead('    <h2>Frequently Asked Questions</h2>', 'accordion', faqRows));
  }

  /* ── CLOSING CTA (band accent cta): violet/periwinkle ground ── */
  const cta = data.cta;
  if (cta && cta.h2) {
    const ctaRows = [row([`<h2>${esc(cta.h2)}</h2>`])];
    if (cta.lede) ctaRows.push(row([`<p>${esc(cta.lede)}</p>`]));
    ctaRows.push(row([ctaCell(cta.ctas)]));
    sections.push(block('band accent cta', ctaRows));
  }

  return page(sections);
}

function main() {
  const data = JSON.parse(fs.readFileSync(SIDECAR, 'utf8'));
  const capture = JSON.parse(fs.readFileSync(CAPTURE, 'utf8'));
  const html = build(data, capture);
  write('features/metrics.html', html);
  // report
  const rasterized = [];
  const statCards = [];
  const dropped = [];
  if (rasterFor(data.hero.shot)) rasterized.push('hero');
  data.sections.forEach((s) => {
    const statSection = s.stats && s.stats.length;
    if (statSection) statCards.push(`${s.h2.slice(0, 24)}→${s.stats.length} figures`);
    s.media.forEach((m) => {
      if (rasterFor(m)) rasterized.push(m.src.split('/').pop());
      else if (statSection) return; // SVG replaced by native stat card, not dropped
      else if (!keepImg(m)) dropped.push(m.src.split('/').pop());
    });
  });
  console.log(`  sections=${data.sections.length} faq=${data.faq.length} logos=${data.logos.length}`);
  console.log(`  rasterized=[${rasterized.join(', ')}] stat-cards=[${statCards.join(', ')}] dropped-media=[${dropped.join(', ')}]`);
}

export { build as buildFeaturesMetrics };

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
