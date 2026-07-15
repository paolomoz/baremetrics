/**
 * stardust/gen/lib.mjs — shared helpers for the STATIC/LEGAL, USERCASE,
 * HELP-KB, TOOL and OPEN-DATA content generators (Path A′ — reuse existing
 * blocks, invent nothing).
 *
 * Source of truth for copy: the captured page JSON at
 *   ../baremetrics/stardust/current/pages/<slug>.json   (title/description,
 *   headings, body, media, ctas — all VERBATIM).
 * Because the capture flattens heading↔prose ordering (and for several pages
 * the body/prose was not captured at all — privacy, the usercase studies,
 * subscribe), the ordered prose model is re-read from the LIVE DOM (same
 * origin, same day as the capture) with `extract()`. This is faithful
 * reconstruction of the SAME content, never invention; each generator
 * cross-checks against the JSON where the JSON has body. Pages whose body is
 * non-semantic (accelerator) are ordered from JSON strings via `orderByRaw()`.
 */
/* eslint-disable no-console */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '../..');
export const PAGES = path.resolve(here, '../../../baremetrics/stardust/current/pages');
export const OUT = path.resolve(here, '../../content');
export const HUB = 'https://baremetrics.com';

export const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
export const T = (s) => (s || '').replace(/\s+/g, ' ').trim();

export function readJson(slug) {
  return JSON.parse(fs.readFileSync(path.join(PAGES, `${slug}.json`), 'utf8'));
}

/* internal links must be root-relative: rewrite marketing-site absolute hrefs
   (https://[www.]baremetrics.com/X → /X); other subdomains (app./demo./help.…)
   and text URLs are left absolute. Applied on write so no generator can emit
   an absolute internal href. */
export const relInternal = (html) => (html || '')
  .replace(/href="https:\/\/(?:www\.)?baremetrics\.com(\/[^"]*)?"/g, (_m, p) => `href="${p || '/'}"`);

export function write(rel, html) {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, relInternal(html));
  console.log('  wrote', path.relative(REPO, dest));
}

/* ── DA body-fragment builders (David's model) ───────────────────────── */
export const page = (sections) => `<body>
<header></header>
<main>
${sections.filter(Boolean).join('\n')}
</main>
<footer></footer>
</body>
`;

export function metadata(title, desc, extra = {}) {
  const rows = [
    ['Title', title],
    ['Description', desc],
    ...Object.entries(extra),
  ].map(([k, v]) => `      <div><div>${esc(k)}</div><div>${esc(v)}</div></div>`);
  return `  <div>
    <div class="metadata">
${rows.join('\n')}
    </div>
  </div>`;
}

export const cell = (html) => `<div>${html}</div>`;
export const row = (cells) => `      <div>${cells.map(cell).join('')}</div>`;
export const block = (cls, rows) => `  <div>
    <div class="${cls}">
${rows.join('\n')}
    </div>
  </div>`;
export const blockWithHead = (headHtml, cls, rows) => `  <div>
${headHtml}
    <div class="${cls}">
${rows.join('\n')}
    </div>
  </div>`;

/* a plain default-content section (prose) */
export const section = (html) => `  <div>
${html}
  </div>`;

/* section carrying section-metadata (Style: …) */
export const sectionMeta = (html, style) => `  <div>
${html}
    <div class="section-metadata">
      <div><div>Style</div><div>${esc(style)}</div></div>
    </div>
  </div>`;

/* render an ordered content model (from extract/orderByRaw) as prose HTML.
   opts.maxHeading clamps captured levels (e.g. never emit another h1). */
export function prose(items, opts = {}) {
  const out = [];
  const bump = opts.headingShift || 0;
  const min = opts.minHeading || 2;
  items.forEach((it) => {
    if (it.type === 'heading') {
      let lvl = Math.min(6, Math.max(min, it.level + bump));
      out.push(`    <h${lvl}>${esc(it.text)}</h${lvl}>`);
    } else if (it.type === 'p') {
      if (it.html) out.push(`    <p>${it.html}</p>`);
    } else if (it.type === 'list') {
      const tag = it.ordered ? 'ol' : 'ul';
      out.push(`    <${tag}>${it.items.map((li) => `<li>${li}</li>`).join('')}</${tag}>`);
    } else if (it.type === 'img') {
      out.push(`    <p><img src="${escAttr(it.src)}" alt="${escAttr(it.alt)}"${it.w ? ` width="${it.w}"` : ''}${it.h ? ` height="${it.h}"` : ''}></p>`);
    }
  });
  return out.join('\n');
}

