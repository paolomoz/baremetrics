#!/usr/bin/env node
/**
 * stardust/build-home.mjs — Wave-B1: generate content/index.html (DA body
 * fragment, David's model) programmatically from the approved home-B
 * prototype. ALL copy/hrefs/images are extracted from the prototype DOM —
 * never hand-copied (Wave A's rule, stardust/build-content.mjs technique).
 * Also emits qa/home.html (local render harness page incl. _patches CSS).
 * Run: node stardust/build-home.mjs
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(here, '../../baremetrics/stardust/prototypes');
const ROOT = path.resolve(here, '..');

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
const img = (m) => `<img src="${escAttr(m.src)}" alt="${escAttr(m.alt || '')}"${m.w ? ` width="${m.w}"` : ''}${m.h ? ` height="${m.h}"` : ''} loading="lazy">`;
const linkedImg = (m) => (m.href ? `<a href="${escAttr(m.href)}">${img(m)}</a>` : img(m));

const metadata = (title, desc) => `  <div>
    <div class="metadata">
      <div><div>Title</div><div>${esc(title)}</div></div>
      <div><div>Description</div><div>${esc(desc)}</div></div>
    </div>
  </div>`;

const row = (cells) => `      <div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;
const block = (cls, rows) => `    <div class="${cls}">
${rows.join('\n')}
    </div>`;
const section = (parts) => `  <div>
${parts.join('\n')}
  </div>`;
const sectionMeta = (style) => `    <div class="section-metadata"><div><div>style</div><div>${esc(style)}</div></div></div>`;

const page = (sections) => `<body>
<header></header>
<main>
${sections.join('\n')}
</main>
<footer></footer>
</body>
`;

const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(`file://${PROTO}/home-B-proposed.html`, { waitUntil: 'domcontentloaded' });

const data = await tab.evaluate(() => {
  const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const S = (name) => document.querySelector(`[data-section="${name}"]`);
  const pic = (el) => (el ? {
    src: el.getAttribute('src'), alt: el.getAttribute('alt') || '', w: el.getAttribute('width'), h: el.getAttribute('height'),
  } : null);
  const mark = (li) => {
    const a = li.querySelector('a');
    return { ...pic(li.querySelector('img')), href: a ? a.getAttribute('href') : null };
  };
  const cta = (a) => ({ text: t(a.textContent), href: a.getAttribute('href') });

  /* hero */
  const hero = S('hero');
  const h1 = hero.querySelector('h1');
  const h1Clone = h1.cloneNode(true);
  h1Clone.querySelectorAll('span').forEach((s) => s.remove());
  const names = JSON.parse(hero.querySelector('.hero-carousel').dataset.items);

  /* triptych / mosaic / lead-index units share one shape */
  const unit = (a) => ({
    h3: t(a.querySelector('h3')?.textContent),
    p: t(a.querySelector('p, .index-copy p')?.textContent),
    go: t(a.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
    href: a.getAttribute('href') || null,
    img: pic(a.querySelector('img')),
  });

  const gd = S('growth-drivers');
  const dd = S('data-decisions');
  const notify = S('integrations-notify');
  const ci = S('feature-cancellation-insights');
  const rec = S('feature-recover');
  const os = S('open-startups');
  const pub = S('publications');
  const close = S('closing-cta');
  const test = S('testimonial');

  return {
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content || '',
    hero: {
      h1: t(h1Clone.textContent),
      names,
      lede: t(hero.querySelector('.hero-lede')?.textContent),
      facts: t(hero.querySelector('.hero-facts')?.textContent),
      ctas: [...hero.querySelectorAll('.hero-ctas a')].map(cta),
    },
    providers: {
      h2: t(S('payment-providers').querySelector('h2')?.textContent),
      label: t(S('payment-providers').querySelector('.logo-table-label')?.textContent),
      marks: [...S('payment-providers').querySelectorAll('.logo-table li:not(.logo-table-label)')].map(mark),
    },
    proof: [...S('dashboard-proof').querySelectorAll('.tript-col')].map(unit),
    counter: {
      figure: t(S('customer-logos').querySelector('.counter-figure')?.textContent),
      rest: t(S('customer-logos').querySelector('.counter-rest')?.textContent),
      marks: [...S('customer-logos').querySelectorAll('.counter-logos li')].map(mark),
    },
    growth: {
      h2: t(gd.querySelector('h2')?.textContent),
      lede: t(gd.querySelector('.section-lede')?.textContent),
      panels: [...gd.querySelectorAll('.panel')].map(unit),
    },
    testimonial: {
      meta: t(test.querySelector('.meta-label')?.textContent),
      quote: t(test.querySelector('blockquote')?.textContent),
      avatar: pic(test.querySelector('.testimonial-attrib img')),
      name: t(test.querySelector('cite')?.childNodes[0]?.textContent),
      role: t(test.querySelector('cite span')?.textContent),
      badgeHref: test.querySelector('.testimonial-g2')?.getAttribute('href'),
      badgeImg: pic(test.querySelector('.testimonial-g2 img')),
    },
    decisions: {
      h2: t(dd.querySelector('h2')?.textContent),
      lede: t(dd.querySelector('.section-lede')?.textContent),
      panels: [dd.querySelector('.lead-panel'), ...dd.querySelectorAll('.index-entry')].map(unit),
    },
    notify: {
      h2: t(notify.querySelector('h2')?.textContent),
      lede: t(notify.querySelector('.notify-sheet > p')?.textContent),
      label: t(notify.querySelector('label')?.textContent),
      placeholder: notify.querySelector('input')?.placeholder || '',
      button: t(notify.querySelector('button')?.textContent),
      marks: [...notify.querySelectorAll('.notify-logos li')].map(mark),
    },
    cancellation: {
      chip: t(ci.querySelector('.tag-chip')?.textContent),
      h2: t(ci.querySelector('h2')?.textContent),
      lede: t(ci.querySelector('.section-lede')?.textContent),
      ctas: [...ci.querySelectorAll('.feature-ctas a')].map(cta),
      quote: t(ci.querySelector('.margin-note blockquote')?.textContent),
      citeName: t(ci.querySelector('.margin-note cite')?.textContent),
      avatar: pic(ci.querySelector('.quote-attrib img')),
      media: pic(ci.querySelector('.case-media img')),
    },
    recover: {
      chip: t(rec.querySelector('.tag-chip')?.textContent),
      h2: t(rec.querySelector('h2')?.textContent),
      lede: t(rec.querySelector('.section-lede')?.textContent),
      ctas: [...rec.querySelectorAll('.feature-ctas a')].map(cta),
      pull: t(rec.querySelector('.pull-figure')?.textContent),
      quote: t(rec.querySelector('.pullfig-quote blockquote')?.textContent),
      citeName: t(rec.querySelector('.pullfig-quote cite')?.textContent),
      avatar: pic(rec.querySelector('.quote-attrib img')),
      media: pic(rec.querySelector('.pullfig-media img')),
    },
    openStartups: {
      meta: t(os.querySelector('.rail-head .meta-label')?.textContent),
      h2: t(os.querySelector('h2')?.textContent),
      lede: t(os.querySelector('.section-lede')?.textContent),
      link: cta(os.querySelector('.rail-head a')),
      tiles: [...os.querySelectorAll('.rail-tile img')].map(pic),
    },
    publications: {
      kicker: t(pub.querySelector('.pub-kicker')?.textContent),
      h2: t(pub.querySelector('h2')?.textContent),
      lede: t(pub.querySelector('.section-lede')?.textContent),
      lead: {
        date: t(pub.querySelector('.pub-lead time')?.textContent),
        title: t(pub.querySelector('.pub-lead-title')?.textContent),
        source: t(pub.querySelector('.pub-source')?.textContent),
        href: pub.querySelector('.pub-lead')?.getAttribute('href'),
      },
      rows: [...pub.querySelectorAll('.pub-row-b')].map((a) => ({
        date: t(a.querySelector('time')?.textContent),
        title: t(a.querySelector('.pub-title-b')?.textContent),
        href: a.getAttribute('href'),
      })),
      subLabel: t(pub.querySelector('.pub-subscribe label')?.textContent),
      subPlaceholder: pub.querySelector('.pub-subscribe input')?.placeholder || '',
      subButton: t(pub.querySelector('.pub-subscribe button')?.textContent),
    },
    closing: {
      h2: t(close.querySelector('h2')?.textContent),
      lede: t(close.querySelector('.section-lede')?.textContent),
      cta: cta(close.querySelector('.feature-ctas a')),
      media: pic(close.querySelector('.closing-media img')),
    },
  };
});
await browser.close();

