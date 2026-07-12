#!/usr/bin/env node
/**
 * stardust/build-content-b2.mjs — Wave B2: generate content/pricing.html and
 * content/compare/profitwell-alternative.html (DA body fragments, David's
 * model) programmatically from the approved prototypes. ALL copy/hrefs/images
 * are extracted from the prototype DOM — never hand-copied (the Wave-A
 * build-content.mjs technique). Run: node stardust/build-content-b2.mjs
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(here, '../../baremetrics/stardust/prototypes');
const OUT = path.resolve(here, '../content');
fs.mkdirSync(path.join(OUT, 'compare'), { recursive: true });

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
const img = (m) => `<img src="${escAttr(m.src)}" alt="${escAttr(m.alt || '')}"${m.w ? ` width="${m.w}"` : ''}${m.h ? ` height="${m.h}"` : ''} loading="lazy">`;

const metadata = (title, desc) => `  <div>
    <div class="metadata">
      <div><div>Title</div><div>${esc(title)}</div></div>
      <div><div>Description</div><div>${esc(desc)}</div></div>
    </div>
  </div>`;

const sectionMeta = (style) => `      <div class="section-metadata"><div><div>style</div><div>${esc(style)}</div></div></div>`;

const page = (sections) => `<body>
<header></header>
<main>
${sections.join('\n')}
</main>
<footer></footer>
</body>
`;

const row = (cells) => `      <div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;
const block = (cls, rows) => `    <div class="${cls}">
${rows.join('\n')}
    </div>`;
const section = (parts) => `  <div>
${parts.join('\n')}
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

/* ── pricing ─────────────────────────────────────────────────────────── */
{
  const meta = await load('pricing');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const own = (el) => t([...(el?.childNodes || [])].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '));
    const imgOf = (el) => (el ? { src: el.getAttribute('src'), alt: el.getAttribute('alt') || '', w: el.getAttribute('width'), h: el.getAttribute('height') } : null);

    const hero = document.querySelector('[data-section="pricing-hero"]');
    const plans = [...document.querySelectorAll('[data-section="rate-card"] .plan')].map((p) => ({
      name: t(p.querySelector('h2')?.textContent),
      badge: t(p.querySelector('.plan-head .meta-label')?.textContent) || null,
      desc: t(p.querySelector('.plan-desc')?.textContent),
      priceLabel: t([...p.querySelectorAll(':scope > .meta-label')][0]?.textContent),
      cur: t(p.querySelector('.price-cur')?.textContent),
      fig: t(p.querySelector('.plan-price .figure')?.textContent),
      per: t(p.querySelector('.price-per')?.textContent),
      cta: { text: t(p.querySelector('.ds-btn-primary')?.textContent), href: p.querySelector('.ds-btn-primary')?.getAttribute('href') },
      arr: { text: t(p.querySelector('.plan-arr')?.textContent), href: p.querySelector('.plan-arr')?.getAttribute('href') },
      integration: t(p.querySelector('.plan-integration')?.textContent),
      includes: t(p.querySelector('.plan-includes')?.textContent),
      features: [...p.querySelectorAll('.plan-features li')].map((li) => t(li.textContent)),
    }));
    const byo = document.querySelector('[data-section="build-your-own"]');
    const trust = document.querySelector('[data-section="trust-at-decision"]');
    const sheet = trust.querySelector('.record-sheet');
    const addons = [...document.querySelectorAll('[data-section="add-ons"] .addon')].map((a) => ({
      href: a.getAttribute('href'),
      h3: t(a.querySelector('h3')?.textContent),
      fig: t(a.querySelector('.addon-price .figure')?.textContent),
      per: t(a.querySelector('.addon-price .price-per')?.textContent),
      bullets: [...a.querySelectorAll('.addon-bullets li')].map((li) => t(li.textContent)),
      go: t(a.querySelector('.go')?.textContent).replace(/\s*→\s*$/, ''),
    }));
    const fin = document.querySelector('[data-section="financial-planning"]');
    return {
      h1: t(hero.querySelector('h1')?.textContent),
      toggle: own(hero.querySelector('.toggle-switch')),
      note: t(hero.querySelector('.annual-note')?.textContent),
      plans,
      or: t(document.querySelector('[data-section="rate-card"] .or-divider .meta-label')?.textContent),
      byo: {
        h2: t(byo.querySelector('h2')?.textContent),
        lede: t(byo.querySelector('.byo-lede')?.textContent),
        cta: { text: t(byo.querySelector('.byo-cta')?.textContent), href: byo.querySelector('.byo-cta')?.getAttribute('href') },
      },
      trust: {
        label: t(trust.querySelector('.trust-label')?.textContent),
        logos: [...trust.querySelectorAll('.counter-logos img')].map(imgOf),
        source: t(sheet.querySelector('.meta-label')?.textContent),
        quote: t(sheet.querySelector('blockquote p')?.textContent),
        avatar: imgOf(sheet.querySelector('.testimonial-attrib img')),
        name: own(sheet.querySelector('cite')),
        role: t(sheet.querySelector('cite span')?.textContent),
        g2Href: sheet.querySelector('.testimonial-g2')?.getAttribute('href'),
        g2Img: imgOf(sheet.querySelector('.testimonial-g2 img')),
        badgeWordmark: t(trust.querySelector('.stripe-wordmark')?.textContent),
        badgeText: t(trust.querySelector('.stripe-badge-text')?.textContent),
      },
      addonsH2: t(document.querySelector('.addons-h2')?.textContent),
      addons,
      fin: {
        h2: t(fin.querySelector('h2')?.textContent),
        lede: t(fin.querySelector('.section-lede')?.textContent),
        cta: { text: t(fin.querySelector('a')?.textContent), href: fin.querySelector('a')?.getAttribute('href') },
      },
    };
  });

  const rateRows = [
    row([esc(data.toggle)]),
    row([esc(data.note)]),
    ...data.plans.map((p) => row([
      `<h2>${esc(p.name)}</h2>${p.badge ? `<p>${esc(p.badge)}</p>` : ''}`,
      `<p>${esc(p.desc)}</p>`,
      `<p>${esc(p.priceLabel)}</p><p>${esc(`${p.cur}${p.fig} ${p.per}`)}</p>`,
      `<p><strong><a href="${escAttr(p.cta.href)}">${esc(p.cta.text)}</a></strong></p><p><a href="${escAttr(p.arr.href)}">${esc(p.arr.text)}</a></p><p>${esc(p.integration)}</p>`,
      `<p>${esc(p.includes)}</p><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join(' ')}</ul>`,
    ])),
    row([esc(data.or)]),
  ];
  const byoRows = [
    row([`<h2>${esc(data.byo.h2)}</h2>`]),
    row([`<p>${esc(data.byo.lede)}</p>`]),
    row([`<p><strong><a href="${escAttr(data.byo.cta.href)}">${esc(data.byo.cta.text)}</a></strong></p>`]),
  ];
  const trustLogosRows = [
    row([esc(data.trust.label)]),
    row(data.trust.logos.map(img)),
  ];
  const quoteRows = [
    row([esc(data.trust.source)]),
    row([`<p>${esc(data.trust.quote)}</p>`]),
    row([img(data.trust.avatar), esc(data.trust.name), esc(data.trust.role)]),
    row([`<a href="${escAttr(data.trust.g2Href)}">${img(data.trust.g2Img)}</a>`]),
  ];
  const addonRows = data.addons.map((a) => row([
    `<h3>${esc(a.h3)}</h3>`,
    esc(`${a.fig}${a.per}`),
    `<ul>${a.bullets.map((b) => `<li>${esc(b)}</li>`).join(' ')}</ul>`,
    `<a href="${escAttr(a.href)}">${esc(a.go)}</a>`,
  ]));
  const finRows = [
    row([`<h2>${esc(data.fin.h2)}</h2>`]),
    row([`<p>${esc(data.fin.lede)}</p>`]),
    row([`<p><em><a href="${escAttr(data.fin.cta.href)}">${esc(data.fin.cta.text)}</a></em></p>`]),
  ];

  fs.writeFileSync(path.join(OUT, 'pricing.html'), page([
    metadata(meta.title, meta.desc),
    section([block('masthead center', [row([`<h1>${esc(data.h1)}</h1>`])])]),
    section([block('rate-card', rateRows)]),
    section([block('band accent cta byo', byoRows)]),
    section([block('logos strip trust', trustLogosRows), sectionMeta('mist')]),
    section([
      block('quote', quoteRows),
      `    <p><strong>${esc(data.trust.badgeWordmark)}</strong> ${esc(data.trust.badgeText)}</p>`,
      sectionMeta('mist, trust-badge'),
    ]),
    section([`    <h2>${esc(data.addonsH2)}</h2>`, block('sheets addons', addonRows)]),
    section([block('band mist cta fin', finRows)]),
  ]));
  console.log(`pricing.html: ${data.plans.length} plans (${data.plans.map((p) => p.features.length).join('+')} features), ${data.trust.logos.length} trust logos, ${data.addons.length} addons`);
}

