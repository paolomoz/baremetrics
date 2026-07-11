#!/usr/bin/env node
/**
 * stardust/build-content-b4.mjs — Wave-B4 content pages (DA body fragments,
 * David's model), generated programmatically from the approved prototypes:
 *   content/blog/customer-retention-metrics.html   (template: article)
 *   content/founder-chats/natalie-nagele.html      (template: article)
 * plus the local QA harness pages qa/customer-retention-metrics.html and
 * qa/natalie-nagele.html (metadata block → head <meta>, incl. template).
 *
 * ALL copy/hrefs/images/paragraphs are extracted from the prototype DOM —
 * never hand-copied (the transcript's 142 paragraphs are byte-verbatim
 * innerHTML). Run: node stardust/build-content-b4.mjs
 *
 * Prose authoring convention (see templates/article/article.css):
 *   formula sheet → <blockquote><p>Formula</p><p><code>eq</code></p></blockquote>
 *   quote sheet   → <blockquote><p>Source · X</p><p>“…”</p><p><em>Name,</em> role @ <a>Co</a></p></blockquote>
 *   chart figure  → <p><img></p><p>caption</p>  (win chrome via article-head JS)
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

const metadata = (title, desc) => `  <div>
    <div class="metadata">
      <div><div>Title</div><div>${esc(title)}</div></div>
      <div><div>Description</div><div>${esc(desc)}</div></div>
      <div><div>Template</div><div>article</div></div>
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
const block = (cls, rows) => `    <div class="${cls}">
${rows.join('\n')}
    </div>`;
const sectionMeta = (style) => `    <div class="section-metadata">
      <div><div>style</div><div>${style}</div></div>
    </div>`;
const section = (parts) => `  <div>
${parts.join('\n')}
  </div>`;

/* local QA harness page: metadata block lifted into head metas (the DA/EDS
   pipeline does this at publish; blocks named "metadata" never load) */
const qaPage = (title, bodyHtml) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="template" content="article">
<link rel="stylesheet" href="/styles/styles.css">
<link rel="stylesheet" href="/blocks/band/_patches/blog-customer-retention-metrics.css">
<script src="/scripts/ak.js" type="module"></script>
<script src="/scripts/scripts.js" type="module"></script>
<link rel="icon" href="/favicon.png"></head>
${bodyHtml.replace(/ {2}<div>\n {4}<div class="metadata">[\s\S]*?<\/div>\n {2}<\/div>\n/, '')}</html>
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

const writeOut = (rel, html) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
};

/* ── shared extractors (run in page) ─────────────────────────────────── */

/* topbar + byline for either masthead */
const mastheadOf = (sel) => tab.evaluate((s) => {
  const t = (x) => (x || '').replace(/\s+/g, ' ').trim();
  const sec = document.querySelector(s);
  const links = [...sec.querySelectorAll('.article-topbar a')].map((a) => ({
    text: t(a.textContent), href: a.getAttribute('href'),
  }));
  return {
    links,
    kicker: t(sec.querySelector('.kicker')?.textContent) || null,
    h1: t(sec.querySelector('h1')?.textContent),
    byline: t(sec.querySelector('.byline')?.textContent),
    img: sec.querySelector('.exhibit img')?.outerHTML || null,
  };
}, sel);

const tocRailOf = (sel) => tab.evaluate((s) => {
  const t = (x) => (x || '').replace(/\s+/g, ' ').trim();
  const rail = document.querySelector(s);
  return [...rail.querySelectorAll('nav')].map((nav) => ({
    label: t(nav.querySelector('.meta-label')?.textContent),
    links: [...nav.querySelectorAll('ul a')].map((a) => ({
      text: t(a.textContent).replace(/\s*→\s*$/, ''),
      href: a.getAttribute('href'),
      current: a.getAttribute('aria-current') === 'page',
    })),
  }));
}, sel);

