#!/usr/bin/env node
/**
 * stardust/gen/articles.mjs — Path A′ bulk article generator (Wave B4 archetype).
 *
 * Reads every blog-*.json / academy-*.json capture at
 *   ../baremetrics/stardust/current/pages/
 * (EXCEPT blog-customer-retention-metrics, already hand-approved) and writes a
 * David's-model body fragment to
 *   content/blog/<slug>.html   or   content/academy/<slug>.html
 * (slug = capture name minus the "blog-"/"academy-" prefix), mirroring the
 * approved archetype content/blog/customer-retention-metrics.html.
 *
 * Body source = the capture's `orderedContent[]` (document reading order:
 * {t:'h1'|'h2'|…|'p'|'ul'|'ol'|'quote'|'img', x, href?, items?, src?, alt?}).
 * ~2 captures lack orderedContent → flat body[] fallback (logged).
 *
 * Mirrors the archetype exactly (no new blocks):
 *   - metadata block (Template: article; Title ≤60 from title/og.title;
 *     Description from description/og.description)
 *   - article-head `article`: topbar (back-link + Subscribe) + ONE h1
 *     (orderedContent's first h1) + byline meta-label (when present) + lead
 *     exhibit hero image (when captured)
 *   - article body as default content: headings NORMALIZED to h2/h3/… with no
 *     level jumps (first heading always h2), paragraphs (inline link
 *     reconstructed from ctas label ↔ href), lists, blockquotes, prose images
 *   - toc block: sticky rail "Table of Contents" (anchors → the article's own
 *     section headings, verbatim). See NOTE below re: "More Articles".
 *   - band ink author (from the byline author, blog only) + band tint form
 *     newsletter (inert chrome) — mirrors the archetype tail.
 *
 * NOTE — "More Articles" rail omitted (deliberate, logged deviation):
 * orderedContent captures only the "More … Articles" h3 HEADERS (TOC chrome we
 * skip), never their link lists; the related-article links survive only
 * flattened into `ctas`, intermixed with body inline links with no reliable
 * boundary across the 639 heterogeneous pages (verified: every structural
 * discriminator misfires on some pages). Reconstructing them risks injecting
 * wrong/nav/category links — a "invent nothing" violation. Per the task's
 * explicit "if none captured, omit gracefully" clause, the More-Articles nav
 * is omitted; the reliably-captured Table-of-Contents anchor nav preserves the
 * archetype's sticky two-column rail + mobile disclosure.
 *
 * Run: node stardust/gen/articles.mjs
 */
/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.resolve(here, '../../../baremetrics/stardust/current/pages');
const ROOT = path.resolve(here, '../..');
const DONE = 'blog-customer-retention-metrics';

const SUBSCRIBE = { text: 'Subscribe for Updates', href: 'https://baremetrics.com/subscribe' };
const NL = { title: 'Subscribe for Updates', label: 'Email address', button: 'Subscribe for Updates' };

/* ── tiny html/text helpers ──────────────────────────────────────────── */
/* redact Stripe key literals in captured prose (a blog post quotes Stripe's
   public test key as a curl example — harmless, but GitHub push protection
   blocks it, and it must never carry a real sk_live_). Durable so regen can't
   reintroduce it. */
const redactSecret = (s) => (s || '').replace(/sk_(test|live)_[A-Za-z0-9]{8,}/g, 'sk_$1_EXAMPLE_KEY');
/* expiring Google-Docs/Drive image URLs the delivery pipeline can't fetch →
   render as about:error and fail the verify gate. Drop them (the capture pulls
   them back on regen, so this must live in the generator). */
