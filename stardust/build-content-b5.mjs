#!/usr/bin/env node
/**
 * stardust/build-content-b5.mjs — generate the Wave-B5 content pages
 * (customers, about, ltv-calc) as DA body fragments (David's model),
 * programmatically from the approved prototypes — ALL copy/hrefs/images are
 * extracted from the prototype DOM, never hand-copied (the Wave-A rule).
 * Also emits the matching qa/ harness pages (content main + runtime head +
 * the page's _patches CSS links, mirroring the post-merge state).
 * Run: node stardust/build-content-b5.mjs
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(here, '../../baremetrics/stardust/prototypes');
const OUT = path.resolve(here, '../content');
const QA = path.resolve(here, '../qa');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(QA, { recursive: true });

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

const img = (m, extra = '') => `<img src="${escAttr(m.src)}" alt="${escAttr(m.alt || '')}"${m.w ? ` width="${m.w}"` : ''}${m.h ? ` height="${m.h}"` : ''}${extra}>`;

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

/* qa harness page: content main + runtime head + this page's patch CSS
   (patches mirror the post-merge block CSS — linked explicitly here) */
const qaPage = (contentHtml, patches) => {
  /* the metadata section is pipeline config — never rendered; drop it from
     the harness page (matching the Wave-A qa pages) */
  const main = contentHtml.match(/<main>[\s\S]*?<\/main>/)[0]
    .replace(/ {2}<div>\n {4}<div class="metadata">[\s\S]*?\n {2}<\/div>\n/, '');
  const links = patches.map((p) => `<link rel="stylesheet" href="${p}"><!-- _patches: post-merge state -->`).join('\n');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>QA harness</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/styles/styles.css">
${links}
<script src="/scripts/ak.js" type="module"></script>
<script src="/scripts/scripts.js" type="module"></script>
<link rel="icon" href="/favicon.png"></head>
<body>
${main}
</body></html>`;
};

const browser = await chromium.launch();
const tab = await browser.newPage();

async function load(slug) {
  await tab.goto(`file://${PROTO}/${slug}-proposed.html`, { waitUntil: 'domcontentloaded' });
  return tab.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content || '',
  }));
}

/* ── customers ───────────────────────────────────────────────────────── */
{
  const meta = await load('customers');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const im = (el) => (el ? {
      src: el.getAttribute('src'), alt: el.getAttribute('alt') || '', w: el.getAttribute('width'), h: el.getAttribute('height'),
    } : null);
    const mast = document.querySelector('[data-section="masthead"]');
    /* h1 with the counter pull: text runs + the .h1-pull span, in order */
    const h1Parts = [...mast.querySelector('h1').childNodes].map((n) => (
      n.nodeType === 3 ? { text: n.textContent } : { pull: t(n.textContent) }
    ));
    const lead = document.querySelector('[data-section="lead-story"] .lead-link');
    const entries = [...document.querySelectorAll('[data-section="case-ledger"] .entry')].map((e) => {
      const a = e.querySelector('.entry-link');
      return {
        href: a.getAttribute('href'),
        img: im(a.querySelector('.win img')),
        metas: [...a.querySelectorAll('.meta-label')].map((m) => t(m.textContent)),
        title: t(a.querySelector('h3')?.textContent),
        teaser: t(a.querySelector('.entry-teaser')?.textContent),
      };
    });
    const quote = document.querySelector('[data-section="testimonial"]');
    return {
      h1Parts,
      lede: t(mast.querySelector('.section-lede')?.textContent),
      label: t(mast.querySelector('.subscribe label')?.textContent),
      placeholder: mast.querySelector('.subscribe input')?.placeholder || '',
      button: t(mast.querySelector('.subscribe button')?.textContent),
      note: t(mast.querySelector('.subscribe-note')?.textContent),
      arts: [...mast.querySelectorAll('.masthead-art')].map(im),
      lead: {
        href: lead.getAttribute('href'),
        img: im(lead.querySelector('.win img')),
        avatar: im(lead.querySelector('.lead-foot img')),
        meta: t(lead.querySelector('.meta-label')?.textContent),
        title: t(lead.querySelector('h2')?.textContent),
        teaser: t(lead.querySelector('.lead-teaser')?.textContent),
        go: t(lead.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
      },
      entries,
      quote: {
        avatar: im(quote.querySelector('.fp-avatar')),
        text: t(quote.querySelector('blockquote p')?.textContent),
        logo: im(quote.querySelector('.fp-logo')),
      },
      logos: [...document.querySelectorAll('[data-section="customer-logos"] .logo-table img')].map(im),
    };
  });

  const h1Html = `<h1>${data.h1Parts.map((p) => (p.pull !== undefined ? `<em>${esc(p.pull)}</em>` : esc(p.text))).join('')}</h1>`;
  const mastRows = [
    row(data.arts.map((a) => img(a))),
    row([h1Html]),
    row([`<p>${esc(data.lede)}</p>`]),
    row([esc(data.label), esc(data.placeholder), esc(data.button)]),
    row([`<p>${esc(data.note)}</p>`]),
  ];
  const leadRows = [
    row([img(data.lead.img) + img(data.lead.avatar, ' loading="lazy"'),
      `<p>${esc(data.lead.meta)}</p><h2>${esc(data.lead.title)}</h2><p>${esc(data.lead.teaser)}</p>`,
      `<a href="${escAttr(data.lead.href)}">${esc(data.lead.go)}</a>`]),
  ];
  const caseRows = data.entries.map((e) => row([
    img(e.img, ' loading="lazy"'),
    `${e.metas.map((m) => `<p>${esc(m)}</p>`).join('')}<h3>${esc(e.title)}</h3><p>${esc(e.teaser)}</p>`,
    `<a href="${escAttr(e.href)}">${esc(e.title)}</a>`,
  ]));
  const quoteRows = [
    row([img(data.quote.avatar, ' loading="lazy"')]),
    row([`<p>${esc(data.quote.text)}</p>`]),
    row([img(data.quote.logo, ' loading="lazy"')]),
  ];
  const logoRows = [row([data.logos.map((m) => img(m, ' loading="lazy"')).join('')])];

  const html = page([
    metadata(meta.title, meta.desc),
    block('masthead counter art form', mastRows),
    block('cards cases', leadRows),
    block('cards cases', caseRows),
    block('quote band', quoteRows),
    block('logos table five', logoRows),
  ]);
  fs.writeFileSync(path.join(OUT, 'customers.html'), html);
  fs.writeFileSync(path.join(QA, 'customers.html'), qaPage(html, [
    '/blocks/masthead/_patches/customers.css',
    '/blocks/logos/_patches/customers.css',
  ]));
  console.log(`customers.html: lead + ${data.entries.length} entries, ${data.logos.length} logos`);
}