/* ── compose sections (prototype order, one prototype section per unit) ── */
const d = data;
const primary = (c) => `<strong><a href="${escAttr(c.href)}">${esc(c.text)}</a></strong>`;
const plain = (c) => `<a href="${escAttr(c.href)}">${esc(c.text)}</a>`;
const featureCtas = (ctas) => `<p>${primary(ctas[0])} ${plain(ctas[1])}</p>`;
/* triptych/mosaic unit row: [heading+teaser | go-link? | image] */
const unitRow = (u) => row([
  `<h3>${esc(u.h3)}</h3><p>${esc(u.p)}</p>`,
  ...(u.href ? [`<a href="${escAttr(u.href)}">${esc(u.go)}</a>`] : []),
  img(u.img),
]);

const sections = [];

sections.push(metadata('Superior Dashboards and Analytics for Stripe | Baremetrics', d.desc));

/* 1 · hero (bespoke, template-slotted) */
sections.push(section([block('hero', [
  row([`<h1>${esc(d.hero.h1)}</h1>`]),
  row([`<ul>${d.hero.names.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`]),
  row([`<p>${esc(d.hero.lede)}</p>`]),
  row([`<p>${esc(d.hero.facts)}</p>`]),
  row([`<p>${primary(d.hero.ctas[0])} <em><a href="${escAttr(d.hero.ctas[1].href)}">${esc(d.hero.ctas[1].text)}</a></em></p>`]),
])]));

