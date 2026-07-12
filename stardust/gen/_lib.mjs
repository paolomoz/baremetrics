/**
 * stardust/gen/_lib.mjs — shared, deterministic emit + capture helpers for the
 * integration + compare content generators (Path A′ — reuse existing blocks).
 *
 * Emit shape mirrors the approved archetypes (content/stripe.html,
 * content/compare/profitwell-alternative.html) and the Wave-B build-content
 * technique: David's-model body fragment, block = <div class>, row = <div>,
 * cell = <div>. CTA canon: strong>a (primary) / em>a (secondary).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const PAGES = path.resolve(here, '../../../baremetrics/stardust/current/pages');
export const OUT = path.resolve(here, '../../content');

export const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
export const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

export const img = (m) => (m
  ? `<img src="${escAttr(m.src)}" alt="${escAttr(m.alt || '')}"${m.w ? ` width="${m.w}"` : ''}${m.h ? ` height="${m.h}"` : ''} loading="lazy">`
  : '');

export const metadata = (title, desc) => `  <div>
    <div class="metadata">
      <div><div>Title</div><div>${esc(title)}</div></div>
      <div><div>Description</div><div>${esc(desc)}</div></div>
    </div>
  </div>`;

export const sectionMeta = (style) => `      <div class="section-metadata"><div><div>style</div><div>${esc(style)}</div></div></div>`;

export const row = (cells) => `      <div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;
export const block = (cls, rows) => `    <div class="${cls}">
${rows.join('\n')}
    </div>`;
export const section = (parts) => `  <div>
${parts.join('\n')}
  </div>`;
export const page = (sections) => `<body>
<header></header>
<main>
${sections.filter(Boolean).join('\n')}
</main>
<footer></footer>
</body>
`;

/* CTA canon: [{text, href, kind:'primary'|'secondary'|'plain'}] → one <p> */
export const ctaP = (ctas) => `<p>${ctas.filter((c) => c && c.href).map((c) => {
  const a = `<a href="${escAttr(c.href)}">${esc(c.text)}</a>`;
  if (c.kind === 'primary') return `<strong>${a}</strong>`;
  if (c.kind === 'secondary') return `<em>${a}</em>`;
  return a;
}).join(' ')}</p>`;

export function loadCapture(slug) {
  return JSON.parse(fs.readFileSync(path.join(PAGES, `${slug}.json`), 'utf8'));
}

export function writePage(relPath, html) {
  const dest = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  return dest;
}

/* title ≤60, preferring the captured <title>, else the h1 */
export function pageTitle(cap) {
  const t = clean(cap.title);
  if (t && t.length <= 60) return t;
  const h1 = clean((cap.headings.find((h) => h.tag === 'h1') || {}).text) || t;
  return h1.length <= 60 ? h1 : `${h1.slice(0, 57).trim()}…`;
}

/* image bucketing shared by both families */
const fnOf = (m) => decodeURIComponent((m.src || '').split('/').pop().split('?')[0]).toLowerCase();
export const isBmLogo = (m) => /baremetrics-logo|baremetrics-mark|baremetrics%20front|baremetrics front page/i.test(m.src) || /baremetrics front page logo|baremetrics logo/i.test(m.alt || '');
export const isVerified = (m) => /stripe-verified/i.test(m.src);
export const isCustomerMark = (m) => /customers--/i.test(m.src);
export const isPaymentStripLogo = (m) => /\/logo-(stripe|braintree|recurly|chargebee|google-play|app-store-connect|shopify)/i.test(m.src);
export const isFeatureIcon = (m) => (/icon-|-icon\.|_icon/i.test(m.src) || (m.w && m.w <= 80 && m.h && m.h <= 80 && /\.svg/i.test(m.src)));
export const isFeatureThumb = (m) => /thumbnail_|-thumb\.|comparison-/i.test(m.src) || (m.w >= 700 && m.h >= 700 && m.w <= 1000);
export const isG2 = (m) => /white-9|g2/i.test(m.src);
export { fnOf };
