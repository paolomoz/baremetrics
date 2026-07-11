#!/usr/bin/env node
/**
 * stardust/build-content-b3.mjs — Wave B3 content pages (DA body fragments,
 * David's model): content/features/recover.html + content/stripe.html.
 * ALL copy/hrefs/images are extracted programmatically from the approved
 * prototypes — never hand-copied. Also emits the matching QA harness pages
 * (qa/features-recover.html, qa/stripe.html) that load the runtime + the
 * B3 _patches CSS. Run: node stardust/build-content-b3.mjs
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
fs.mkdirSync(path.join(OUT, 'features'), { recursive: true });

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

const img = (m, lazy = true) => `<img src="${escAttr(m.src)}" alt="${escAttr(m.alt || '')}"${m.w ? ` width="${m.w}"` : ''}${m.h ? ` height="${m.h}"` : ''}${lazy ? ' loading="lazy"' : ''}>`;
const btn = (cta) => `<strong><a href="${escAttr(cta.href)}">${esc(cta.text)}</a></strong>`;
const btn2 = (cta) => `<em><a href="${escAttr(cta.href)}">${esc(cta.text)}</a></em>`;

/* QA harness page (Wave-A qa/blog.html pattern) + the B3 patch links the
   main loop will merge into the shared block CSS */
const qaPage = (mainSections, patches) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>QA harness</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/styles/styles.css">
${patches.map((p) => `<link rel="stylesheet" href="${p}"><!-- B3 patch: pending merge into the shared block CSS -->`).join('\n')}
<script src="/scripts/ak.js" type="module"></script>
<script src="/scripts/scripts.js" type="module"></script>
<link rel="icon" href="/favicon.png"></head>
<body>
<main>
${mainSections.join('\n')}
</main>
</body></html>
`;

const browser = await chromium.launch();
const tab = await browser.newPage();

async function load(slug) {
  await tab.goto(`file://${PROTO}/${slug}-proposed.html`, { waitUntil: 'domcontentloaded' });
  return tab.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content || '',
  }));
}

