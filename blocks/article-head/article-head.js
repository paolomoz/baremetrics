/**
 * article-head — template-slotted article/episode masthead ("The Ledger").
 *
 * Variants (extra class):
 *   article  (blog-article)   topbar (back-link + subscribe) + h1 + byline +
 *                             the captured pink image demoted to an exhibit sheet
 *   episode  (founder-chats)  topbar + kicker meta-label + h1 + byline + the
 *                             episode document-sheet (photo + inert play glyph +
 *                             sr-note + series notes w/ iTunes link + summary)
 *
 * ENCODE/DECODE contract (#93):
 *   ../baremetrics/stardust/eds-schema/blog-customer-retention-metrics.json
 *     (article-masthead section)
 *   ../baremetrics/stardust/eds-schema/founder-chats-natalie-nagele.json
 *     (episode-masthead + episode-sheet sections — ONE block spans both)
 *
 * Authoring grammar (rows classified by content/order, #48/#62):
 *   - a pre-title row whose cells are all links  → topbar
 *   - text row(s) before the h1                  → kicker (episode)
 *   - the h1 row                                 → title
 *   - first text row after the h1                → byline ("·" split into an
 *                                                  aria-hidden .byline-sep span)
 *   - media row                                  → exhibit img (article) /
 *                                                  episode art; a sibling text
 *                                                  cell in the SAME row is the
 *                                                  sr-note ("Listen: player…")
 *   - short text row (≤60ch) before the h2       → sheet meta-label ("Founder Chats")
 *   - h2 row                                     → sheet title
 *   - remaining text rows                        → ep-notes; the LAST one is
 *                                                  the episode summary
 * Authored: ALL text + imgs. The block owns chrome: sheet frame, play glyph,
 * window bars. No data-anim (EDS pages ship without the prototype animations).
 *
 * TEMPLATE-JS NOTE (verified 2026-07-11): scripts/ak.js loadTemplate() loads
 * ONLY templates/<t>/<t>.css — there is NO template JS loader. The article
 * template's single JS behaviour (window-chroming chart images authored in the
 * prose default content) therefore lives HERE, on the template-slotted head
 * block every article page carries (see winChromeProse below).
 */

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

const PLAY_SVG = '<svg viewBox="0 0 20 24" width="20" height="24" focusable="false"><path d="M2 2.4v19.2c0 1.1 1.2 1.8 2.2 1.2l15-9.6c.9-.6.9-1.9 0-2.4l-15-9.6C3.2.6 2 1.3 2 2.4z" fill="oklch(32% 0.04 285)"/></svg>';

function rowsOf(block) {
  return [...block.children].filter((r) => r.tagName === 'DIV').map((row) => {
    let cells = [...row.children].filter((c) => c.tagName === 'DIV');
    if (!cells.length) cells = [row];
    return { row, cells };
  });
}

function el(tag, cls, txt) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (txt !== undefined) node.textContent = txt;
  return node;
}

/* "← Customers" → aria-hidden arrow span + label (the captured topbar shape) */
function arrowize(a) {
  const t = text(a);
  if (!t.startsWith('←')) return a;
  a.textContent = '';
  const arrow = el('span', '', '←');
  arrow.setAttribute('aria-hidden', 'true');
  a.append(arrow, ` ${t.replace(/^←\s*/, '')}`);
  return a;
}

/* byline: split the authored "· "-separated halves around .byline-sep spans */
function buildByline(t) {
  const p = el('p', 'byline');
  const parts = t.split(/\s*·\s*/);
  parts.forEach((part, i) => {
    if (i) {
      const sep = el('span', 'byline-sep', '·');
      sep.setAttribute('aria-hidden', 'true');
      p.append(' ', sep, ' ');
    }
    p.append(part);
  });
  return p;
}

/* the article template's one JS behaviour (no template JS loader exists —
   see header note): prose chart images get the .win window chrome */