/* ── compare/profitwell-alternative ──────────────────────────────────── */
{
  const meta = await load('compare-profitwell-alternative');
  const data = await tab.evaluate(() => {
    const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const imgOf = (el) => (el ? { src: el.getAttribute('src'), alt: el.getAttribute('alt') || '', w: el.getAttribute('width'), h: el.getAttribute('height') } : null);

    /* one cmp-table → { caption, label, cols[{img, name, suffix}], rows[{label, data[{kind, text}]}] } */
    const tableOf = (table) => ({
      caption: t(table.querySelector('caption')?.textContent),
      label: t([...(table.querySelector('thead th')?.childNodes || [])].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '))
        || t(table.querySelector('thead th .visually-hidden')?.textContent),
      labelHidden: !!table.querySelector('thead th:first-child .visually-hidden'),
      cols: [...table.querySelectorAll('thead th')].slice(1).map((th) => ({
        img: imgOf(th.querySelector('img')),
        name: t(th.querySelector('.visually-hidden')?.textContent),
        suffix: t(th.querySelector('.col-suffix')?.textContent) || null,
      })),
      rows: [...table.querySelectorAll('tbody tr')].map((tr) => ({
        label: t(tr.querySelector('th')?.textContent),
        data: [...tr.querySelectorAll('td')].map((td) => {
          const cell = td.querySelector('.cell');
          const clone = cell.cloneNode(true);
          clone.querySelectorAll('.visually-hidden, svg').forEach((n) => n.remove());
          const textOnly = t(clone.textContent);
          if (cell.classList.contains('cell-na')) return { kind: 'na', text: textOnly };
          if (cell.querySelector('.gl-yes')) return { kind: 'yes', text: textOnly };
          if (cell.querySelector('.gl-no')) return { kind: 'no', text: textOnly };
          return { kind: 'text', text: textOnly };
        }),
      })),
    });

    const mast = document.querySelector('[data-section="versus-masthead"]');
    const ints = document.querySelector('[data-section="integrations"]');
    const matrix = document.querySelector('[data-section="comparison-matrix"]');
    const gapsSec = document.querySelector('[data-section="capability-gaps"]');
    const gaps = [...gapsSec.querySelectorAll('.gap')].map((g) => {
      const body = g.querySelector('.gap-body').cloneNode(true);
      body.querySelectorAll('.fig-accent').forEach((s) => {
        const strong = document.createElement('strong');
        strong.textContent = s.textContent;
        s.replaceWith(strong);
      });
      return {
        kicker: t(g.querySelector('.gap-kicker')?.textContent),
        claim: t(g.querySelector('.gap-claim')?.textContent),
        bodyHtml: body.innerHTML.replace(/\s+/g, ' ').trim(),
        table: tableOf(g.querySelector('.cmp-table')),
      };
    });
    const honest = document.querySelector('[data-section="being-honest"]');
    const support = document.querySelector('[data-section="support"]');
    const faq = document.querySelector('[data-section="faq"]');
    const close = document.querySelector('[data-section="closing-cta"]');
    return {
      mast: {
        h1: t(mast.querySelector('h1')?.textContent),
        beats: [...mast.querySelectorAll('.beat')].map((b) => t(b.textContent)),
        lede: t(mast.querySelector('.vs-lede')?.textContent),
        ctas: [...mast.querySelectorAll('.cta-row a')].map((a) => ({
          text: t(a.textContent), href: a.getAttribute('href'), primary: a.classList.contains('ds-btn-primary'),
        })),
      },
      intLabel: t(ints.querySelector('.int-label')?.textContent),
      intLogos: [...ints.querySelectorAll('.int-logos img')].map(imgOf),
      matrix: {
        h2: t(matrix.querySelector('h2')?.textContent),
        statement: t(matrix.querySelector('.matrix-statement')?.textContent),
        lede: t(matrix.querySelector('.section-lede')?.textContent),
        table: tableOf(matrix.querySelector('.cmp-table')),
      },
      gapsH2: t(gapsSec.querySelector('.gaps-head h2')?.textContent),
      gaps,
      honest: {
        kicker: t(honest.querySelector('.honest-kicker')?.textContent),
        title: t(honest.querySelector('.honest-title')?.textContent),
        sheets: [...honest.querySelectorAll('.honest-sheet')].map((s) => ({
          img: imgOf(s.querySelector('img')),
          h4: t(s.querySelector('h4')?.textContent),
          pHtml: s.querySelector('p').innerHTML.replace(/\s+/g, ' ').trim(),
        })),
      },
      support: {
        kicker: t(support.querySelector('.support-kicker')?.textContent),
        title: t(support.querySelector('.support-title')?.textContent),
        lede: t(support.querySelector('.section-lede')?.textContent),
        cells: [...support.querySelectorAll('.support-cell')].map((c) => ({
          img: imgOf(c.querySelector('img')),
          fig: t(c.querySelector('.stat-figure')?.textContent),
          note: t(c.querySelector('.stat-note')?.textContent),
        })),
      },
      faq: {
        h2: t(faq.querySelector('h2')?.textContent),
        pairs: [...faq.querySelectorAll('.faq-item')].map((i) => ({
          q: t([...(i.querySelector('.faq-q')?.childNodes || [])].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ')),
          a: [...i.querySelectorAll('.faq-panel p')].map((p) => t(p.textContent)),
        })),
        moreText: t(faq.querySelector('.faq-more')?.childNodes[0]?.textContent),
        moreLink: {
          text: t(faq.querySelector('.faq-more a')?.textContent),
          href: faq.querySelector('.faq-more a')?.getAttribute('href'),
        },
      },
      close: {
        h2: t(close.querySelector('h2')?.textContent),
        lede: t(close.querySelector('.close-lede')?.textContent),
        ctas: [...close.querySelectorAll('.close-actions a')].map((a) => ({
          text: t(a.textContent), href: a.getAttribute('href'), primary: a.classList.contains('ds-btn-primary'),
        })),
        note: t(close.querySelector('.close-note')?.textContent),
      },
    };
  });

  const esc2 = esc;
  const ctaP = (ctas) => `<p>${ctas.map((c) => {
    const a = `<a href="${escAttr(c.href)}">${esc2(c.text)}</a>`;
    return c.primary ? `<strong>${a}</strong>` : `<em>${a}</em>`;
  }).join(' ')}</p>`;

  /* one extracted table → authored compare-table rows */
  const tableRows = (tb) => [
    row([esc(tb.caption)]),
    row([
      tb.labelHidden ? '' : esc(tb.label),
      ...tb.cols.map((c) => `${img(c.img)}<p>${esc(c.name)}</p>${c.suffix ? `<p>${esc(c.suffix)}</p>` : ''}`),
    ]),
    ...tb.rows.map((r) => row([
      esc(r.label),
      ...r.data.map((d) => {
        if (d.kind === 'yes') return `<p>yes</p><p>${esc(d.text)}</p>`;
        if (d.kind === 'no') return `<p>no</p><p>${esc(d.text)}</p>`;
        return `<p>${esc(d.text)}</p>`;
      }),
    ])),
  ];

  const mastRows = [
    row([`<h1>${esc(data.mast.h1)}</h1>`]),
    ...data.mast.beats.map((b) => row([`<p>${esc(b)}</p>`])),
    row([`<p>${esc(data.mast.lede)}</p>`]),
    row([ctaP(data.mast.ctas)]),
  ];
  const intRows = [
    row([esc(data.intLabel)]),
    row(data.intLogos.map(img)),
  ];
  const honestRows = data.honest.sheets.map((s) => row([
    img(s.img),
    `<h4>${esc(s.h4)}</h4><p>${s.pHtml}</p>`,
  ]));
  const supportRows = data.support.cells.map((c) => row([img(c.img), esc(c.fig), esc(c.note)]));
  const faqRows = [
    ...data.faq.pairs.map((p) => row([esc(p.q), p.a.map((a) => `<p>${esc(a)}</p>`).join('')])),
    row([`<p>${esc(data.faq.moreText)} <a href="${escAttr(data.faq.moreLink.href)}">${esc(data.faq.moreLink.text)}</a></p>`]),
  ];
  const closeRows = [
    row([`<h2>${esc(data.close.h2)}</h2>`]),
    row([`<p>${esc(data.close.lede)}</p>`]),
    row([ctaP(data.close.ctas)]),
    row([`<p>${esc(data.close.note)}</p>`]),
  ];

  const gapSection = (g, i) => section([
    ...(i === 0 ? [`    <h2>${esc(data.gapsH2)}</h2>`] : []),
    `    <h3>${esc(g.kicker)}</h3>`,
    `    <p>${esc(g.claim)}</p>`,
    `    <p>${g.bodyHtml}</p>`,
    block('compare-table gap', tableRows(g.table)),
  ]);

  fs.writeFileSync(path.join(OUT, 'compare', 'profitwell-alternative.html'), page([
    metadata(meta.title, meta.desc),
    section([block('masthead versus', mastRows)]),
    section([block('logos strip int', intRows)]),
    section([
      `    <h2>${esc(data.matrix.h2)}</h2>`,
      `    <p>${esc(data.matrix.statement)}</p>`,
      `    <p>${esc(data.matrix.lede)}</p>`,
      block('compare-table', tableRows(data.matrix.table)),
    ]),
    ...data.gaps.map(gapSection),
    section([
      `    <h2>${esc(data.honest.kicker)}</h2>`,
      `    <h3>${esc(data.honest.title)}</h3>`,
      block('sheets honest', honestRows),
      sectionMeta('mist'),
    ]),
    section([
      `    <h2>${esc(data.support.kicker)}</h2>`,
      `    <h3>${esc(data.support.title)}</h3>`,
      `    <p>${esc(data.support.lede)}</p>`,
      block('sheets support', supportRows),
    ]),
    section([
      `    <h2>${esc(data.faq.h2)}</h2>`,
      block('accordion', faqRows),
    ]),
    section([block('band ink cta', closeRows)]),
  ]));
  const nRows = data.matrix.table.rows.length + data.gaps.reduce((n, g) => n + g.table.rows.length, 0);
  console.log(`compare/profitwell-alternative.html: ${data.matrix.table.rows.length}+${data.gaps.map((g) => g.table.rows.length).join('+')} = ${nRows} feature rows, ${data.faq.pairs.length} faq pairs, ${data.honest.sheets.length} honest sheets`);
}

await browser.close();
console.log(`done → ${OUT}`);