/* ── features/recover ─────────────────────────────────────────────────── */
{
  const meta = await load('features-recover');
  const d = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const im = (el) => (el ? {
      src: el.getAttribute('src'), alt: el.getAttribute('alt') || '', w: el.getAttribute('width'), h: el.getAttribute('height'),
    } : null);
    const S = (n) => document.querySelector(`[data-section="${n}"]`);
    const hero = S('hero');
    const dun = S('dunning-lede');
    const tst = S('testimonial');
    const prb = S('problem');
    const sol = S('solution-steps');
    const ana = S('analytics');
    const roi = S('roi');
    const trl = S('trial-band');
    const faq = S('faq');
    const cal = S('calculator');
    return {
      hero: {
        h1: t(hero.querySelector('h1')?.textContent),
        lede: t(hero.querySelector('.hero-lede')?.textContent),
        cta: { text: t(hero.querySelector('.hero-ctas a')?.textContent), href: hero.querySelector('.hero-ctas a')?.getAttribute('href') },
        chip: t(hero.querySelector('.tag-chip')?.textContent),
        labels: [...hero.querySelectorAll('.stat-head .meta-label')].map((m) => t(m.textContent)),
        figure: t(hero.querySelector('data.figure')?.textContent),
      },
      dunning: {
        h2: t(dun.querySelector('h2')?.textContent),
        lede: t(dun.querySelector('.section-lede')?.textContent),
        label: t(dun.querySelector('.logo-strip-label')?.textContent),
        marks: [...dun.querySelectorAll('.logo-cells img')].map(im),
      },
      quote: {
        source: t(tst.querySelector('.record-sheet > .meta-label')?.textContent),
        text: t(tst.querySelector('blockquote')?.textContent),
        avatar: im(tst.querySelector('.testimonial-attrib img')),
        name: t(tst.querySelector('cite')?.childNodes[0]?.textContent),
        role: t(tst.querySelector('cite span')?.textContent),
      },
      problem: {
        h2: t(prb.querySelector('h2')?.textContent),
        lede: t(prb.querySelector('.section-lede')?.textContent),
        cols: [...prb.querySelectorAll('.compare-col')].map((c) => ({
          img: im(c.querySelector('img')),
          claim: t(c.querySelector('.compare-claim')?.textContent),
          items: [...c.querySelectorAll('.x-list li')].map((li) => t(li.textContent).replace(/^×\s*/, '')),
        })),
      },
      steps: {
        h2: t(sol.querySelector('h2')?.textContent),
        lede: t(sol.querySelector('.section-lede')?.textContent),
        items: [...sol.querySelectorAll('li.step')].map((s) => ({
          meta: t(s.querySelector('.meta-label')?.textContent),
          h3: t(s.querySelector('h3')?.textContent),
          body: t(s.querySelector('.step-body')?.textContent),
          img: im(s.querySelector('img')),
        })),
      },
      analytics: {
        eyebrow: t(ana.querySelector('.meta-label')?.textContent),
        h2: t(ana.querySelector('h2')?.textContent),
        lede: t(ana.querySelector('.section-lede')?.textContent),
        cta: { text: t(ana.querySelector('a.ds-btn-primary')?.textContent), href: ana.querySelector('a.ds-btn-primary')?.getAttribute('href') },
        img: im(ana.querySelector('.win img')),
      },
      roi: {
        h2: t(roi.querySelector('h2')?.textContent),
        lede: t(roi.querySelector('.roi-head .section-lede')?.textContent),
        fig: t(roi.querySelector('.roi-fig')?.textContent),
        trio: [...roi.querySelectorAll('.quote-trio img')].map(im),
        gImg: im(roi.querySelector('.guarantee img')),
        gEyebrow: t(roi.querySelector('.guarantee .meta-label')?.textContent),
        gClaim: t(roi.querySelector('.guarantee-claim')?.textContent),
        gLede: t(roi.querySelector('.guarantee .section-lede')?.textContent),
        gCta: { text: t(roi.querySelector('.guarantee a')?.textContent), href: roi.querySelector('.guarantee a')?.getAttribute('href') },
      },
      trial: {
        chip: t(trl.querySelector('.tag-chip')?.textContent),
        h2: t(trl.querySelector('h2')?.textContent),
        lede: t(trl.querySelector('.band-lede')?.textContent),
        cta: { text: t(trl.querySelector('a.band-cta')?.textContent), href: trl.querySelector('a.band-cta')?.getAttribute('href') },
        img: im(trl.querySelector('.win img')),
        coda: [...trl.querySelectorAll('.band-coda p')].map((p) => t(p.textContent)),
      },
      faq: {
        h2: t(faq.querySelector('h2')?.textContent),
        pairs: [...faq.querySelectorAll('.faq-item')].map((it) => ({
          q: t(it.querySelector('.faq-q')?.textContent),
          a: [...it.querySelector('.faq-panel').children].map((n) => n.outerHTML.replace(/\s+/g, ' ').trim()).join(''),
        })),
        more: (() => {
          const m = faq.querySelector('.faq-more');
          const a = m.querySelector('a');
          return { text: t(m.childNodes[0].textContent), linkText: t(a.textContent), href: a.getAttribute('href') };
        })(),
      },
      calc: {
        h2: t(cal.querySelector('h2')?.textContent),
        cells: [...cal.querySelectorAll('.calc-cell')].map((c) => ({
          label: t(c.querySelector('.meta-label')?.textContent),
          figure: t(c.querySelector('data.figure')?.textContent),
          per: t(c.querySelector('.calc-per')?.textContent),
          note: t(c.querySelector('.visually-hidden')?.textContent),
          cta: c.querySelector('a') ? { text: t(c.querySelector('a').textContent), href: c.querySelector('a').getAttribute('href') } : null,
        })),
        quote: t(cal.querySelector('.calc-quote blockquote')?.textContent),
        avatar: im(cal.querySelector('.testimonial-attrib img')),
        name: t(cal.querySelector('.calc-quote cite')?.childNodes[0]?.textContent),
        role: t(cal.querySelector('.calc-quote cite span')?.textContent),
      },
    };
  });

  const sections = [
    block('feature-hero recover', [
      row([`<h1>${esc(d.hero.h1)}</h1>`]),
      row([`<p>${esc(d.hero.lede)}</p>`]),
      row([`<p>${btn(d.hero.cta)}</p>`]),
      row([esc(d.hero.chip), ...d.hero.labels.map(esc)]),
      row([esc(d.hero.figure)]),
    ]),
    blockWithHead(`    <h2>${esc(d.dunning.h2)}</h2>\n    <p>${esc(d.dunning.lede)}</p>`, 'logos banded', [
      row([`<p>${esc(d.dunning.label)}</p>`]),
      row([d.dunning.marks.map((m) => img(m)).join('')]),
    ]),
    block('quote sheet', [
      row([esc(d.quote.source)]),
      row([`<p>${esc(d.quote.text)}</p>`]),
      row([img(d.quote.avatar), esc(d.quote.name), esc(d.quote.role)]),
    ]),
    blockWithHead(`    <h2>${esc(d.problem.h2)}</h2>\n    <p>${esc(d.problem.lede)}</p>`, 'checklist', d.problem.cols.map((c) => row([
      img(c.img),
      `<p>${esc(c.claim)}</p><ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`,
    ]))),
    blockWithHead(`    <h2>${esc(d.steps.h2)}</h2>\n    <p>${esc(d.steps.lede)}</p>`, 'steps', d.steps.items.map((s) => row([
      `<p>${esc(s.meta)}</p><h3>${esc(s.h3)}</h3><p>${esc(s.body)}</p>`,
      img(s.img),
    ]))),
    block('band mist cta split analytics', [
      row([`<p>${esc(d.analytics.eyebrow)}</p>`]),
      row([`<h2>${esc(d.analytics.h2)}</h2><p>${esc(d.analytics.lede)}</p>`]),
      row([`<p>${btn(d.analytics.cta)}</p>`]),
      row([img(d.analytics.img)]),
    ]),
    block('band pull roi', [
      row([`<h2>${esc(d.roi.h2)}</h2><p>${esc(d.roi.lede)}</p>`]),
      row([esc(d.roi.fig)]),
    ]),
    block('quote trio', d.roi.trio.map((m) => row([img(m)]))),
    block('band cta split guarantee', [
      row([img(d.roi.gImg)]),
      row([`<p>${esc(d.roi.gEyebrow)}</p>`]),
      row([`<p>${esc(d.roi.gClaim)}</p>`]),
      row([`<p>${esc(d.roi.gLede)}</p>`]),
      row([`<p>${btn(d.roi.gCta)}</p>`]),
    ]),
    block('band ink cta split trial', [
      row([`<p>${esc(d.trial.chip)}</p>`]),
      row([`<h2>${esc(d.trial.h2)}</h2><p>${esc(d.trial.lede)}</p>`]),
      row([`<p>${btn(d.trial.cta)}</p>`]),
      row([img(d.trial.img)]),
      row(d.trial.coda.map(esc)),
    ]),
    blockWithHead(`    <h2>${esc(d.faq.h2)}</h2>`, 'accordion', [
      ...d.faq.pairs.map((p) => row([esc(p.q), p.a])),
      row([`<p>${esc(d.faq.more.text)} <a href="${escAttr(d.faq.more.href)}">${esc(d.faq.more.linkText)}</a></p>`]),
    ]),
    blockWithHead(`    <h2>${esc(d.calc.h2)}</h2>`, 'calc-row', [
      row([esc(d.calc.cells[0].label), esc(d.calc.cells[0].figure), `<p>${esc(d.calc.cells[0].note)}</p>`]),
      row([esc(d.calc.cells[1].label), esc(d.calc.cells[1].figure)]),
      row([esc(d.calc.cells[2].label), esc(d.calc.cells[2].figure), esc(d.calc.cells[2].per), `<p>${btn(d.calc.cells[2].cta)}</p>`]),
      row([`<p>${esc(d.calc.quote)}</p>`]),
      row([img(d.calc.avatar), esc(d.calc.name), esc(d.calc.role)]),
    ]),
  ];
  fs.writeFileSync(path.join(OUT, 'features', 'recover.html'), page([metadata(meta.title, meta.desc), ...sections]));
  fs.writeFileSync(path.join(QA, 'features-recover.html'), qaPage(sections, [
    '/blocks/band/_patches/features-recover.css',
  ]));
  console.log(`features/recover.html: ${sections.length} sections, ${d.faq.pairs.length} FAQ pairs, ${d.dunning.marks.length} logos`);
}

