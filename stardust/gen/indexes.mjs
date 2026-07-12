#!/usr/bin/env node
/**
 * stardust/gen/indexes.mjs — the ACADEMY and FOUNDER-CHATS listing indexes,
 * David's model. Mirrors content/blog.html: masthead `form` (h1 + lede +
 * subscribe row) + ledger `entries` (numbered rows + inert pagination foot).
 *
 * Extracted programmatically & VERBATIM from the JSON captures
 * (../baremetrics/stardust/current/pages/{academy,founder-chats}.json):
 *   academy       — title = headings h3[i]; href = the cta whose label == title.
 *                   Capture has NO per-item teaser/date, so rows are title+link.
 *                   The 6 captured tag links (body[2..7]) fold into a masthead rail.
 *   founder-chats — title = headings h4[i]; teaser = body[1 + i]; href = the
 *                   founder-chats cta whose label starts with the title.
 *
 * DEVIATION (recorded): row numbering ("01"…) and the "All entries | N entries"
 * head + inert pagination foot are archetype chrome (as in blog.html); academy
 * rows carry no teaser (not captured); founder-chats masthead has no subscribe
 * lede line (not captured) so only the inert subscribe form chrome renders.
 *
 * Run: node stardust/gen/indexes.mjs
 */
/* eslint-disable no-console */
import { pathToFileURL } from 'url';
import {
  readPage, esc, norm, clampTitle, row, block, section, metadata, page, writeOut,
} from './_shared.mjs';

const pad = (n) => String(n).padStart(2, '0');

const entryRow = (i, titleTag, title, teaser, href) => {
  const cells = [pad(i + 1)];
  cells.push(`<${titleTag}>${esc(title)}</${titleTag}>${teaser ? `<p>${esc(teaser)}</p>` : ''}`);
  cells.push(`<a href="${esc(href)}">Continue Reading</a>`);
  return row(cells);
};

const headRow = (n) => row(['All entries', `${n} entries`]);
const pageFoot = () => row(['Previous', 'Page 1', 'Next', 'Pagination active at launch.']);

const formRow = () => row(['Email address', 'Enter your email to subscribe', 'Subscribe']);

/* ── academy ─────────────────────────────────────────────────────────── */
export function buildAcademyIndex(d) {
  const h1 = norm(d.headings[0].text);
  const lede = norm(d.body[0] || '');
  const subLine = norm(d.body[1] || '');
  const labels = new Map(d.ctas.map((c) => [norm(c.label), c.href]));
  const titles = d.headings.filter((h) => h.tag === 'h3').map((h) => norm(h.text));
  const entries = titles.map((t) => ({ title: t, href: labels.get(t) || '#' }));

  // captured tag links → masthead rail
  const tagLabels = ['Marketing Success', 'Metrics 101', 'Running a Business', 'Starting a Business', 'Startup Tips', 'Glossary'];
  const tagLinks = tagLabels
    .filter((l) => labels.has(l))
    .map((l) => `<a href="${esc(labels.get(l))}">${esc(l)}</a>`).join(' ');

  const mastRows = [
    row([`<h1>${esc(h1)}</h1>`]),
    row([`<p>${esc(lede)}</p>`]),
    row([`<p>${esc(subLine)}</p>`]),
    row([`<p>${tagLinks}</p>`]),
    formRow(),
  ];

  const entryRows = [headRow(entries.length)];
  entries.forEach((e, i) => entryRows.push(entryRow(i, i === 0 ? 'h2' : 'h3', e.title, null, e.href)));
  entryRows.push(pageFoot());

  const body = page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead form', mastRows)]),
    section([block('ledger entries', entryRows)]),
  ]);
  return { html: body, count: entries.length };
}

/* ── founder-chats ───────────────────────────────────────────────────── */
export function buildFounderChatsIndex(d) {
  const h1 = norm(d.headings[0].text);
  const lede = norm(d.body[0] || '');
  const titles = d.headings.filter((h) => h.tag === 'h4').map((h) => norm(h.text));
  const fcCtas = d.ctas.filter((c) => (c.href || '').includes('/founder-chats/'));
  const entries = titles.map((t, i) => {
    const cta = fcCtas.find((c) => norm(c.label).startsWith(t));
    return { title: t, teaser: norm(d.body[1 + i] || ''), href: cta ? cta.href : '#' };
  });

  const mastRows = [
    row([`<h1>${esc(h1)}</h1>`]),
    row([`<p>${esc(lede)}</p>`]),
    formRow(),
  ];

  const entryRows = [headRow(entries.length)];
  entries.forEach((e, i) => entryRows.push(entryRow(i, i === 0 ? 'h2' : 'h3', e.title, e.teaser, e.href)));
  entryRows.push(pageFoot());

  const body = page([
    metadata({ Title: clampTitle(d.title), Description: d.description }),
    section([block('masthead form', mastRows)]),
    section([block('ledger entries', entryRows)]),
  ]);
  return { html: body, count: entries.length };
}

/* ── CLI entry (English generation — unchanged output) ─────────────────── */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = buildAcademyIndex(readPage('academy'));
  writeOut('content/academy.html', a.html);
  console.log(`academy: ${a.count} entries → content/academy.html`);
  const f = buildFounderChatsIndex(readPage('founder-chats'));
  writeOut('content/founder-chats.html', f.html);
  console.log(`founder-chats: ${f.count} entries → content/founder-chats.html`);
  console.log(`indexes: done (academy=${a.count}, founder-chats=${f.count})`);
}
