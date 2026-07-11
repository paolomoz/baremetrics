#!/usr/bin/env node
/**
 * stardust/build-content.mjs — generate the Wave-A content pages (DA body
 * fragments, David's model) programmatically from the approved prototypes.
 * ALL copy/hrefs/images are extracted from the prototype DOM — never
 * hand-copied (the brief's rule for the 99-entry experts ledger, applied to
 * every ledger). Run: node stardust/build-content.mjs
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(here, '../../baremetrics/stardust/prototypes');
const OUT = path.resolve(here, '../content');
fs.mkdirSync(OUT, { recursive: true });

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

const metadata = (title, desc) => `  <div>
    <div class="metadata">
      <div><div>Title</div><div>${esc(title)}</div></div>
      <div><div>Description</div><div>${esc(desc)}</div></div>
    </div>
  </div>`;

const page = (sections) => `<body>
<header></header>
<main>
${sections.join('\n')}
</main>
<footer></footer>
</body>
`;

const row = (cells) => `      <div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;
const block = (cls, rows) => `  <div>
    <div class="${cls}">
${rows.join('\n')}
    </div>
  </div>`;
const blockWithHead = (headHtml, cls, rows) => `  <div>
${headHtml}
    <div class="${cls}">
${rows.join('\n')}
    </div>
  </div>`;

const browser = await chromium.launch();
const tab = await browser.newPage();

async function load(slug) {
  await tab.goto(`file://${PROTO}/${slug}-proposed.html`, { waitUntil: 'domcontentloaded' });
  return tab.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content || '',
  }));
}

const T = (s) => (s || '').replace(/\s+/g, ' ').trim();

/* ── blog ────────────────────────────────────────────────────────────── */
{
  const meta = await load('blog');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const mast = document.querySelector('[data-section="index-masthead"]');
    const lead = document.querySelector('[data-section="lead-entry"] .lead-link');
    const entries = [...document.querySelectorAll('[data-section="entry-ledger"] .entry-row')].map((a) => ({
      no: t(a.querySelector('.entry-no')?.textContent),
      title: t(a.querySelector('h3')?.textContent),
      teaser: t(a.querySelector('p')?.textContent),
      go: t(a.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
      href: a.getAttribute('href'),
    }));
    return {
      h1: t(mast.querySelector('h1')?.textContent),
      lede: t(mast.querySelector('.section-lede')?.textContent),
      subLine: t(mast.querySelector('.subscribe-line')?.textContent),
      label: t(mast.querySelector('label')?.textContent),
      placeholder: mast.querySelector('input')?.placeholder || '',
      button: t(mast.querySelector('button')?.textContent),
      heads: [...document.querySelectorAll('[data-section="entry-ledger"] .ledger-head .meta-label')].map((m) => t(m.textContent)),
      lead: {
        no: t(lead.querySelector('.entry-no')?.textContent),
        date: t(lead.querySelector('.meta-label')?.textContent),
        title: t(lead.querySelector('h2')?.textContent),
        teaser: t(lead.querySelector('.lead-teaser')?.textContent),
        go: t(lead.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
        href: lead.getAttribute('href'),
      },
      entries,
      pag: {
        prev: t(document.querySelector('[data-section="pagination"] .page-btn')?.textContent).replace(/^←\s*/, ''),
        page: t(document.querySelector('[data-section="pagination"] .page-row .meta-label')?.textContent),
        next: t([...document.querySelectorAll('[data-section="pagination"] .page-btn')].pop()?.textContent).replace(/\s*→$/, ''),
        note: t(document.querySelector('[data-section="pagination"] .visually-hidden')?.textContent),
      },
    };
  });
  const mastRows = [
    row([`<h1>${esc(data.h1)}</h1>`]),
    row([`<p>${esc(data.lede)}</p>`]),
    row([`<p>${esc(data.subLine)}</p>`]),
    row([esc(data.label), esc(data.placeholder), esc(data.button)]),
  ];
  const ledgerRows = [
    row(data.heads.map(esc)),
    row([esc(data.lead.no), esc(data.lead.date),
      `<h2>${esc(data.lead.title)}</h2><p>${esc(data.lead.teaser)}</p>`,
      `<a href="${escAttr(data.lead.href)}">${esc(data.lead.go)}</a>`]),
    ...data.entries.map((e) => row([esc(e.no),
      `<h3>${esc(e.title)}</h3><p>${esc(e.teaser)}</p>`,
      `<a href="${escAttr(e.href)}">${esc(e.go)}</a>`])),
    row([esc(data.pag.prev), esc(data.pag.page), esc(data.pag.next), esc(data.pag.note)]),
  ];
  fs.writeFileSync(path.join(OUT, 'blog.html'), page([
    metadata(meta.title, meta.desc),
    block('masthead form', mastRows),
    block('ledger entries', ledgerRows),
  ]));
  console.log(`blog.html: lead + ${data.entries.length} entries`);
}