/* ── stripe ───────────────────────────────────────────────────────────── */
{
  const meta = await load('stripe');
  const d = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const im = (el) => (el ? {
      src: el.getAttribute('src'), alt: el.getAttribute('alt') || '', w: el.getAttribute('width'), h: el.getAttribute('height'),
    } : null);
    const S = (n) => document.querySelector(`[data-section="${n}"]`);
    const mast = S('integration-masthead');
    const tri = S('growth-triptych');
    const cnt = S('customer-count');
    const mos = S('insight-mosaic');
    const tst = S('testimonial');
    const dat = S('data-driven');
    const feats = [S('feature-cancellation-insights'), S('feature-recover')].map((sec) => ({
      chip: t(sec.querySelector('.tag-chip')?.textContent),
      h2: t(sec.querySelector('h2')?.textContent),
      lede: t(sec.querySelector('.section-lede')?.textContent),
      cta: { text: t(sec.querySelector('a.ds-btn-primary')?.textContent), href: sec.querySelector('a.ds-btn-primary')?.getAttribute('href') },
      more: { text: t(sec.querySelector('a.ds-link')?.textContent), href: sec.querySelector('a.ds-link')?.getAttribute('href') },
      quote: t(sec.querySelector('.case-quote blockquote')?.textContent),
      avatar: im(sec.querySelector('.quote-attrib img')),
      cite: t(sec.querySelector('.case-quote cite')?.textContent),
      img: im(sec.querySelector('.case-media img')),
    }));
    const opn = S('open-startups');
    const pub = S('publications');
    const cls = S('closing-cta');
    return {
      mast: {
        bm: im(mast.querySelector('.handshake-bm')),
        stripe: im(mast.querySelector('.handshake-stripe')),
        badge: im(mast.querySelector('.handshake-verified img')),
        kicker: t(mast.querySelector('.masthead-kicker')?.textContent),
        h1: t(mast.querySelector('h1')?.textContent),
        lede: t(mast.querySelector('.masthead-lede')?.textContent),
        cta1: { text: t(mast.querySelector('a.ds-btn-primary')?.textContent), href: mast.querySelector('a.ds-btn-primary')?.getAttribute('href') },
        cta2: { text: t(mast.querySelector('a.ds-btn-secondary')?.textContent), href: mast.querySelector('a.ds-btn-secondary')?.getAttribute('href') },
        note: (() => {
          const p = mast.querySelector('.preview-note');
          const a = p.querySelector('a');
          return { before: t(p.childNodes[0].textContent), linkText: t(a.textContent), href: a.getAttribute('href'), after: t(p.childNodes[2]?.textContent || '') };
        })(),
        exhibit: im(mast.querySelector('.masthead-media img')),
      },
      tri: {
        h2: t(tri.querySelector('h2')?.textContent),
        lede: t(tri.querySelector('.section-lede')?.textContent),
        cols: [...tri.querySelectorAll('.tript-col')].map((c) => ({
          h3: t(c.querySelector('h3')?.textContent),
          p: t(c.querySelector('p')?.textContent),
          go: t(c.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
          href: c.getAttribute('href'),
          img: im(c.querySelector('img')),
        })),
      },
      cnt: {
        figure: t(cnt.querySelector('.counter-figure')?.textContent),
        label: t(cnt.querySelector('.counter-label')?.textContent),
        marks: [...cnt.querySelectorAll('.counter-logos img')].map(im),
      },
      mos: {
        h2: t(mos.querySelector('h2')?.textContent),
        lede: t(mos.querySelector('.section-lede')?.textContent),
        panels: [...mos.querySelectorAll('.panel')].map((c) => ({
          h3: t(c.querySelector('h3')?.textContent),
          p: t(c.querySelector(':scope > p')?.textContent),
          go: c.querySelector('.go') ? t(c.querySelector('.go').textContent).replace(/\s*→\s*$/, '') : null,
          href: c.getAttribute('href'),
          img: im(c.querySelector('img')),
        })),
      },
      quote: {
        source: t(tst.querySelector('.record-sheet > .meta-label')?.textContent),
        text: t(tst.querySelector('blockquote')?.textContent),
        avatar: im(tst.querySelector('.testimonial-attrib img')),
        name: t(tst.querySelector('cite')?.childNodes[0]?.textContent),
        role: t(tst.querySelector('cite span')?.textContent),
        g2: { href: tst.querySelector('.testimonial-g2')?.getAttribute('href'), img: im(tst.querySelector('.testimonial-g2 img')) },
      },
      dat: {
        h2: t(dat.querySelector('h2')?.textContent),
        lede: t(dat.querySelector('.section-lede')?.textContent),
        rows: [...dat.querySelectorAll('.spine-row')].map((r) => ({
          meta: t(r.querySelector('.meta-label')?.textContent),
          h3: t(r.querySelector('h3')?.textContent),
          p: t(r.querySelector('.spine-copy p')?.textContent),
          go: t(r.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
          href: r.getAttribute('href'),
          img: im(r.querySelector('img')),
        })),
      },
      feats,
      opn: {
        eyebrow: t(opn.querySelector('.meta-label')?.textContent),
        h2: t(opn.querySelector('h2')?.textContent),
        lede: t(opn.querySelector('.section-lede')?.textContent),
        cta: { text: t(opn.querySelector('a.open-cta')?.textContent), href: opn.querySelector('a.open-cta')?.getAttribute('href') },
        img: im(opn.querySelector('.open-media img')),
      },
      pub: {
        eyebrow: t(pub.querySelector('.pub-head .meta-label')?.textContent),
        h2: t(pub.querySelector('h2')?.textContent),
        lede: t(pub.querySelector('.section-lede')?.textContent),
        rows: [...pub.querySelectorAll('.pub-row')].map((a) => ({
          date: t(a.querySelector('time')?.textContent),
          title: t(a.querySelector('.pub-title')?.textContent),
          href: a.getAttribute('href'),
        })),
        subLabel: t(pub.querySelector('.pub-subscribe label')?.textContent),
        subPlaceholder: pub.querySelector('.pub-subscribe input')?.placeholder || '',
        subButton: t(pub.querySelector('.pub-subscribe button')?.textContent),
      },
      cls: {
        h2: t(cls.querySelector('h2')?.textContent),
        lede: t(cls.querySelector('.section-lede')?.textContent),
        cta: { text: t(cls.querySelector('a.ds-btn-primary')?.textContent), href: cls.querySelector('a.ds-btn-primary')?.getAttribute('href') },
        badge: im(cls.querySelector('.closing-badge img')),
        img: im(cls.querySelector('.closing-media img')),
      },
    };
  });

  const sections = [
    block('feature-hero integration', [
      row([img(d.mast.bm, false), img(d.mast.stripe, false)]),
      row([img(d.mast.badge, false)]),
      row([`<p>${esc(d.mast.kicker)}</p>`]),
      row([`<h1>${esc(d.mast.h1)}</h1>`]),
      row([`<p>${esc(d.mast.lede)}</p>`]),
      row([`<p>${btn(d.mast.cta1)} ${btn2(d.mast.cta2)}</p>`]),
      row([`<p>${esc(d.mast.note.before)} <a href="${escAttr(d.mast.note.href)}">${esc(d.mast.note.linkText)}</a>${esc(d.mast.note.after)}</p>`]),
      row([img(d.mast.exhibit, false)]),
    ]),
    blockWithHead(`    <h2>${esc(d.tri.h2)}</h2>\n    <p>${esc(d.tri.lede)}</p>`, 'cards triptych padded', d.tri.cols.map((c) => row([
      `<h3>${esc(c.h3)}</h3><p>${esc(c.p)}</p>`,
      `<a href="${escAttr(c.href)}">${esc(c.go)}</a>`,
      img(c.img),
    ]))),
    block('logos counter mist', [
      row([esc(d.cnt.figure), esc(d.cnt.label)]),
      row([d.cnt.marks.map((m) => img(m)).join('')]),
    ]),
    blockWithHead(`    <h2>${esc(d.mos.h2)}</h2>\n    <p>${esc(d.mos.lede)}</p>`, 'cards mosaic padded', d.mos.panels.map((c) => row([
      `<h3>${esc(c.h3)}</h3><p>${esc(c.p)}</p>`,
      ...(c.href ? [`<a href="${escAttr(c.href)}">${esc(c.go)}</a>`] : []),
      img(c.img),
    ]))),
    block('quote sheet mist', [
      row([esc(d.quote.source)]),
      row([`<p>${esc(d.quote.text)}</p>`]),
      row([img(d.quote.avatar), esc(d.quote.name), esc(d.quote.role)]),
      row([`<a href="${escAttr(d.quote.g2.href)}">${img(d.quote.g2.img)}</a>`]),
    ]),
    blockWithHead(`    <h2>${esc(d.dat.h2)}</h2>\n    <p>${esc(d.dat.lede)}</p>`, 'steps entries', d.dat.rows.map((r) => row([
      `<p>${esc(r.meta)}</p><h3>${esc(r.h3)}</h3><p>${esc(r.p)}</p>`,
      `<a href="${escAttr(r.href)}">${esc(r.go)}</a>`,
      img(r.img),
    ]))),
    ...d.feats.map((f, i) => block(i === 0 ? 'feature-hero case mist' : 'feature-hero case mirror', [
      row([`<p>${esc(f.chip)}</p>`]),
      row([`<h2>${esc(f.h2)}</h2><p>${esc(f.lede)}</p>`]),
      row([`<p>${btn(f.cta)} <a href="${escAttr(f.more.href)}">${esc(f.more.text)}</a></p>`]),
      row([`<p>${esc(f.quote)}</p>`]),
      row([img(f.avatar), esc(f.cite)]),
      row([img(f.img)]),
    ])),
    block('band ink cta split innovators', [
      row([`<p>${esc(d.opn.eyebrow)}</p>`]),
      row([`<h2>${esc(d.opn.h2)}</h2><p>${esc(d.opn.lede)}</p>`]),
      row([`<p>${btn(d.opn.cta)}</p>`]),
      row([img(d.opn.img)]),
    ]),
    blockWithHead(`    <p>${esc(d.pub.eyebrow)}</p>\n    <h2>${esc(d.pub.h2)}</h2>\n    <p>${esc(d.pub.lede)}</p>`, 'ledger publications', [
      ...d.pub.rows.map((r) => row([esc(r.date), `<a href="${escAttr(r.href)}">${esc(r.title)}</a>`])),
      row([esc(d.pub.subLabel), esc(d.pub.subPlaceholder), esc(d.pub.subButton)]),
    ]),
    block('band tint cta closing', [
      row([`<h2>${esc(d.cls.h2)}</h2><p>${esc(d.cls.lede)}</p>`]),
      row([`<p>${btn(d.cls.cta)}</p>`]),
      row([img(d.cls.badge)]),
      row([img(d.cls.img)]),
    ]),
  ];
  fs.writeFileSync(path.join(OUT, 'stripe.html'), page([metadata(meta.title, meta.desc), ...sections]));
  fs.writeFileSync(path.join(QA, 'stripe.html'), qaPage(sections, [
    '/blocks/band/_patches/stripe.css',
    '/blocks/cards/_patches/stripe.css',
    '/blocks/steps/_patches/stripe.css',
    '/blocks/logos/_patches/stripe.css',
    '/blocks/ledger/_patches/stripe.css',
  ]));
  console.log(`stripe.html: ${sections.length} sections, ${d.pub.rows.length} publication rows, ${d.cnt.marks.length} counter logos`);
}

await browser.close();
console.log(`done → ${OUT}`);