/* 2 · payment providers — ruled logo table */
sections.push(section([
  `    <h2>${esc(d.providers.h2)}</h2>`,
  block('logos table', [
    row([esc(d.providers.label)]),
    row(d.providers.marks.map(linkedImg)),
  ]),
]));

/* 3 · dashboard proof — growth trio */
sections.push(section([block('cards triptych', d.proof.map(unitRow))]));

/* 4 · +900 customer logos — periwinkle counter */
sections.push(section([block('logos counter accent', [
  row([esc(d.counter.figure), esc(d.counter.rest)]),
  row(d.counter.marks.map(img)),
])]));

/* 5 · growth drivers — insight mosaic */
sections.push(section([
  `    <h2>${esc(d.growth.h2)}</h2>`,
  `    <p>${esc(d.growth.lede)}</p>`,
  block('cards mosaic', d.growth.panels.map(unitRow)),
]));

/* 6 · testimonial — record sheet on tint */
sections.push(section([block('quote sheet tint', [
  row([esc(d.testimonial.meta)]),
  row([`<p>${esc(d.testimonial.quote)}</p>`]),
  row([img(d.testimonial.avatar), esc(d.testimonial.name), esc(d.testimonial.role)]),
  row([`<a href="${escAttr(d.testimonial.badgeHref)}">${img(d.testimonial.badgeImg)}</a>`]),
])]));

/* 7 · data decisions — lead + index (mosaic grammar) */
sections.push(section([
  `    <h2>${esc(d.decisions.h2)}</h2>`,
  `    <p>${esc(d.decisions.lede)}</p>`,
  block('cards mosaic', d.decisions.panels.map(unitRow)),
]));

/* 8 · integrations + notify form — tint band + logo strip.
   The h2 is authored INSIDE the band (a heading row), NOT as section default
   content: this section holds TWO absorbing blocks (band + logos) and
   absorbedHead in whichever decorates first would steal a section head. */
sections.push(section([
  block('band form notify', [
    row([`<h2>${esc(d.notify.h2)}</h2>`]),
    row([`<p>${esc(d.notify.lede)}</p>`]),
    row([esc(d.notify.label), esc(d.notify.placeholder), esc(d.notify.button)]),
  ]),
  block('logos strip', [row(d.notify.marks.map(linkedImg))]),
  sectionMeta('tint, graph'),
]));

