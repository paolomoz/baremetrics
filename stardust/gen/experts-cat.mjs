#!/usr/bin/env node
/**
 * stardust/gen/experts-cat.mjs — 4 experts CATEGORY pages, David's model.
 * Mirrors content/experts.html (same ledger, filtered to the category):
 *   masthead (h1 + lede + category rail, current category aria-current via
 *   authored <strong><a>) + <h2>Expert directory</h2> reabsorbed head +
 *   ledger `experts` rows (logo | name/cats/desc | "Click to learn more").
 *
 * Extracted programmatically & VERBATIM from the category JSON captures
 * (../baremetrics/stardust/current/pages/experts-*.json):
 *   - name   = headings h4[i]
 *   - desc   = body[6 + i]            (body: [0]=lede, [1..5]=rail labels, [6..]=descs)
 *   - link   = the i-th cta whose label ends "Click to learn more"
 *   - cats   = that cta label with the name prefix + desc suffix + go-phrase removed
 *   - logo   = media.imgs whose alt normalises to the name (else text fallback,
 *              per the archetype's no-logo experts)
 *
 * DEVIATION (recorded): capture cannot signal the archetype's <em>-wrapped
 * ink-chip logos, so every logo renders as a plain <img>; the rail count
 * ("N experts") is the count of captured category rows.
 *
 * Run: node stardust/gen/experts-cat.mjs
 */
/* eslint-disable no-console */
import { pathToFileURL } from 'url';
import {
  readPage, esc, norm, clampTitle, row, block, section, metadata, page, writeOut,
} from './_shared.mjs';

const CATS = [
  { slug: 'experts-legal-financial', label: 'Legal & Financial' },
  { slug: 'experts-development', label: 'Development' },
  { slug: 'experts-design', label: 'Design' },
  { slug: 'experts-marketing-sales', label: 'Marketing & Sales' },
];

const RAIL = [
  { label: 'All', href: 'https://baremetrics.com/experts' },
  { label: 'Design', href: 'https://baremetrics.com/experts/design' },
  { label: 'Development', href: 'https://baremetrics.com/experts/development' },
  { label: 'Legal & Financial', href: 'https://baremetrics.com/experts/legal-financial' },
  { label: 'Marketing & Sales', href: 'https://baremetrics.com/experts/marketing-sales' },
];

const normKey = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function experts(d) {
  const names = d.headings.filter((h) => h.tag === 'h4').map((h) => norm(h.text));
  const ectas = d.ctas.filter((c) => norm(c.label).endsWith('Click to learn more'));
  const descs = d.body.slice(6).map(norm);
  const imgs = new Map();
  (d.media.imgs || []).forEach((m, i) => {
    if (i === 0) return; // header baremetrics logo
    const k = normKey(m.alt);
    if (k && !imgs.has(k)) imgs.set(k, m);
  });

  return names.map((name, i) => {
    const cta = ectas[i];
    const desc = descs[i] || '';
    let core = norm(cta.label).replace(/\s*Click to learn more$/, '').trim();
    while (core.toLowerCase().startsWith(`${name.toLowerCase()} `)) core = core.slice(name.length).trim();
    let cats = core;
    if (desc && core.endsWith(desc)) cats = core.slice(0, core.length - desc.length).trim();
    const m = imgs.get(normKey(name));
    return { name, cats, desc, href: cta.href || '', img: m };
  });
}

function expertRow(e) {
  const logoCell = e.img
    ? `<img src="${esc(e.img.src)}" alt="${esc(e.img.alt || '')}"${e.img.w ? ` width="${e.img.w}"` : ''}${e.img.h ? ` height="${e.img.h}"` : ''} loading="lazy">`
    : esc(e.name);
  const main = `<h3>${esc(e.name)}</h3><p>${esc(e.cats)}</p><p>${esc(e.desc)}</p>`;
  /* drop the "learn more" link when the source has no real href (the JA experts
     directory doesn't link out) — a dead href="#" is worse than no link */
  const linkCell = e.href && e.href !== '#' ? `<a href="${esc(e.href)}">Click to learn more</a>` : '';
  return row([logoCell, main, linkCell]);
}

function railCell(currentLabel, count, locale) {
  const links = RAIL.map((r) => {
    const href = locale ? r.href.replace('https://baremetrics.com/experts', `https://baremetrics.com/${locale}/experts`) : r.href;
    const a = `<a href="${esc(href)}">${esc(r.label)}</a>`;
    return r.label === currentLabel ? `<strong>${a}</strong>` : a;
  }).join(' ');
  return `<p>${links}</p><p>${count} experts</p><p>Category links open the corresponding captured category pages; live in-page filtering ships at migration.</p>`;
}

/* per-capture build (exported for reuse by the localized router).
   `label` = the current rail entry to highlight (English rail label, or 'All'
   for the directory index); `locale` (ja|jp) localises the rail hrefs. */
export function buildExpertsCat(d, { label, locale } = {}) {
  const h1 = norm(d.headings[0].text);
  const lede = norm(d.body[0] || '');
  const list = experts(d);

  const mastRows = [
    row([`<h1>${esc(h1)}</h1>`]),
    row([`<p>${esc(lede)}</p>`]),
    row([railCell(label, list.length, locale)]),
  ];

  const body = page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead', mastRows)]),
    section([
      '    <h2>Expert directory</h2>',
      block('ledger experts', list.map(expertRow)),
    ]),
  ]);
  return { html: body, count: list.length };
}

/* ── CLI entry (English bulk generation — unchanged output) ────────────── */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const results = CATS.map(({ slug, label }) => {
    const d = readPage(slug);
    const { html, count } = buildExpertsCat(d, { label });
    const name = slug.replace(/^experts-/, '');
    const p = writeOut(`content/experts/${name}.html`, html);
    console.log(`experts/${name}: ${count} experts → ${p}`);
    return { name, count };
  });
  console.log(`experts-cat: done (${results.map((r) => `${r.name}=${r.count}`).join(', ')})`);
}