const isExpiringImg = (s) => /googleusercontent\.com|lh\d+[.-]google|web\.archive\.org/i.test(s || '');
const esc = (s) => redactSecret(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ws = (s) => (s || '').replace(/\s+/g, ' ').trim();

/* Heading-id slug that reproduces the helix delivery pipeline EXACTLY, so TOC
   anchor hrefs match the ids the pipeline generates (the old ascii-only slug
   mismatched: it collapsed punctuation to single "-" where helix keeps double,
   and it stripped ALL CJK — turning every Japanese heading into "section").
   Algorithm (validated 166/166 against live served ids): github-slugger
   (lowercase; remove everything that is not a letter/number/mark/space/hyphen —
   keeps CJK; each space → "-", no collapse) + strip a leading all-digit segment
   (helix drops ordinal list prefixes: "1-boats…" → "boats…", but "1価格…" with
   no hyphen stays), then per-page occurrence de-dup (foo, foo-1, foo-2 …). */
const baseSlug = (s) => ws(s).toLowerCase()
  .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
  .replace(/ /g, '-')
  .replace(/^\d+-/, '') || 'section';

/* github-slugger occurrence de-dup, one instance per page (document order) */
function makeSlugger() {
  const occ = new Map();
  return (text) => {
    const base = baseSlug(text);
    let result = base;
    while (occ.has(result)) {
      occ.set(base, (occ.get(base) || 0) + 1);
      result = `${base}-${occ.get(base)}`;
    }
    occ.set(result, 0);
    return result;
  };
}

/* SEO title ≤60, truncated at a word boundary (no ellipsis) */
function seoTitle(raw) {
  const t = ws(raw);
  if (t.length <= 60) return { title: t, truncated: false };
  let cut = t.slice(0, 60);
  const sp = cut.lastIndexOf(' ');
  if (sp > 30) cut = cut.slice(0, sp);
  return { title: cut.replace(/[\s:–-]+$/, ''), truncated: true };
}

/* baremetrics-relative, fragment-stripped href for cta↔body matching */
/* unwrap Wayback-archived hrefs (captured body links pointing at
   web.archive.org/web/<ts>[im_]/<original>) back to the original URL — the
   archive wrappers are broken links (they redirect through archive.org or 404). */
const unwrapArchive = (h) => (h || '').replace(/^https?:\/\/web\.archive\.org\/web\/\d+(?:im_)?\//i, '');
const normHref = (h) => unwrapArchive(h || '')
  .replace(/^https?:\/\/(www\.)?baremetrics\.com/i, '')
  .replace(/#.*$/, '')
  .replace(/\/+$/, '');

/* ── David's-model row/block/section builders (verbatim archetype shape) ─ */
const row = (cells) => `      <div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;
const block = (cls, rows) => `    <div class="${cls}">\n${rows.join('\n')}\n    </div>`;
const sectionMeta = (style) => `    <div class="section-metadata">
      <div><div>style</div><div>${style}</div></div>
    </div>`;
const section = (parts) => `  <div>\n${parts.filter(Boolean).join('\n')}\n  </div>`;
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

const topbarRow = (links) => row(links.map((l) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`));
const imgTag = (src, alt, hero) => `<img src="${esc(src)}" alt="${esc(alt || '')}"${hero ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"'}>`;

/* ── inline-link reconstruction ──────────────────────────────────────────
   orderedContent gives a paragraph's full text + ONE representative href but
   not the anchor substring; ctas carry {label, href} where label IS the
   anchor text. Find the cta label (for this href) that is a substring of the
   paragraph and wrap just that run in an <a>. */
function paragraphHtml(item, ctaMap) {
  const txt = item.x || '';
  if (!item.href) return `<p>${esc(txt)}</p>`;
  const key = normHref(item.href);
  const labels = ctaMap.get(key) || [];
  const hit = labels
    .filter((l) => l && txt.includes(l))
    .sort((a, b) => b.length - a.length)[0];
  if (!hit) return `<p>${esc(txt)}</p>`;
  const i = txt.indexOf(hit);
  return `<p>${esc(txt.slice(0, i))}<a href="${esc(unwrapArchive(item.href))}">${esc(hit)}</a>${esc(txt.slice(i + hit.length))}</p>`;
}

function listHtml(item, tag) {
  const lis = (item.items || []).map((li) => `<li>${esc(li)}</li>`).join('');
  return `<${tag}>${lis}</${tag}>`;
}

/* ── orderedContent → head parts + ordered body items ────────────────────
   Head chrome consumed (in order): a pre-h1 link paragraph (back-link), the
   first h1 (title), a "By …" byline paragraph, a category/tag paragraph, the
   "Table of Contents" heading + its list, "More … Articles" headings (+ any
   trailing list), and the first (lead) image. Everything after is body. */
const isTocH = (x) => /^\s*table of contents\s*$/i.test(x || '');
const isMoreH = (x) => /^\s*more\b.*\barticles?\s*$/i.test(x || '');

function parseOrdered(oc) {
  const out = { backlink: null, title: null, byline: null, hero: null, body: [] };
  let bodyStarted = false;
  for (let i = 0; i < oc.length; i += 1) {
    const it = oc[i];
    if (!out.title) {
      if (it.t === 'h1') { out.title = it; continue; }
      if (it.t === 'p' && it.href && !out.backlink) { out.backlink = it; continue; }
      continue; // stray pre-title chrome
    }
    if (!bodyStarted) {
      if (it.t === 'p' && !out.byline && /^by\s+\S/i.test((it.x || '').trim())) { out.byline = it; continue; }
      if (it.t === 'p' && it.href && /\/tag\//.test(it.href)) continue;
      if (it.t === 'p' && out.backlink && ws(it.x) === ws(out.backlink.x)) continue;
      if (/^h[1-6]$/.test(it.t) && isTocH(it.x)) { if (oc[i + 1] && oc[i + 1].t === 'ul') i += 1; continue; }
      if (/^h[1-6]$/.test(it.t) && isMoreH(it.x)) { if (oc[i + 1] && oc[i + 1].t === 'ul') i += 1; continue; }
      if (it.t === 'img' && !out.hero && !isExpiringImg(it.src)) { out.hero = it; continue; }
      bodyStarted = true;
      out.body.push(it);
      continue;
    }
    if (/^h[1-6]$/.test(it.t) && (isTocH(it.x) || isMoreH(it.x))) { if (oc[i + 1] && oc[i + 1].t === 'ul') i += 1; continue; }
    out.body.push(it);
  }
  return out;
}

/* normalise body heading levels: first heading → h2, deeper only +1 (no
   downward skips), shallower tracks the original delta but never below 2.
   Returns { html, toc } where toc = the top-level (min original level)
   section headings with resolvable ids. */
function renderBody(bodyItems, ctaMap, titleText) {
  const headings = bodyItems.filter((it) => /^h[1-6]$/.test(it.t));
  const minOrig = headings.length
    ? Math.min(...headings.map((h) => Number(h.t.slice(1))))
    : 2;
  /* seed the slugger with the article's h1 title — the pipeline ids it first
     (document order), so a body heading repeating the title text collides to
     "…-1". Matching that keeps the TOC href correct. */
  const nextId = makeSlugger();
  if (ws(titleText)) nextId(titleText);
  const html = [];
  const toc = [];
  let prevOrig = 1;
  let prevAssigned = 1;
  bodyItems.forEach((it) => {
    if (/^h[1-6]$/.test(it.t)) {
      const L = Number(it.t.slice(1));
      let assigned;
      if (prevAssigned === 1) assigned = 2;
      else if (L > prevOrig) assigned = Math.min(prevAssigned + 1, 6);
      else if (L === prevOrig) assigned = prevAssigned;
      else assigned = Math.max(2, prevAssigned - (prevOrig - L));
      prevOrig = L;
      prevAssigned = assigned;
      const id = nextId(it.x);
      html.push(`    <h${assigned} id="${id}">${esc(ws(it.x))}</h${assigned}>`);
      if (L === minOrig && ws(it.x)) toc.push({ text: ws(it.x), id });
      return;
    }
    if (it.t === 'p') { html.push(`    ${paragraphHtml(it, ctaMap)}`); return; }
    if (it.t === 'ul') { html.push(`    ${listHtml(it, 'ul')}`); return; }
    if (it.t === 'ol') { html.push(`    ${listHtml(it, 'ol')}`); return; }
    if (it.t === 'quote') { html.push(`    <blockquote><p>${esc(ws(it.x))}</p></blockquote>`); return; }
    if (it.t === 'img') { if (!isExpiringImg(it.src)) html.push(`    <p>${imgTag(it.src, it.alt, false)}</p>`); return; }
  });
  return { html, toc };
}

/* ── page assembly ───────────────────────────────────────────────────── */
function buildPage({
  section: sect, meta, backlink, titleText, byline, hero, bodyHtml, toc, authorName,
}) {
  const sections = [metadata(meta.title, meta.desc)];

  const headRows = [topbarRow([{ text: `← ${backlink.text}`, href: backlink.href }, SUBSCRIBE])];
  headRows.push(row([`<h1>${esc(titleText)}</h1>`]));
  if (byline) headRows.push(row([`<p>${esc(byline)}</p>`]));
  if (hero) headRows.push(row([imgTag(hero.src, hero.alt, true)]));
  sections.push(section([block('article-head article', headRows)]));

  const bodyParts = [sectionMeta('article-body'), ...bodyHtml];
  if (toc.length) {
    const list = `<ul>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ul>`;
    bodyParts.push(block('toc', [row(['Table of Contents', list])]));
  }
  sections.push(section(bodyParts));

  if (authorName) {
    sections.push(section([block('band ink author', [
      row(['<p>Written by</p>']),
      row([`<h2>${esc(authorName)}</h2>`]),
    ])]));
  }
  sections.push(section([block('band tint form', [
    row([`<p>${esc(NL.title)}</p>`]),
    row([esc(NL.label), esc(NL.button)]),
  ])]));

  return page(sections);
}

/* ── per-capture build (exported for reuse by the localized router) ─────── */
export function buildArticle(j, { section = 'blog', defaultBacklink, titleFallback } = {}) {
  const dbl = defaultBacklink || (section === 'academy'
    ? { text: 'Academy', href: 'https://baremetrics.com/academy' }
    : { text: 'Blog', href: 'https://baremetrics.com/blog' });

  const { title: metaTitle, truncated } = seoTitle(j.title || j.og?.title || titleFallback || 'article');
  const meta = { title: metaTitle, desc: ws(j.description || j.og?.description || '') };

  /* cta label ↔ href map for inline-link reconstruction */
  const ctaMap = new Map();
  (j.ctas || []).forEach((c) => {
    if (!c || !c.href || !c.label) return;
    const k = normHref(c.href);
    if (!ctaMap.has(k)) ctaMap.set(k, []);
    ctaMap.get(k).push(c.label);
  });

  let titleText; let byline = null; let hero = null; let backlink = dbl;
  let bodyHtml = []; let toc = []; let authorName = null;
  const info = {
    ordered: false, fallback: false, truncated, noBacklink: false, noByline: false, noToc: false,
  };

  if (Array.isArray(j.orderedContent) && j.orderedContent.length) {
    info.ordered = true;
    const p = parseOrdered(j.orderedContent);
    titleText = ws(p.title?.x) || meta.title;
    if (p.backlink && p.backlink.href) backlink = { text: ws(p.backlink.x) || dbl.text, href: p.backlink.href };
    else info.noBacklink = true;
    if (p.byline) { byline = ws(p.byline.x); } else info.noByline = true;
    if (p.hero) hero = { src: p.hero.src, alt: p.hero.alt };
    const rb = renderBody(p.body, ctaMap, titleText);
    bodyHtml = rb.html;
    toc = rb.toc;
    if (byline) { const m = byline.match(/^by\s+(.+?)\s+on\b/i); if (m) authorName = m[1].trim(); }
  } else {
    /* flat body[] fallback — no reliable heading/image/link structure:
       render title as h1, detect byline, drop the leading TOC-list mirror
       (strings equal to a captured heading), emit the rest as prose <p>. */
    info.fallback = true;
    const headingText = new Set((j.headings || []).map((h) => ws(h.text)));
    const h1 = (j.headings || []).find((h) => h.tag === 'h1');
    titleText = ws(h1?.text) || meta.title;
    const strings = (j.body || []).map((s) => ws(s)).filter(Boolean);
    let idx = 0;
    if (strings[0] && strings[0].length < 40 && !/[.?!]$/.test(strings[0])) { backlink = dbl; idx = 1; }
    if (strings[idx] && /^by\s+\S/i.test(strings[idx])) {
      byline = strings[idx]; idx += 1;
      const m = byline.match(/^by\s+(.+?)\s+on\b/i); if (m) authorName = m[1].trim();
    }
    if (j.og?.image && !isExpiringImg(j.og.image)) hero = { src: j.og.image, alt: '' };
    bodyHtml = strings.slice(idx)
      .filter((s) => !headingText.has(s))
      .map((s) => `    <p>${esc(s)}</p>`);
  }

  if (!toc.length) info.noToc = true;

  const html = buildPage({
    section, meta, backlink, titleText, byline, hero, bodyHtml, toc, authorName,
  });
  return { html, info, meta };
}

/* ── CLI entry (English bulk generation — unchanged output) ────────────── */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const files = fs.readdirSync(PAGES)
    .filter((f) => /^(blog|academy)-.*\.json$/.test(f) && f !== `${DONE}.json`)
    .sort();

  const stats = {
    blog: 0, academy: 0, ordered: 0, fallback: 0, truncated: [], noBacklink: [], fallbackFiles: [], noToc: [], noByline: 0,
  };

  for (const file of files) {
    const j = JSON.parse(fs.readFileSync(path.join(PAGES, file), 'utf8'));
    const capSlug = file.replace(/\.json$/, '');
    const sect = capSlug.startsWith('academy-') ? 'academy' : 'blog';
    const outSlug = capSlug.replace(/^(blog|academy)-/, '');

    const { html, info } = buildArticle(j, { section: sect, titleFallback: outSlug });
    if (info.truncated) stats.truncated.push(capSlug);
    if (info.ordered) stats.ordered += 1;
    if (info.fallback) { stats.fallback += 1; stats.fallbackFiles.push(capSlug); }
    if (info.noBacklink) stats.noBacklink.push(capSlug);
    if (info.noByline) stats.noByline += 1;
    if (info.noToc) stats.noToc.push(capSlug);

    const outPath = path.join(ROOT, 'content', sect, `${outSlug}.html`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    stats[sect] += 1;
  }

  console.log(JSON.stringify({
    generator: 'stardust/gen/articles.mjs',
    total: files.length,
    blog: stats.blog,
    academy: stats.academy,
    usedOrderedContent: stats.ordered,
    usedBodyFallback: stats.fallback,
    fallbackFiles: stats.fallbackFiles,
    titlesTruncated: stats.truncated,
    pagesMissingBacklink: stats.noBacklink,
    pagesWithoutToc: stats.noToc,
    pagesWithoutByline: stats.noByline,
  }, null, 2));
}