function winChromeProse() {
  const imgs = document.querySelectorAll(
    'main .article-body > .default-content p > picture, main .article-body > .default-content p > img',
  );
  imgs.forEach((node) => {
    if (node.closest('.win')) return;
    const win = el('span', 'win');
    const bar = el('span', 'win-bar');
    bar.setAttribute('aria-hidden', 'true');
    bar.append(el('span'), el('span'), el('span'));
    node.replaceWith(win);
    win.append(bar, node);
  });
}

export default async function decorate(block) {
  const isEpisode = block.classList.contains('episode');

  const m = {
    topbar: null, kicker: null, title: null, byline: null,
    art: null, srNote: null, label: null, subtitle: null, paras: [],
  };

  rowsOf(block).forEach(({ row, cells }) => {
    const h1 = row.querySelector('h1');
    const sub = row.querySelector('h2, h3');
    const img = row.querySelector('picture, img');
    const links = [...row.querySelectorAll('a')];
    if (h1) { m.title = h1; return; }
    if (!m.title && links.length >= 2 && cells.every((c) => !text(c) || c.querySelector('a'))) {
      m.topbar = links;
      return;
    }
    if (img) {
      m.art = img.closest('picture') || img;
      const other = cells.find((c) => !c.contains(img) && text(c));
      if (other) m.srNote = text(other);
      return;
    }
    if (sub) { m.subtitle = sub; return; }
    const t = cells.map(text).filter(Boolean).join(' ');
    if (!t) return;
    if (!m.title) { m.kicker = t; return; }
    if (!m.byline) { m.byline = t; return; }
    if (!m.label && !m.subtitle && t.length <= 60) { m.label = t; return; }
    const ps = [];
    cells.forEach((c) => {
      if (c.querySelector('p')) ps.push(...c.querySelectorAll('p'));
      else if (text(c)) { const p = el('p'); p.append(...c.childNodes); ps.push(p); }
    });
    m.paras.push(...ps);
  });

  [m.title, m.subtitle, m.art, ...m.paras].forEach((n) => n && n.remove());
  const topbarLinks = m.topbar ? m.topbar.map((a) => { a.remove(); return a; }) : null;
  block.textContent = '';

  const wrap = el('div', 'ah-wrap');
  block.append(wrap);

  if (topbarLinks) {
    const bar = el('div', 'article-topbar');
    topbarLinks.forEach((a) => bar.append(arrowize(a)));
    wrap.append(bar);
  }

  const mast = el('div', 'masthead');
  wrap.append(mast);

  if (isEpisode) {
    if (m.kicker) mast.append(el('p', 'meta-label kicker', m.kicker));
    if (m.title) mast.append(m.title);
    if (m.byline) mast.append(buildByline(m.byline));

    const sheet = el('article', 'ep-sheet');
    wrap.append(sheet);
    if (m.art) {
      const fig = el('figure', 'ep-art');
      fig.append(m.art);
      const play = el('span', 'ep-play');
      play.setAttribute('aria-hidden', 'true');
      play.innerHTML = PLAY_SVG;
      fig.append(play);
      if (m.srNote) fig.append(el('span', 'visually-hidden', m.srNote));
      sheet.append(fig);
    }
    const body = el('div', 'ep-body');
    if (m.label) body.append(el('p', 'meta-label', m.label));
    if (m.subtitle) body.append(m.subtitle);
    const summary = m.paras.pop();
    m.paras.forEach((p) => { p.className = 'ep-note'; body.append(p); });
    if (summary) { summary.className = 'ep-summary'; body.append(summary); }
    sheet.append(body);
  } else {
    const col = el('div');
    if (m.title) col.append(m.title);
    if (m.byline) col.append(buildByline(m.byline));
    mast.append(col);
    if (m.art) {
      const fig = el('figure', 'exhibit');
      fig.append(m.art);
      mast.append(fig);
    }
  }

  winChromeProse();
}
