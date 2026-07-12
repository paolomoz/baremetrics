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
  esc, norm, clampTitle, row, block, section, metadata, page,
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
  fs.writeFileSync(dest, html);
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
    // blog index (none captured) → generic
    return {
      out: `${outBase}.html`, html: buildStaticGeneric(d), template: 'index:blog', degraded: 'no-blog-index-generator',
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
    return { out: `${loc}/customers.html`, html: buildCustomersIndex(d, loc), template: 'index:customers' };
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
    if (LEGAL.has(seg0) && bodyEmpty) {
      const html = mirrorEnglishLegal(seg0, d);
      if (html) {
        return {
          out: `${outBase}.html`, html, template: 'static:legal', degraded: 'legal-empty-body→mirrored-english-policy',
        };
      }
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