/* ── about ───────────────────────────────────────────────────────────── */
{
  const meta = await load('about');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const im = (el) => (el ? {
      src: el.getAttribute('src'), alt: el.getAttribute('alt') || '', w: el.getAttribute('width'), h: el.getAttribute('height'),
    } : null);
    const mast = document.querySelector('[data-section="masthead"]');
    const roster = document.querySelector('[data-section="team-roster"]');
    const people = [...roster.querySelectorAll('.person')].map((p) => ({
      photo: im(p.querySelector('.person-photo')),
      monogram: t(p.querySelector('.person-monogram')?.textContent) || null,
      name: t(p.querySelector('h3')?.textContent),
      role: t(p.querySelector('.person-id .meta-label')?.textContent),
      mail: t(p.querySelector('.person-mail')?.textContent),
      mailHref: p.querySelector('.person-mail')?.getAttribute('href'),
    }));
    const stats = document.querySelector('[data-section="mission-stats"]');
    const careers = document.querySelector('[data-section="careers"]');
    return {
      h1: t(mast.querySelector('h1')?.textContent),
      lede: t(mast.querySelector('.section-lede')?.textContent),
      rosterHead: t(roster.querySelector('h2')?.textContent),
      rosterLabel: t(roster.querySelector('.roster-label')?.textContent),
      people,
      statsH2: t(stats.querySelector('h2')?.textContent),
      statsLede: t(stats.querySelector('.mission-lede')?.textContent),
      stats: [...stats.querySelectorAll('.stat')].map((s) => ({
        label: t(s.querySelector('dt')?.textContent),
        figure: t(s.querySelector('.figure')?.textContent),
        note: t(s.querySelector('.visually-hidden')?.textContent),
      })),
      careersId: careers.getAttribute('id'),
      careersH2: t(careers.querySelector('h2')?.textContent),
      careersLede: t(careers.querySelector('.section-lede')?.textContent),
      careersCta: t(careers.querySelector('a')?.textContent),
      careersHref: careers.querySelector('a')?.getAttribute('href'),
    };
  });

  const mastRows = [
    row([`<h1>${esc(data.h1)}</h1>`]),
    row([`<p>${esc(data.lede)}</p>`]),
  ];
  const rosterRows = [
    row([esc(data.rosterLabel)]),
    ...data.people.map((p, i) => row([
      p.photo ? img(p.photo, i === 0 ? '' : ' loading="lazy"') : esc(p.monogram),
      `<h3>${esc(p.name)}</h3><p>${esc(p.role)}</p>`,
      `<a href="${escAttr(p.mailHref)}">${esc(p.mail)}</a>`,
    ])),
  ];
  const statsRows = [
    row([`<h2>${esc(data.statsH2)}</h2><p>${esc(data.statsLede)}</p>`]),
    ...data.stats.map((s) => row([esc(s.label), esc(s.figure), esc(s.note)])),
  ];
  const careersRows = [
    row([`<h2 id="${escAttr(data.careersId)}">${esc(data.careersH2)}</h2><p>${esc(data.careersLede)}</p>`]),
    row([`<p><strong><a href="${escAttr(data.careersHref)}">${esc(data.careersCta)}</a></strong></p>`]),
  ];

  const html = page([
    metadata(meta.title, meta.desc),
    block('masthead centered', mastRows),
    blockWithHead(`    <h2>${esc(data.rosterHead)}</h2>`, 'cards roster', rosterRows),
    block('band ink stats', statsRows),
    block('band tint cta', careersRows),
  ]);
  fs.writeFileSync(path.join(OUT, 'about.html'), html);
  fs.writeFileSync(path.join(QA, 'about.html'), qaPage(html, [
    '/blocks/masthead/_patches/about.css',
    '/blocks/cards/_patches/about.css',
    '/blocks/band/_patches/about.css',
  ]));
  const monos = data.people.filter((p) => !p.photo).length;
  console.log(`about.html: ${data.people.length} people (${monos} monogram), ${data.stats.length} stats`);
}