/* ── glossary ────────────────────────────────────────────────────────── */
{
  const meta = await load('glossary');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const mast = document.querySelector('[data-section="academy-masthead"]');
    const rail = [...document.querySelectorAll('[data-section="tag-rail"] a')].map((a) => ({
      text: t(a.textContent), href: a.getAttribute('href'), current: a.getAttribute('aria-current') === 'true',
    }));
    const groups = [...document.querySelectorAll('[data-section="term-ledger"] .letter-group')].map((g) => ({
      letter: t(g.querySelector('.letter-label')?.textContent),
      terms: [...g.querySelectorAll('.term-row')].map((a) => ({
        title: t(a.querySelector('h3')?.textContent),
        go: t(a.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
        href: a.getAttribute('href'),
      })),
    }));
    return {
      kicker: t(mast.querySelector('.kicker')?.textContent),
      h1: t(mast.querySelector('h1')?.textContent),
      lede: t(mast.querySelector('.section-lede')?.textContent),
      subLine: t(mast.querySelector('.subscribe-line')?.textContent),
      label: t(mast.querySelector('label')?.textContent),
      placeholder: mast.querySelector('input')?.placeholder || '',
      button: t(mast.querySelector('button')?.textContent),
      railCount: t(document.querySelector('[data-section="tag-rail"] .rail-count')?.textContent),
      h2: t(document.querySelector('[data-section="term-ledger"] h2')?.textContent),
      rail,
      groups,
    };
  });
  const railHtml = `<p>${data.rail.map((l) => {
    const a = `<a href="${escAttr(l.href)}">${esc(l.text)}</a>`;
    return l.current ? `<strong>${a}</strong>` : a;
  }).join(' ')}</p><p>${esc(data.railCount)}</p>`;
  const mastRows = [
    row([`<p>${esc(data.kicker)}</p>`]),
    row([`<h1>${esc(data.h1)}</h1>`]),
    row([`<p>${esc(data.lede)}</p>`]),
    row([`<p>${esc(data.subLine)}</p>`]),
    row([esc(data.label), esc(data.placeholder), esc(data.button)]),
    row([railHtml]),
  ];
  const ledgerRows = [];
  let n = 0;
  data.groups.forEach((g) => {
    ledgerRows.push(row([esc(g.letter)]));
    g.terms.forEach((term) => {
      n += 1;
      ledgerRows.push(row([`<h3>${esc(term.title)}</h3>`, `<a href="${escAttr(term.href)}">${esc(term.go)}</a>`]));
    });
  });
  fs.writeFileSync(path.join(OUT, 'glossary.html'), page([
    metadata(meta.title, meta.desc),
    block('masthead form mist', mastRows),
    blockWithHead(`    <h2>${esc(data.h2)}</h2>`, 'ledger terms', ledgerRows),
  ]));
  console.log(`glossary.html: ${data.groups.length} letter groups, ${n} terms`);
}