/* 9 · Cancellation Insights — case file (band + margin-note quote) */
sections.push(section([block('band split', [
  row([esc(d.cancellation.chip)]),
  row([`<h2>${esc(d.cancellation.h2)}</h2>`]),
  row([`<p>${esc(d.cancellation.lede)}</p>`]),
  row([featureCtas(d.cancellation.ctas)]),
  row([img(d.cancellation.media)]),
])]));
sections.push(section([block('quote note', [
  row([`<p>${esc(d.cancellation.quote)}</p>`]),
  row([img(d.cancellation.avatar), esc(d.cancellation.citeName)]),
])]));

/* 10 · Recover — ink pull-figure band (+ quote on ink) */
sections.push(section([block('band ink pull split', [
  row([esc(d.recover.chip)]),
  row([`<h2>${esc(d.recover.h2)}</h2>`]),
  row([`<p>${esc(d.recover.lede)}</p>`]),
  row([featureCtas(d.recover.ctas)]),
  row([esc(d.recover.pull)]),
  row([img(d.recover.media)]),
])]));
sections.push(section([block('quote note ink', [
  row([`<p>${esc(d.recover.quote)}</p>`]),
  row([img(d.recover.avatar), esc(d.recover.citeName)]),
])]));

/* 11 · open startups — filmstrip rail */
sections.push(section([
  `    <p>${esc(d.openStartups.meta)}</p>`,
  `    <h2>${esc(d.openStartups.h2)}</h2>`,
  `    <p>${esc(d.openStartups.lede)}</p>`,
  `    <p><a href="${escAttr(d.openStartups.link.href)}">${esc(d.openStartups.link.text)}</a></p>`,
  block('cards filmstrip', d.openStartups.tiles.map((tile) => row([img(tile)]))),
]));

/* 12 · publications — kicker (default content) + date ledger */
sections.push(section([
  `    <p>${esc(d.publications.kicker)}</p>`,
  sectionMeta('pub-kicker'),
]));
sections.push(section([
  `    <h2>${esc(d.publications.h2)}</h2>`,
  `    <p>${esc(d.publications.lede)}</p>`,
  block('ledger publications', [
    /* the lead keeps its prototype text order: date · title · source */
    row([esc(d.publications.lead.date),
      `<a href="${escAttr(d.publications.lead.href)}">${esc(d.publications.lead.title)} ${esc(d.publications.lead.source)}</a>`]),
    ...d.publications.rows.map((r) => row([esc(r.date), `<a href="${escAttr(r.href)}">${esc(r.title)}</a>`])),
    row([esc(d.publications.subLabel), esc(d.publications.subPlaceholder), esc(d.publications.subButton)]),
  ]),
]));

/* 13 · closing CTA — statement sheet on mist */
sections.push(section([block('band mist cta closing', [
  row([`<h2>${esc(d.closing.h2)}</h2>`]),
  row([`<p>${esc(d.closing.lede)}</p>`]),
  row([`<p>${primary(d.closing.cta)}</p>`]),
  row([img(d.closing.media)]),
])]));

fs.writeFileSync(path.join(ROOT, 'content/index.html'), page(sections));
console.log(`content/index.html: ${sections.length - 1} sections (hero + 12), ${d.hero.names.length} carousel names, ${d.providers.marks.length + d.counter.marks.length + d.notify.marks.length} logo marks, ${d.openStartups.tiles.length} rail tiles, ${d.publications.rows.length + 1} publications`);

/* ── qa/home.html — local render harness (Wave-A technique) incl. patches ── */
const patches = ['band', 'cards', 'ledger', 'logos', 'quote']
  .filter((n) => fs.existsSync(path.join(ROOT, `blocks/${n}/_patches/home.css`)))
  .map((n) => `<link rel="stylesheet" href="/blocks/${n}/_patches/home.css">`)
  .join('\n');
const mainHtml = sections.slice(1).join('\n'); /* drop the metadata block */
fs.writeFileSync(path.join(ROOT, 'qa/home.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>QA harness — home</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/styles/styles.css">
<script src="/scripts/ak.js" type="module"></script>
<script src="/scripts/scripts.js" type="module"></script>
${patches}
<link rel="icon" href="/favicon.png"></head>
<body>
<main>
${mainHtml}
</main>
</body></html>
`);
console.log('qa/home.html written (patches linked)');