/* ── ltv-calc ────────────────────────────────────────────────────────── */
{
  const meta = await load('ltv-calc');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const mast = document.querySelector('[data-section="tool-masthead"]');
    const calc = document.querySelector('[data-section="calculator-sheet"]');
    const months = [...calc.querySelectorAll('.metrics thead th')].map((th) => t(th.textContent));
    const metrics = [...calc.querySelectorAll('.metrics tbody tr')].map((tr) => ({
      label: t(tr.querySelector('th')?.textContent),
      values: [...tr.querySelectorAll('input')].map((i) => i.getAttribute('value')),
    }));
    const results = [...calc.querySelectorAll('.result')].map((r) => ({
      label: t(r.querySelector('dt')?.textContent),
      figure: t(r.querySelector('.result-fig')?.textContent),
      caption: t(r.querySelector('.result-cap')?.textContent),
    }));
    const method = document.querySelector('[data-section="method-note"]');
    const cols = [...method.querySelectorAll('.method-col')].map((c) => c.innerHTML.trim());
    const trial = document.querySelector('[data-section="trial-cta"]');
    return {
      h1: t(mast.querySelector('h1')?.textContent),
      lede: t(mast.querySelector('.section-lede')?.textContent),
      calcH2: t(calc.querySelector('#calc-title')?.textContent),
      calcSub: t(calc.querySelector('.calc-sub')?.textContent),
      importLabel: t(calc.querySelector('.calc-import-label')?.textContent),
      importNote: t(calc.querySelector('.calc-import-note')?.textContent),
      inputsH3: t(calc.querySelector('.calc-inputs h3')?.textContent),
      inputsSub: t(calc.querySelector('.calc-inputs-sub')?.textContent),
      switches: [...calc.querySelectorAll('.toggle-switch')].map((s) => t(s.childNodes[0].textContent)),
      months,
      metrics,
      formulaLabel: t(calc.querySelector('.formula-row .meta-label')?.textContent),
      formula: t(calc.querySelector('.formula-fig')?.textContent),
      results,
      revdistH3: t(calc.querySelector('.revdist h3')?.textContent),
      methodLabel: t(method.querySelector('.meta-label')?.textContent),
      methodCols: cols,
      trialH2: t(trial.querySelector('h2')?.textContent),
      trialCta: t(trial.querySelector('a')?.textContent),
      trialHref: trial.querySelector('a')?.getAttribute('href'),
    };
  });

  const mastRows = [
    row([`<h1>${esc(data.h1)}</h1>`]),
    row([`<p>${esc(data.lede)}</p>`]),
  ];
  const calcRows = [
    row([`<h2>${esc(data.calcH2)}</h2><p>${esc(data.calcSub)}</p>`]),
    row([`<p>${esc(data.importLabel)}</p><p>${esc(data.importNote)}</p>`]),
    row([`<h3>${esc(data.inputsH3)}</h3><p>${esc(data.inputsSub)}</p>`]),
    ...data.switches.map((s) => row([esc(s)])),
    row(data.months.map(esc)),
    ...data.metrics.map((m) => row([esc(m.label), ...m.values.map(esc)])),
    row([esc(data.formulaLabel), esc(data.formula)]),
    ...data.results.map((r) => row([esc(r.label), esc(r.figure), esc(r.caption)])),
    row([`<h3>${esc(data.revdistH3)}</h3>`]),
  ];
  /* method columns: prototype prose kept verbatim including the inline
     <strong> formula (col innerHTML, indentation collapsed) */
  const methodRows = [
    row([esc(data.methodLabel)]),
    row(data.methodCols.map((c) => c.replace(/\s+/g, ' ').trim())),
  ];
  const trialRows = [
    row([`<h2>${esc(data.trialH2)}</h2>`]),
    row([`<p><strong><a href="${escAttr(data.trialHref)}">${esc(data.trialCta)}</a></strong></p>`]),
  ];

  const html = page([
    metadata(meta.title, meta.desc),
    block('masthead tool', mastRows),
    block('calculator', calcRows),
    block('sheets note', methodRows),
    block('band tint cta', trialRows),
  ]);
  fs.writeFileSync(path.join(OUT, 'ltv-calc.html'), html);
  fs.writeFileSync(path.join(QA, 'ltv-calc.html'), qaPage(html, []));
  console.log(`ltv-calc.html: ${data.metrics.length} metric rows × ${data.months.length - 1} months, ${data.switches.length} switches, ${data.results.length} results`);
}

await browser.close();
console.log(`done → ${OUT} + ${QA}`);
