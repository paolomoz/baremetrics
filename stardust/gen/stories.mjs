#!/usr/bin/env node
/**
 * stardust/gen/stories.mjs — 6 customer STORIES (prose articles), David's model.
 * Mirrors the blog-article archetype: metadata (Template: article) +
 * article-head `article` (back-link + subscribe topbar, h1, byline, hero exhibit)
 * + the captured body prose as article-body default content (quotes → blockquote).
 *
 * Everything is lifted VERBATIM from the JSON capture
 * (../baremetrics/stardust/current/pages/customers-*.json):
 *   - h1            = headings[0] (the captured story h1)
 *   - byline        = body[1] ("By … on … Last updated on …")
 *   - hero exhibit  = og.image (dimensions/alt matched from media.imgs)
 *   - body prose    = body[2:], global-deduped (the capture front-loads a jump-nav
 *                     echo of the section headings, so duplicate heading/caption
 *                     literals are collapsed to first occurrence), each item
 *                     emitted as its captured heading tag (exact match) / a
 *                     <blockquote> (leading quote mark; trailing "—" attribution
 *                     folded in) / a <p>.
 *
 * DEVIATION (recorded): the capture lists section headings as a leading outline
 * block BEFORE the prose (headings are NOT interleaved with their paragraphs in
 * the source `body`), so the page reproduces that captured order — an
 * "in this article" heading outline, then Challenge/Solution/Result, then the
 * prose. Heading levels are preserved; no separate toc/cta band is manufactured
 * (would duplicate captured literals). Author-name h3 is capture-only (absent
 * from `body`) so the bio renders as the closing paragraph.
 *
 * Run: node stardust/gen/stories.mjs
 */
/* eslint-disable no-console */
import { pathToFileURL } from 'url';
import {
  readPage, esc, norm, clampTitle, row, block, sectionMeta, section, metadata, page, writeOut, imgTag,
} from './_shared.mjs';

const SLUGS = [
  'customers-how-grokability-recovered-150k-in-failed-charges-with-baremetrics',
  'customers-how-huntr-doubled-revenue-4-years-straight-while-pivoting-twice',
  'customers-how-smart-passive-income-grew-its-private-membership-community-and-recovered-8k-in-failed-payments-with-baremetrics',
  'customers-uxpin-uses-baremetrics-to-track-saas-metrics-and-financial-growth',
  'customers-cancel-timeshare-recovered-680-in-1-month-with-baremetrics',
  'customers-upvoty-customer-story',
];

const ctaHref = (d, label, fallback) => {
  const c = d.ctas.find((x) => norm(x.label) === label);
  return c ? c.href : fallback;
};

const startsQuote = (t) => /^["“”«»]/.test(t);
const startsAttr = (t) => /^[—–-]\s/.test(t) || /^[—–]/.test(t);

/* body prose → array of html strings */
function renderBody(d) {
  const headMap = new Map();
  d.headings.forEach((h, i) => {
    if (i === 0) return; // the h1 lives in article-head
    const t = norm(h.text);
    if (/^(table of contents|more .*articles|more articles)$/i.test(t)) return; // toc chrome
    if (!headMap.has(t)) headMap.set(t, h.tag);
  });

  const seen = new Set();
  const items = [];
  d.body.slice(2).forEach((raw) => {
    const t = norm(raw);
    if (!t) return;
    if (seen.has(t)) return; // global dedup (collapses the jump-nav echoes + repeated captions)
    seen.add(t);
    items.push(t);
  });

  const out = [];
  let lastWasQuote = false;
  items.forEach((t) => {
    if (headMap.has(t)) {
      const tag = headMap.get(t);
      out.push(`    <${tag}>${esc(t)}</${tag}>`);
      lastWasQuote = false;
      return;
    }
    if (startsAttr(t) && lastWasQuote) {
      // fold attribution into the preceding blockquote
      const bq = out[out.length - 1];
      out[out.length - 1] = bq.replace('</blockquote>', `<p><em>${esc(t)}</em></p></blockquote>`);
      return;
    }
    if (startsQuote(t)) {
      out.push(`    <blockquote><p>${esc(t)}</p></blockquote>`);
      lastWasQuote = true;
      return;
    }
    out.push(`    <p>${esc(t)}</p>`);
    lastWasQuote = false;
  });
  return out;
}

/* per-capture build (exported for reuse by the localized router) */
export function buildStory(d, { backHref: backHrefOpt } = {}) {
  const h1 = norm(d.headings[0].text);
  const byline = norm(d.body[1] || '');
  const backHref = backHrefOpt || ctaHref(d, 'Customers', 'https://baremetrics.com/customers');
  const subHref = ctaHref(d, 'Subscribe for Updates', '/subscribe');

  // hero image = og.image; match dimensions/alt from media.imgs
  const heroSrc = d.og && d.og.image;
  const heroMedia = (d.media.imgs || []).find((m) => m.src === heroSrc)
    || (heroSrc ? { src: heroSrc, alt: '', w: null, h: null } : null);
  const heroImg = heroMedia
    ? `<img src="${esc(heroMedia.src)}" alt="${esc(heroMedia.alt || '')}"${heroMedia.w ? ` width="${heroMedia.w}"` : ''}${heroMedia.h ? ` height="${heroMedia.h}"` : ''} fetchpriority="high" decoding="async">`
    : null;

  const headRows = [
    row([
      `<a href="${esc(backHref)}">← Customers</a>`,
      `<a href="${esc(subHref)}">Subscribe for Updates</a>`,
    ]),
    row([`<h1>${esc(h1)}</h1>`]),
  ];
  if (byline) headRows.push(row([`<p>${esc(byline)}</p>`]));
  if (heroImg) headRows.push(row([heroImg]));

  const prose = renderBody(d);

  const body = page([
    metadata({ Title: clampTitle((d.og && d.og.title) || d.title), Description: d.description, Template: 'article' }),
    section([block('article-head article', headRows)]),
    section([sectionMeta('article-body'), ...prose]),
  ]);
  return { html: body, prose };
}

/* ── CLI entry (English bulk generation — unchanged output) ────────────── */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  SLUGS.forEach((slug) => {
    const d = readPage(slug);
    const { html, prose } = buildStory(d);
    const name = slug.replace(/^customers-/, '');
    const p = writeOut(`content/customers/${name}.html`, html);
    const nH = prose.filter((h) => /^\s*<h[1-6]/.test(h)).length;
    const nQ = prose.filter((h) => /^\s*<blockquote/.test(h)).length;
    const nP = prose.filter((h) => /^\s*<p/.test(h)).length;
    console.log(`stories/${name}: ${prose.length} body nodes (${nP} p, ${nH} headings, ${nQ} quotes) → ${p}`);
  });
  console.log('stories: done');
}