/* ── live DOM extraction (ordered content model) ─────────────────────── */
export async function extract(pg, url, o = {}) {
  await pg.goto(url, { waitUntil: o.wait || 'domcontentloaded' }).catch(() => {});
  if (o.scroll) {
    for (let i = 0; i < 8; i += 1) { await pg.mouse.wheel(0, 1200); await pg.waitForTimeout(300); }
  }
  await pg.waitForTimeout(o.waitMs || 1600);
  return pg.evaluate(() => {
    const abs = (href) => { try { return new URL(href, location.href).href; } catch { return href; } };
    /* NB: HubSpot names the MAIN content region ".banner-area"/".banner-section",
       so never exclude on "banner". Chrome is header/footer/nav/menu + forms. */
    const badSel = 'header,footer,nav,[class*="header"],[class*="footer"],[class*="menu"],[class*="navigation"],form';
    const bad = (e) => e.closest(badSel);
    const esc2 = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ALLOW = new Set(['A', 'STRONG', 'EM', 'B', 'I', 'BR']);
    const clean = (node) => {
      let out = '';
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) out += esc2(n.textContent);
        else if (n.nodeType === 1) {
          const tag = n.tagName;
          if (ALLOW.has(tag)) {
            if (tag === 'BR') out += '<br>';
            else if (tag === 'A') {
              const h = abs(n.getAttribute('href') || '');
              out += `<a href="${h.replace(/"/g, '&quot;')}">${clean(n)}</a>`;
            } else out += `<${tag.toLowerCase()}>${clean(n)}</${tag.toLowerCase()}>`;
          } else out += clean(n);
        }
      });
      return out.replace(/\s+/g, ' ').trim();
    };
    const items = [];
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,ol,img').forEach((e) => {
      if (bad(e)) return;
      const tag = e.tagName;
      if (tag === 'IMG') {
        const src = e.getAttribute('src');
        if (!src) return;
        items.push({
          type: 'img', src: abs(src), alt: e.getAttribute('alt') || '', w: e.naturalWidth || e.width || 0, h: e.naturalHeight || e.height || 0,
        });
        return;
      }
      if (tag === 'UL' || tag === 'OL') {
        if (e.closest('li')) return;
        const lis = [...e.querySelectorAll(':scope > li')].map((li) => clean(li)).filter(Boolean);
        if (lis.length) items.push({ type: 'list', ordered: tag === 'OL', items: lis });
        return;
      }
      if (tag === 'P' && e.closest('li')) return;
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      if ([...e.children].some((c) => c.tagName !== 'A' && (c.textContent || '').replace(/\s+/g, ' ').trim() === t)) return;
      if (/^H[1-6]$/.test(tag)) items.push({ type: 'heading', level: +tag[1], text: t });
      else items.push({ type: 'p', html: clean(e) });
    });
    return items;
  });
}

/* order JSON headings+body by their position in the live raw HTML — used
   where the live DOM stores prose in non-semantic elements (accelerator). */
export async function orderByRaw(slug, jsonHeadings, jsonBody) {
  const raw = await (await fetch(`${HUB}/${slug}`)).text();
  const norm = raw.replace(/\s+/g, ' ');
  const items = [
    ...jsonHeadings.map((h) => ({ type: 'heading', level: +h.tag[1], text: h.text })),
    ...jsonBody.map((b) => ({ type: 'p', html: esc(b) })),
  ];
  const posOf = (s) => {
    const probe = s.slice(0, 22).replace(/\s+/g, ' ');
    const idx = norm.indexOf(probe);
    return idx < 0 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return items
    .map((it) => ({ it, pos: posOf(it.type === 'heading' ? it.text : it.html.replace(/<[^>]+>/g, '')) }))
    .sort((a, b) => a.pos - b.pos)
    .map((x) => x.it);
}

export async function withBrowser(fn) {
  const browser = await chromium.launch();
  const pg = await browser.newPage();
  try { await fn(pg); } finally { await browser.close(); }
}

/* a closing "book a demo"/trial band cta */
export const ctaBand = (heading, label, href, ground = 'tint') => block(`band ${ground} cta`, [
  row([`<h2>${esc(heading)}</h2>`]),
  row([`<p><strong><a href="${escAttr(href)}">${esc(label)}</a></strong></p>`]),
]);
