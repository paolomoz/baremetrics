/**
 * stardust/gen/_shared.mjs — David's-model HTML fragment helpers for the
 * Path-A′ content generators (stories, experts-cat, indexes).
 *
 * Source of truth: ../baremetrics/stardust/current/pages/<slug>.json (VERBATIM
 * captures — every literal comes from the capture; nothing is invented). Output
 * fragments mirror the approved EDS archetypes:
 *   content/blog/customer-retention-metrics.html (article — customer STORIES)
 *   content/experts.html                          (masthead + ledger experts)
 *   content/blog.html                             (masthead form + ledger entries)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(here, '../../../baremetrics/stardust/current/pages');
export const ROOT = path.resolve(here, '../..');

export const esc = (s) => (s || '').toString()
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

export const readPage = (slug) => JSON.parse(fs.readFileSync(path.join(SRC, `${slug}.json`), 'utf8'));

/* Title ≤60 (defensive truncation on word boundary) */
export const clampTitle = (t) => {
  const s = norm(t);
  if (s.length <= 60) return s;
  const cut = s.slice(0, 60);
  return cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : 60).trim();
};

export const row = (cells) => `      <div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;
export const block = (cls, rows) => `    <div class="${cls}">\n${rows.join('\n')}\n    </div>`;
export const sectionMeta = (style) => `    <div class="section-metadata">
      <div><div>style</div><div>${style}</div></div>
    </div>`;
export const section = (parts) => `  <div>\n${parts.join('\n')}\n  </div>`;

export const metadata = (fields) => `  <div>
    <div class="metadata">
${Object.entries(fields).map(([k, v]) => `      <div><div>${k}</div><div>${esc(v)}</div></div>`).join('\n')}
    </div>
  </div>`;

export const page = (sections) => `<body>
<header></header>
<main>
${sections.join('\n')}
</main>
<footer></footer>
</body>
`;

export const writeOut = (rel, html) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
  return p;
};

/* build an <img> from a media.imgs record (absolute hubfs URL) */
export const imgTag = (m, { lazy = true } = {}) => {
  if (!m) return '';
  const attrs = [`src="${esc(m.src)}"`, `alt="${esc(m.alt || '')}"`];
  if (m.w) attrs.push(`width="${m.w}"`);
  if (m.h) attrs.push(`height="${m.h}"`);
  if (lazy) attrs.push('loading="lazy"');
  attrs.push('decoding="async"');
  return `<img ${attrs.join(' ')}>`;
};
