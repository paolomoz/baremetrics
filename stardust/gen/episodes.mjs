#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * stardust/gen/episodes.mjs — Founder-Chats podcast episode content pages
 * (Path A′: reuse the approved blocks, no new blocks). Mirrors the APPROVED
 * archetype content/founder-chats/natalie-nagele.html and its generator
 * stardust/build-content-b4.mjs, but reads DETERMINISTICALLY from the page
 * captures at ../baremetrics/stardust/current/pages/founder-chats-*.json —
 * no browser, no prototype DOM. Content is VERBATIM from the JSON.
 *
 * Structure per page (David's model body fragment — no doctype/head/style/js):
 *   metadata (Template: article; Title ≤60; Description = json.description)
 *   article-head episode  — topbar (← <back> + Subscribe for Updates) + kicker
 *       meta-label (episode title) + h1 (guest / episode h1) + byline (body[1])
 *       + episode sheet (art + inert play glyph + sr-note + brought-to-you-by
 *       note + iTunes note + summary)
 *   section [style: article-body, episode]
 *       transcript  — body[] dialogue slice as speaker turns (captured "Name:"
 *                     prefixes preserved verbatim in <strong>; unprefixed
 *                     paragraphs attach to the preceding speaker). Omitted when
 *                     the capture has no transcript body (audio-only episodes).
 *       toc         — "Table of Contents" (→ #more-articles) + "More Articles"
 *                     rail with the captured related-episode links
 *   band ink author   — host avatar + "Written by" + name + bio (from capture)
 *   band tint form    — subscribe row (site chrome, mirrors archetype)
 *
 * Run: node stardust/gen/episodes.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const PAGES = path.resolve(here, '../../../baremetrics/stardust/current/pages');

const SR_NOTE = 'Listen: player active at launch';
const NL_TITLE = 'Subscribe for Updates';
const NL_LABEL = 'Email address';

/* escape text for HTML text nodes / attribute values (byte-verbatim otherwise) */
const esc = (s) => (s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');
const norm = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/* ── serialisers (identical shapes to build-content-b4.mjs) ──────────────── */
const row = (cells) => `      <div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;
const block = (cls, rows) => `    <div class="${cls}">\n${rows.join('\n')}\n    </div>`;
const sectionMeta = (style) => `    <div class="section-metadata">
      <div><div>style</div><div>${style}</div></div>
    </div>`;
const section = (parts) => `  <div>\n${parts.join('\n')}\n  </div>`;
const page = (sections) => `<body>
<header></header>
<main>
${sections.join('\n')}
</main>
<footer></footer>
</body>
`;
const metadata = (title, desc) => `  <div>
    <div class="metadata">
      <div><div>Title</div><div>${esc(title)}</div></div>
      <div><div>Description</div><div>${esc(desc)}</div></div>
      <div><div>Template</div><div>article</div></div>
    </div>
  </div>`;

/* ── field extractors ────────────────────────────────────────────────────── */

/* SEO title ≤60: json.title, else og.title, truncated on a word boundary */
function seoTitle(d) {
  const t = d.title || d.og?.title || '';
  const alt = d.og?.title || '';
  if (t.length <= 60) return t;
  if (alt && alt.length <= 60) return alt;
  const cut = t.slice(0, 60);
  const sp = cut.lastIndexOf(' ');
  return (sp > 30 ? cut.slice(0, sp) : cut).trim();
}

/* topbar links: back-to-founder-chats + subscribe (from ctas, with defaults) */
function topbar(d, backText) {
  const ctas = d.ctas || [];
  const abs = (h) => (h && h.startsWith('/') ? `https://baremetrics.com${h}` : h);
  const findHref = (re, dflt) => {
    const c = ctas.find((x) => re.test(x.href || ''));
    return abs(c ? c.href : dflt);
  };
  const back = findHref(/\/founder-chats\/?$/, 'https://baremetrics.com/founder-chats');
  const sub = findHref(/subscribe/i, 'https://baremetrics.com/subscribe');
  return row([
    `<a href="${attr(back)}">← ${esc(backText)}</a>`,
    `<a href="${attr(sub)}">${esc(NL_TITLE)}</a>`,
  ]);
}

const iTunesHref = (d) => (d.ctas || []).find((c) => /itunes\.apple/i.test(c.href || ''))?.href || null;

/* episode art = the og:image (found in media for w/h/alt); none → no art */
function episodeArt(d) {
  const og = d.og?.image || null;
  const imgs = d.media?.imgs || [];
  const im = og ? imgs.find((x) => x.src === og) : null;
  if (!im) return null;
  return `<img src="${attr(im.src)}" alt="${attr(im.alt || '')}" width="${im.w}" height="${im.h}" fetchpriority="high" decoding="async">`;
}

/* author headshot = a non-chrome raster distinct from the episode art (last) */
function authorImg(d) {
  const og = d.og?.image || null;
  const imgs = (d.media?.imgs || []).filter((x) => {
    const s = (x.src || '').toLowerCase();
    return s && !s.endsWith('.svg') && !s.includes('logo') && !s.includes('stripe-verified') && x.src !== og;
  });
  const im = imgs[imgs.length - 1];
  if (!im) return null;
  return `<img src="${attr(im.src)}" alt="${attr(im.alt || '')}" width="${im.w}" height="${im.h}" loading="lazy" decoding="async">`;
}

/* related-episode links (deduped, excluding self) — for the More Articles rail */
function relatedLinks(d, slug) {
  const self = slug.replace(/^founder-chats-/, '');
  const out = [];
  const seen = new Set();
  (d.ctas || []).forEach((c) => {
    const m = /^https?:\/\/baremetrics\.com\/founder-chats\/([\w-]+)\/?$/.exec(c.href || '');
    if (!m || m[1] === self || seen.has(c.href)) return;
    seen.add(c.href);
    out.push({ text: (c.label || '').trim() || m[1], href: c.href });
  });
  return out;
}

/* speaker prefix ("First Last:" / "Amir S.:") — up to 4 capitalised tokens */
const PREFIX = /^([A-Z][\w.'’-]*(?:\s+[A-Z][\w.'’-]*){0,3})\s*:\s/;
const prefixOf = (s) => (PREFIX.exec(s || '') || [])[1] || null;

const CHROME = /^(more[\w ]*articles:?|show notes:?|table of contents:?|episode transcript:?)$/i;
const CUE = /^(this week|this episode|in this episode|we sit down|we talk|we chat|today|join us|on this|this time)/i;

/* one transcript paragraph → cell HTML, wrapping a recurring speaker prefix */
function turnCell(s, recurring) {
  const name = prefixOf(s);
  if (name && recurring.has(name)) {
    const idx = s.indexOf(':');
    return `<p><strong>${esc(s.slice(0, idx + 1))}</strong>${esc(s.slice(idx + 1))}</p>`;
  }
  return `<p>${esc(s)}</p>`;
}

/* ── per-episode build ─────────────────────────────────────────────────────── */
function build(d) {
  const slug = d.slug;
  const name = slug.replace(/^founder-chats-/, '');
  const body = d.body || [];
  const headings = d.headings || [];
  const descNorm = norm(d.description || '');

  const backText = body[0] || 'Customers';
  const bylineIdx = body.findIndex((x) => /^By .+ on /.test(x));
  const noteIdx = body.findIndex((x) => x.startsWith('Founder Chats is brought to you by'));
  const authorIdx = body.length - 1;

  const h1 = headings[0]?.text || d.title || name;
  const title = d.title || d.og?.title || h1;

  /* byline: reinsert the "·" separator the prototype rendered before "Last updated" */
  const byline = bylineIdx >= 0
    ? norm(body[bylineIdx]).replace(/\s+Last updated on/, ' · Last updated on')
    : '';

  /* episode-sheet notes: split the single captured note into brought-to-you-by
     + the iTunes call-to-action (identical across all 82 captures) */
  const notes = [];
  if (noteIdx >= 0) {
    const noteRaw = body[noteIdx];
    const cut = noteRaw.indexOf('Like this episode');
    if (cut >= 0) {
      notes.push(esc(noteRaw.slice(0, cut).trim()));
      const tail = noteRaw.slice(cut).trim();
      const itu = iTunesHref(d);
      const anchor = 'rating and a review on iTunes';
      if (itu && tail.includes(anchor)) {
        const [pre, post] = tail.split(anchor);
        notes.push(`${esc(pre)}<a href="${attr(itu)}">${esc(anchor)}</a>${esc(post)}`);
      } else {
        notes.push(esc(tail));
      }
    } else {
      notes.push(esc(noteRaw.trim()));
    }
  }

  /* transcript region + speaker set + the pre-dialogue summary */
  const region = body.slice((noteIdx >= 0 ? noteIdx : bylineIdx) + 1, authorIdx);
  const counts = {};
  region.forEach((x) => { const p = prefixOf(x); if (p) counts[p] = (counts[p] || 0) + 1; });
  const recurring = new Set(Object.keys(counts).filter((k) => counts[k] >= 2));

  const firstTurn = region.findIndex((x) => recurring.has(prefixOf(x)));
  const preDialogue = firstTurn < 0 ? region.length : firstTurn;
  let summaryIdx = -1;
  for (let i = 0; i < preDialogue; i += 1) {
    if (CUE.test(norm(region[i])) || norm(region[i]) === descNorm) { summaryIdx = i; break; }
  }
  const summary = summaryIdx >= 0 ? region[summaryIdx].trim() : (d.description || '').trim();

  /* transcript paragraphs: region minus the chosen summary minus chrome labels */
  const transcript = region.filter((x, i) => i !== summaryIdx && !CHROME.test(norm(x)));

  /* ── article-head episode rows ───────────────────────────────────────────── */
  const headRows = [topbar(d, backText)];
  headRows.push(row([`<p>${esc(title)}</p>`])); // kicker
  headRows.push(row([`<h1>${esc(h1)}</h1>`]));
  if (byline) headRows.push(row([`<p>${esc(byline)}</p>`]));
  const art = episodeArt(d);
  if (art) headRows.push(row([art, `<p>${esc(SR_NOTE)}</p>`]));
  headRows.push(row([`<p>Founder Chats</p>`])); // sheet meta-label
  headRows.push(row([`<h2>${esc(title)}</h2>`])); // sheet subtitle
  notes.forEach((n) => headRows.push(row([`<p>${n}</p>`])));
  if (summary) headRows.push(row([`<p>${esc(summary)}</p>`])); // LAST paragraph = ep-summary

  /* ── toc rows: Table of Contents (→#more-articles) + More Articles rail ──── */
  const related = relatedLinks(d, slug);
  const moreLabel = (headings[2] && /article/i.test(headings[2].text)) ? headings[2].text : 'More Articles';
  const tocRows = [
    row(['Table of Contents', `<ul><li><a href="#more-articles">${esc(moreLabel)}</a></li></ul>`]),
  ];
  if (related.length) {
    const list = `<ul>${related.map((l) => `<li><a href="${attr(l.href)}">${esc(l.text)}</a></li>`).join('')}</ul>`;
    tocRows.push(row([esc(moreLabel), list]));
  }

  /* ── author band ─────────────────────────────────────────────────────────── */
  const authorName = headings[headings.length - 1]?.text || '';
  const authorBio = authorIdx > 0 ? (body[authorIdx] || '').trim() : '';
  const aImg = authorImg(d);
  const authorRows = [];
  if (aImg) authorRows.push(row([aImg]));
  authorRows.push(row([`<p>Written by</p>`]));
  if (authorName) authorRows.push(row([`<h2>${esc(authorName)}</h2>`]));
  if (authorBio) authorRows.push(row([`<p>${esc(authorBio)}</p>`]));

  /* ── assemble ────────────────────────────────────────────────────────────── */
  const bodySection = [sectionMeta('article-body, episode')];
  if (transcript.length) {
    bodySection.push(block('transcript', transcript.map((p) => row([turnCell(p, recurring)]))));
  }
  bodySection.push(block('toc', tocRows));

  const sections = [
    metadata(seoTitle(d), d.description || ''),
    section([block('article-head episode', headRows)]),
    section(bodySection),
    section([block('band ink author', authorRows)]),
    section([block('band tint form', [
      row([`<p>${esc(NL_TITLE)}</p>`]),
      row([esc(NL_LABEL), esc(NL_TITLE)]),
    ])]),
  ];

  return {
    name,
    html: page(sections),
    stats: {
      transcript: transcript.length,
      turns: transcript.filter((x) => recurring.has(prefixOf(x))).length,
      related: related.length,
      art: !!art,
      authorImg: !!aImg,
      summaryFromBody: summaryIdx >= 0,
    },
  };
}

export { build };

/* ── CLI entry (English bulk generation — unchanged output) ────────────────── */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const files = fs.readdirSync(PAGES)
    .filter((f) => /^founder-chats-.*\.json$/.test(f) && f !== 'founder-chats-natalie-nagele.json')
    .sort();

  const outDir = path.join(ROOT, 'content/founder-chats');
  fs.mkdirSync(outDir, { recursive: true });

  const report = [];
  files.forEach((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(PAGES, f), 'utf8'));
    const { name, html, stats } = build(d);
    fs.writeFileSync(path.join(outDir, `${name}.html`), html);
    report.push({ name, ...stats });
  });

  console.log(`generated ${report.length} founder-chats pages → content/founder-chats/`);
  const noTx = report.filter((r) => r.transcript === 0).map((r) => r.name);
  const noArt = report.filter((r) => !r.art).map((r) => r.name);
  const noAuthorImg = report.filter((r) => !r.authorImg).map((r) => r.name);
  console.log(`  no-transcript (audio-only): ${noTx.length ? noTx.join(', ') : 'none'}`);
  console.log(`  no episode art: ${noArt.length ? noArt.join(', ') : 'none'}`);
  console.log(`  no author image: ${noAuthorImg.length ? noAuthorImg.join(', ') : 'none'}`);
}