const tocBlockRows = (groups) => groups.map((g) => {
  const list = `<ul>${g.links.map((l) => {
    const a = `<a href="${esc(l.href)}">${esc(l.text)}</a>`;
    return `<li>${l.current ? `<strong>${a}</strong>` : a}</li>`;
  }).join('')}</ul>`;
  return row([esc(g.label), list]);
});

const topbarRow = (links) => row(links.map((l) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`));

const newsletterOf = () => tab.evaluate(() => {
  const t = (x) => (x || '').replace(/\s+/g, ' ').trim();
  const nl = document.querySelector('[data-section="newsletter"]');
  return {
    title: t(nl.querySelector('.nl-title')?.textContent),
    label: t(nl.querySelector('label')?.textContent),
    button: t(nl.querySelector('button')?.textContent),
  };
});

const newsletterSection = (nl) => section([block('band tint form', [
  row([`<p>${esc(nl.title)}</p>`]),
  row([esc(nl.label), esc(nl.button)]),
])]);

/* ── blog/customer-retention-metrics ─────────────────────────────────── */
{
  const meta = await load('blog-customer-retention-metrics');
  const mast = await mastheadOf('[data-section="article-masthead"]');

  /* prose: walk article.prose children, mapping each device to the authored
     shape (verbatim innerHTML — never retyped) */
  const prose = await tab.evaluate(() => {
    const t = (x) => (x || '').replace(/\s+/g, ' ').trim();
    const out = [];
    const kids = document.querySelectorAll('[data-section="article"] .prose > *');
    kids.forEach((node) => {
      const cls = node.className || '';
      if (/\bformula\b/.test(cls)) {
        const label = t(node.querySelector('.meta-label')?.textContent);
        const eq = node.querySelector('.eq')?.innerHTML.trim();
        out.push(`<blockquote><p>${label}</p><p><code>${eq}</code></p></blockquote>`);
      } else if (/\bquote-sheet\b/.test(cls)) {
        const label = t(node.querySelector(':scope > .meta-label')?.textContent);
        const quotes = [...node.querySelectorAll('blockquote > p')].map((p) => `<p>${p.innerHTML.trim()}</p>`).join('');
        const cap = node.querySelector('figcaption').cloneNode(true);
        cap.querySelectorAll('strong').forEach((st) => {
          const em = document.createElement('em');
          em.innerHTML = st.innerHTML;
          st.replaceWith(em);
        });
        out.push(`<blockquote><p>${label}</p>${quotes}<p>${cap.innerHTML.trim()}</p></blockquote>`);
      } else if (/\bchart\b/.test(cls)) {
        const img = node.querySelector('img');
        out.push(`<p>${img.outerHTML}</p>`);
        const cap = node.querySelector('figcaption');
        if (cap) out.push(`<p>${cap.innerHTML.trim()}</p>`);
      } else {
        out.push(node.outerHTML.replace(/\s*data-anim(="[^"]*")?/g, ''));
      }
    });
    return out;
  });

  const toc = await tocRailOf('[data-section="article"] .rail');
  const author = await tab.evaluate(() => {
    const t = (x) => (x || '').replace(/\s+/g, ' ').trim();
    const sec = document.querySelector('[data-section="author-band"]');
    return { eyebrow: t(sec.querySelector('.meta-label')?.textContent), name: t(sec.querySelector('h3, h2')?.textContent) };
  });
  const nl = await newsletterOf();

  const headRows = [
    topbarRow(mast.links),
    row([`<h1>${esc(mast.h1)}</h1>`]),
    row([`<p>${esc(mast.byline)}</p>`]),
    row([mast.img]),
  ];

  const body = page([
    metadata(meta.title, meta.desc),
    section([block('article-head article', headRows)]),
    section([
      sectionMeta('article-body'),
      ...prose.map((h) => `    ${h}`),
      block('toc', tocBlockRows(toc)),
    ]),
    section([block('band ink author', [
      row([`<p>${esc(author.eyebrow)}</p>`]),
      row([`<h2>${esc(author.name)}</h2>`]),
    ])]),
    newsletterSection(nl),
  ]);
  writeOut('content/blog/customer-retention-metrics.html', body);
  writeOut('qa/customer-retention-metrics.html', qaPage(meta.title, body));
  const nP = prose.filter((h) => h.startsWith('<p')).length;
  console.log(`blog/customer-retention-metrics: ${prose.length} prose nodes (${nP} <p>), toc groups ${toc.map((g) => g.links.length).join('+')}`);
}

/* ── founder-chats/natalie-nagele ────────────────────────────────────── */
{
  const meta = await load('founder-chats-natalie-nagele');
  const mast = await mastheadOf('[data-section="episode-masthead"]');

  const sheet = await tab.evaluate(() => {
    const t = (x) => (x || '').replace(/\s+/g, ' ').trim();
    const sec = document.querySelector('[data-section="episode-sheet"]');
    return {
      img: sec.querySelector('.ep-art img')?.outerHTML,
      srNote: t(sec.querySelector('.ep-art .visually-hidden')?.textContent),
      label: t(sec.querySelector('.ep-body .meta-label')?.textContent),
      h2: sec.querySelector('.ep-body h2')?.innerHTML.trim(),
      notes: [...sec.querySelectorAll('.ep-note')].map((p) => p.innerHTML.trim()),
      summary: sec.querySelector('.ep-summary')?.innerHTML.trim(),
    };
  });

  /* THE transcript: every dialogue paragraph, byte-verbatim, in capture order */
  const transcript = await tab.evaluate(() => {
    const turns = [...document.querySelectorAll('[data-section="transcript"] .turn')];
    const paras = [];
    turns.forEach((turn) => {
      [...turn.querySelectorAll('p')].forEach((p) => paras.push(p.innerHTML.trim()));
    });
    return { paras, turnCount: turns.length };
  });

  const toc = await tocRailOf('[data-section="transcript"] .rail');
  const author = await tab.evaluate(() => {
    const t = (x) => (x || '').replace(/\s+/g, ' ').trim();
    const sec = document.querySelector('[data-section="author-band"]');
    return {
      img: sec.querySelector('.author img')?.outerHTML,
      eyebrow: t(sec.querySelector('.meta-label')?.textContent),
      name: t(sec.querySelector('h2, h3')?.textContent),
      bio: sec.querySelector('.author-bio')?.innerHTML.trim(),
    };
  });
  const nl = await newsletterOf();

  const headRows = [
    topbarRow(mast.links),
    row([`<p>${esc(mast.kicker)}</p>`]),
    row([`<h1>${esc(mast.h1)}</h1>`]),
    row([`<p>${esc(mast.byline)}</p>`]),
    row([sheet.img, `<p>${esc(sheet.srNote)}</p>`]),
    row([`<p>${esc(sheet.label)}</p>`]),
    row([`<h2>${sheet.h2}</h2>`]),
    ...sheet.notes.map((n) => row([`<p>${n}</p>`])),
    row([`<p>${sheet.summary}</p>`]),
  ];

  const body = page([
    metadata(meta.title, meta.desc),
    section([block('article-head episode', headRows)]),
    section([
      sectionMeta('article-body, episode'),
      block('transcript', transcript.paras.map((p) => row([`<p>${p}</p>`]))),
      block('toc', tocBlockRows(toc)),
    ]),
    section([block('band ink author', [
      row([author.img]),
      row([`<p>${esc(author.eyebrow)}</p>`]),
      row([`<h2>${esc(author.name)}</h2>`]),
      row([`<p>${author.bio}</p>`]),
    ])]),
    newsletterSection(nl),
  ]);
  writeOut('content/founder-chats/natalie-nagele.html', body);
  writeOut('qa/natalie-nagele.html', qaPage(meta.title, body));
  console.log(`founder-chats/natalie-nagele: ${transcript.paras.length} transcript paragraphs (${transcript.turnCount} captured turns), toc groups ${toc.map((g) => g.links.length).join('+')}`);
}

await browser.close();
console.log('done');