/* ── experts ─────────────────────────────────────────────────────────── */
{
  const meta = await load('experts');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const mast = document.querySelector('[data-section="experts-masthead"]');
    const rail = [...document.querySelectorAll('[data-section="category-rail"] a')].map((a) => ({
      text: t(a.textContent), href: a.getAttribute('href'), current: a.getAttribute('aria-current') === 'true',
    }));
    const experts = [...document.querySelectorAll('[data-section="expert-ledger"] .expert-row')].map((a) => {
      const logoImg = a.querySelector('.logo-cell img');
      return {
        href: a.getAttribute('href'),
        img: logoImg ? logoImg.getAttribute('src') : null,
        imgW: logoImg ? logoImg.getAttribute('width') : null,
        imgH: logoImg ? logoImg.getAttribute('height') : null,
        chip: !!a.querySelector('.logo-chip'),
        fallback: t(a.querySelector('.logo-fallback')?.textContent) || null,
        name: t(a.querySelector('h3')?.textContent),
        cats: t(a.querySelector('.expert-cats')?.textContent),
        desc: t(a.querySelector('.expert-desc')?.textContent),
        go: t(a.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
      };
    });
    return {
      h1: t(mast.querySelector('h1')?.textContent),
      lede: t(mast.querySelector('.section-lede')?.textContent),
      railCount: t(document.querySelector('[data-section="category-rail"] .rail-count')?.textContent),
      railNote: t(document.querySelector('[data-section="category-rail"] .visually-hidden')?.textContent),
      h2: t(document.querySelector('[data-section="expert-ledger"] h2')?.textContent),
      rail,
      experts,
    };
  });
  const railHtml = `<p>${data.rail.map((l) => {
    const a = `<a href="${escAttr(l.href)}">${esc(l.text)}</a>`;
    return l.current ? `<strong>${a}</strong>` : a;
  }).join(' ')}</p><p>${esc(data.railCount)}</p><p>${esc(data.railNote)}</p>`;
  const mastRows = [
    row([`<h1>${esc(data.h1)}</h1>`]),
    row([`<p>${esc(data.lede)}</p>`]),
    row([railHtml]),
  ];
  const ledgerRows = data.experts.map((e) => {
    let logo;
    if (e.img) {
      const img = `<img src="${escAttr(e.img)}" alt=""${e.imgW ? ` width="${e.imgW}"` : ''}${e.imgH ? ` height="${e.imgH}"` : ''} loading="lazy">`;
      logo = e.chip ? `<em>${img}</em>` : img;
    } else {
      logo = esc(e.fallback || e.name);
    }
    return row([logo,
      `<h3>${esc(e.name)}</h3><p>${esc(e.cats)}</p><p>${esc(e.desc)}</p>`,
      `<a href="${escAttr(e.href)}">${esc(e.go)}</a>`]);
  });
  fs.writeFileSync(path.join(OUT, 'experts.html'), page([
    metadata(meta.title, meta.desc),
    block('masthead', mastRows),
    blockWithHead(`    <h2>${esc(data.h2)}</h2>`, 'ledger experts', ledgerRows),
  ]));
  const chips = data.experts.filter((e) => e.chip).length;
  const falls = data.experts.filter((e) => !e.img).length;
  console.log(`experts.html: ${data.experts.length} experts (${chips} chips, ${falls} wordmark fallbacks)`);
}

/* ── open-startups ───────────────────────────────────────────────────── */
{
  const meta = await load('open-startups');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const mast = document.querySelector('[data-section="masthead"]');
    const arts = [...mast.querySelectorAll('.masthead-art')].map((img) => ({
      src: img.getAttribute('src'), w: img.getAttribute('width'), h: img.getAttribute('height'),
    }));
    const rowsD = [...document.querySelectorAll('[data-section="revenue-ledger"] .ledger-row')].map((a) => {
      const img = a.querySelector('.ledger-logo img');
      return {
        href: a.getAttribute('href'),
        img: img?.getAttribute('src'),
        imgW: img?.getAttribute('width'),
        imgH: img?.getAttribute('height'),
        name: t(a.querySelector('h3')?.textContent),
        desc: t(a.querySelector('.ledger-copy p')?.textContent),
        revLabel: t(a.querySelector('.ledger-rev .meta-label')?.textContent),
        revFigure: t(a.querySelector('.rev-figure')?.textContent),
      };
    });
    const sub = document.querySelector('[data-section="subscribe"]');
    return {
      h1: t(mast.querySelector('h1')?.textContent),
      lede: t(mast.querySelector('.section-lede')?.textContent),
      h2: t(document.querySelector('[data-section="revenue-ledger"] h2')?.textContent),
      count: t(document.querySelector('[data-section="revenue-ledger"] .ledger-count')?.textContent),
      rows: rowsD,
      subLede: t(sub.querySelector('.subscribe-lede')?.textContent),
      subLabel: t(sub.querySelector('label')?.textContent),
      subPlaceholder: sub.querySelector('input')?.placeholder || '',
      subButton: t(sub.querySelector('button')?.textContent),
      arts,
    };
  });
  const mastRows = [
    row(data.arts.map((a2) => `<img src="${escAttr(a2.src)}" alt=""${a2.w ? ` width="${a2.w}"` : ''}${a2.h ? ` height="${a2.h}"` : ''}>`)),
    row([`<h1>${esc(data.h1)}</h1>`]),
    row([`<p>${esc(data.lede)}</p>`]),
  ];
  const ledgerRows = data.rows.map((r) => row([
    `<img src="${escAttr(r.img)}" alt=""${r.imgW ? ` width="${r.imgW}"` : ''}${r.imgH ? ` height="${r.imgH}"` : ''}>`,
    `<h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p>`,
    `<p>${esc(r.revLabel)}</p><p>${esc(r.revFigure)}</p>`,
    `<a href="${escAttr(r.href)}">${esc(r.name)}</a>`,
  ]));
  const bandRows = [
    row([`<p>${esc(data.subLede)}</p>`]),
    row([esc(data.subLabel), esc(data.subPlaceholder), esc(data.subButton)]),
  ];
  fs.writeFileSync(path.join(OUT, 'open-startups.html'), page([
    metadata(meta.title, meta.desc),
    block('masthead art', mastRows),
    blockWithHead(`    <h2>${esc(data.h2)}</h2>\n    <p>${esc(data.count)}</p>`, 'ledger revenue', ledgerRows),
    block('band tint form', bandRows),
  ]));
  console.log(`open-startups.html: ${data.rows.length} revenue rows`);
}

/* ── help ────────────────────────────────────────────────────────────── */
{
  const meta = await load('help');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const mast = document.querySelector('[data-section="kb-masthead"]');
    const coll = document.querySelector('[data-section="collection-ledger"]');
    const contact = document.querySelector('[data-section="contact-band"]');
    return {
      h1: t(mast.querySelector('h1')?.textContent),
      searchLabel: t(mast.querySelector('.kb-search-label')?.textContent),
      placeholder: mast.querySelector('input')?.placeholder || '',
      searchBtn: t(mast.querySelector('.kb-search-btn')?.textContent),
      searchNote: t(mast.querySelector('#kb-search-note')?.textContent),
      h2: t(coll.querySelector('h2')?.textContent),
      collNote: t(coll.querySelector('p.visually-hidden')?.textContent),
      go: t(coll.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
      href: coll.querySelector('.ledger-row')?.getAttribute('href'),
      domain: t(coll.querySelector('.ledger-row .meta-label')?.textContent),
      contactH2: t(contact.querySelector('h2')?.textContent),
      contactEyebrow: t(contact.querySelector('.meta-label')?.textContent),
      contactCta: t(contact.querySelector('a')?.textContent),
      contactHref: contact.querySelector('a')?.getAttribute('href'),
    };
  });
  const mastRows = [
    row([`<h1>${esc(data.h1)}</h1>`]),
    row([esc(data.searchLabel), esc(data.placeholder), esc(data.searchBtn)]),
    row([`<p>${esc(data.searchNote)}</p>`]),
  ];
  const ledgerRows = [
    row([`<a href="${escAttr(data.href)}">${esc(data.go)}</a>`, esc(data.domain)]),
  ];
  const bandRows = [
    row([`<p>${esc(data.contactEyebrow)}</p>`]),
    row([`<p><strong><a href="${escAttr(data.contactHref)}">${esc(data.contactCta)}</a></strong></p>`]),
  ];
  fs.writeFileSync(path.join(OUT, 'help.html'), page([
    metadata(meta.title, meta.desc),
    block('masthead search', mastRows),
    blockWithHead(`    <h2>${esc(data.h2)}</h2>\n    <p>${esc(data.collNote)}</p>`, 'ledger collections', ledgerRows),
    blockWithHead(`    <h2>${esc(data.contactH2)}</h2>`, 'band tint cta quiet', bandRows),
  ]));
  console.log('help.html: 1 collection row + contact band');
}

await browser.close();
console.log(`done → ${OUT}`);
