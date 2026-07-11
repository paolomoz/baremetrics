/**
 * ledger — hairline-ruled record listings ("The Ledger" design system).
 *
 * Variants (extra classes on the block):
 *   entries       blog index — newsroom lead + numbered rows + inert pagination foot
 *   terms         glossary — letter-grouped reference rows, 2-col partition >=1000px
 *   experts       expert directory — logo cell | name/cats/desc | whole-row link
 *   revenue       open-startups — logo | name+desc | Monthly Revenue figure rows
 *   publications  stripe — date-ledger rows + subscribe foot
 *   collections   help — single chrome row into the live KB
 *
 * ENCODE/DECODE contract (#93):
 *   ../baremetrics/stardust/eds-schema/blog.json          (lead-entry + entry-ledger + pagination)
 *   ../baremetrics/stardust/eds-schema/glossary.json      (term-ledger)
 *   ../baremetrics/stardust/eds-schema/experts.json       (expert-ledger)
 *   ../baremetrics/stardust/eds-schema/open-startups.json (revenue-ledger)
 *   ../baremetrics/stardust/eds-schema/stripe.json        (publications)
 *   ../baremetrics/stardust/eds-schema/help.json          (collection-ledger)
 *
 * Decode discipline (#62/#48/#52/#79/#72/#76/#55):
 *   - cell-cascade collector; rows classified by CONTENT (heading tag, media,
 *     link, /^\d+$/ figure prefix, text length), never hard row index;
 *   - short-text-only rows BEFORE the first unit = head meta-labels, AFTER the
 *     last unit = the inert pagination/subscribe foot (structural position,
 *     not index);
 *   - whole-surface links: each unit renders as ONE <a> wrapping figure +
 *     title + teaser + go phrase, mirroring the prototype's .surface-link
 *     records (the role inventory reads them as a single CTA);
 *   - the section head authored as default content before the block is
 *     reabsorbed; variants whose prototype hides it (terms/experts/revenue/
 *     collections) render it .visually-hidden.
 */

const MEDIA = (el) => (el.matches && el.matches('picture, img')) || !!el.querySelector('picture, img');

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

const SHORT = 48;

function rowsOf(block) {
  return [...block.children].filter((r) => r.tagName === 'DIV').map((row) => {
    let cells = [...row.children].filter((c) => c.tagName === 'DIV');
    if (!cells.length) cells = [row];
    cells.forEach((cell) => {
      [...cell.childNodes].forEach((n) => {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const p = document.createElement('p');
          n.replaceWith(p);
          p.append(n);
        }
      });
    });
    return { row, cells };
  });
}

function absorbedHead(block) {
  const out = [];
  const wrap = block.closest('.block-content');
  if (wrap) {
    const prev = wrap.previousElementSibling;
    if (prev && prev.matches('.default-content, .default-content-wrapper')) {
      out.push(...prev.children);
      prev.remove();
    }
  } else {
    let sib = block.previousElementSibling;
    const buf = [];
    while (sib && sib.tagName !== 'DIV') { buf.unshift(sib); sib = sib.previousElementSibling; }
    out.push(...buf);
  }
  return out;
}

function el(tag, cls, txt) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (txt !== undefined) node.textContent = txt;
  return node;
}

/* the visible link phrase inside a whole-surface link (never echoes the heading) */
function go(label) {
  const span = el('span', 'go', label);
  const arrow = el('span', '', ' →');
  arrow.setAttribute('aria-hidden', 'true');
  span.append(arrow);
  return span;
}


/* append children separated by single spaces — the prototype's pretty-printed
   markup leaves whitespace between a surface-link's parts, so textContent
   (and therefore the round-trip match key) needs the same separation */
function appendSpaced(parent, ...nodes) {
  nodes.forEach((n) => {
    if (!n) return;
    if (parent.childNodes.length) parent.append(' ');
    parent.append(n);
  });
}

/* per-row feature extraction */
function features(cells) {
  const f = {
    figure: null, date: null, heading: null, headingCell: null, link: null, linkText: '',
    img: null, imgWrapEm: false, logoText: null, paras: [], metaTexts: [],
  };
  cells.forEach((cell) => {
    const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
    const link = cell.querySelector('a');
    const t = text(cell);
    if (MEDIA(cell)) {
      const img = cell.querySelector('img');
      f.img = img;
      f.imgWrapEm = !!(img && img.closest('em'));
      return;
    }
    if (heading) {
      f.heading = heading;
      f.headingCell = cell;
      [...cell.children].forEach((n) => {
        if (n !== heading && text(n)) f.paras.push(n);
      });
      return;
    }
    if (link) {
      f.link = link;
      f.linkText = text(link);
      return;
    }
    if (!t) return;
    if (/^\d{1,3}$/.test(t) && !f.figure) f.figure = t;
    else f.metaTexts.push({ cell, t });
  });
  return f;
}

/* ---- variant builders ------------------------------------------------ */

function buildEntryUnit(f) {
  const a = el('a', 'surface-link');
  if (f.link) a.href = f.link.getAttribute('href') || '#';
  const isLead = f.heading && f.heading.tagName === 'H2';
  a.className = isLead ? 'surface-link lead-link' : 'surface-link entry-row';
  if (f.heading) a.setAttribute('aria-label', `${f.linkText || 'Continue Reading'}: ${text(f.heading)}`);
  if (isLead) {
    const meta = el('div', 'entry-meta');
    if (f.figure) {
      const no = el('span', 'figure entry-no', f.figure);
      no.setAttribute('aria-hidden', 'true');
      appendSpaced(meta, no);
    }
    f.metaTexts.forEach(({ t }) => appendSpaced(meta, el('span', 'meta-label', t)));
    const body = el('div', 'lead-body');
    appendSpaced(body, f.heading);
    f.paras.forEach((p) => { p.className = 'lead-teaser'; appendSpaced(body, p); });
    appendSpaced(body, go(f.linkText || 'Continue Reading'));
    a.append(meta, ' ', body);
    const article = el('article', 'lead-entry');
    article.append(a);
    return article;
  }
  if (f.figure) {
    const no = el('span', 'figure entry-no', f.figure);
    no.setAttribute('aria-hidden', 'true');
    appendSpaced(a, no);
  }
  appendSpaced(a, f.heading);
  f.paras.forEach((p) => { p.removeAttribute('class'); appendSpaced(a, p); });
  appendSpaced(a, go(f.linkText || 'Continue Reading'));
  const li = el('li');
  li.append(a);
  return li;
}

function buildTermUnit(f) {
  const a = el('a', 'surface-link term-row');
  if (f.link) a.href = f.link.getAttribute('href') || '#';
  const title = f.heading || el('h3', '', f.metaTexts.map((m) => m.t).join(' '));
  a.setAttribute('aria-label', `${f.linkText || 'Continue Reading'}: ${text(title)}`);
  a.append(title, ' ', go(f.linkText || 'Continue Reading'));
  const li = el('li');
  li.append(a);
  return li;
}

function buildExpertUnit(f, cells) {
  const a = el('a', 'surface-link expert-row');
  if (f.link) {
    a.href = f.link.getAttribute('href') || '#';
    a.rel = 'noopener';
  }
  const name = f.heading ? text(f.heading) : '';
  a.setAttribute('aria-label', `${f.linkText || 'Click to learn more'}: ${name}`);
  const logo = el('span', 'logo-cell');
  if (f.img) {
    f.img.alt = '';
    if (f.imgWrapEm) {
      /* authored <em><img></em> = ink-chip logo (light-on-transparent capture) */
      const chip = el('span', 'logo-chip');
      chip.append(f.img);
      logo.append(chip);
    } else logo.append(f.img);
  } else {
    /* captured no-logo behaviour: the wordmark text authored in the logo cell */
    const fallbackCell = cells.find((c) => !MEDIA(c) && !c.querySelector('a, h1, h2, h3, h4') && text(c) && f.metaTexts.some((m) => m.cell === c));
    logo.append(el('span', 'logo-fallback', fallbackCell ? text(fallbackCell) : name));
  }
  const main = el('span', 'expert-main');
  if (f.heading) appendSpaced(main, f.heading);
  f.paras.forEach((p, i) => {
    p.className = i === 0 ? 'meta-label expert-cats' : 'expert-desc';
    appendSpaced(main, p);
  });
  appendSpaced(main, go(f.linkText || 'Click to learn more'));
  a.append(logo, ' ', main);
  const li = el('li');
  li.append(a);
  return li;
}

function buildRevenueUnit(f) {
  const a = el('a', 'surface-link rev-row');
  if (f.link) {
    a.href = f.link.getAttribute('href') || '#';
    a.rel = 'noopener';
  }
  a.setAttribute('aria-label', f.heading ? text(f.heading) : (f.linkText || ''));
  const logo = el('span', 'ledger-logo');
  if (f.img) { f.img.alt = ''; logo.append(f.img); }
  const copy = el('span', 'ledger-copy');
  if (f.heading) appendSpaced(copy, f.heading);
  f.paras.forEach((p) => { p.removeAttribute('class'); appendSpaced(copy, p); });
  const rev = el('span', 'ledger-rev');
  /* the rev cell holds label + figure as SIBLING paragraphs — read the cell's
     child elements (#79: per CELL, but per FIELD within it), first = label */
  const revCell = f.metaTexts[0] && f.metaTexts[0].cell;
  let parts = revCell ? [...revCell.children].map(text).filter(Boolean) : [];
  if (parts.length < 2) parts = f.metaTexts.map((m) => m.t);
  const [labelTxt, ...figParts] = parts;
  if (labelTxt) appendSpaced(rev, el('span', 'meta-label', labelTxt));
  const figTxt = figParts.join(' ');
  appendSpaced(rev, el('span', 'figure rev-figure', figTxt || '—'));
  a.append(logo, ' ', copy, ' ', rev);
  const li = el('li');
  li.append(a);
  return li;
}

function buildCollectionUnit(f) {
  const a = el('a', 'surface-link collection-row');
  if (f.link) a.href = f.link.getAttribute('href') || '#';
  appendSpaced(a, go(f.linkText || text(f.link) || 'Browse'));
  f.metaTexts.forEach(({ t }) => appendSpaced(a, el('span', 'meta-label', t)));
  return a;
}

function buildPublicationUnit(f) {
  const a = el('a', 'surface-link pub-row');
  if (f.link) a.href = f.link.getAttribute('href') || '#';
  f.metaTexts.forEach(({ t }) => {
    const time = el('time', '', t);
    appendSpaced(a, time);
  });
  appendSpaced(a, el('span', 'pub-title', f.linkText));
  const li = el('li');
  li.append(a);
  return li;
}

/* inert pagination foot (entries): Previous | Page 1 | Next | sr-note */
function buildPageFoot(footRows) {
  const nav = el('nav', 'page-nav');
  nav.setAttribute('aria-label', 'Pages');
  const row = el('div', 'page-row');
  const texts = [];
  footRows.forEach(({ cells }) => cells.forEach((c) => { if (text(c)) texts.push(text(c)); }));
  texts.forEach((t) => {
    if (/^page\b/i.test(t)) {
      row.append(el('p', 'meta-label', t));
      return;
    }
    if (!/^(prev|next|newer|older|←|→|first|last)/i.test(t)) {
      const note = el('p', 'visually-hidden', t); /* chrome sr-note */
      nav.append(note);
      return;
    }
    const btn = el('button', 'page-btn');
    btn.type = 'button';
    btn.setAttribute('aria-disabled', 'true');
    const arrow = el('span', '', /prev/i.test(t) ? '← ' : '');
    arrow.setAttribute('aria-hidden', 'true');
    if (/prev/i.test(t)) { btn.append(arrow, document.createTextNode(t)); } else {
      const fwd = el('span', '', ' →');
      fwd.setAttribute('aria-hidden', 'true');
      btn.append(document.createTextNode(t), fwd);
    }
    row.append(btn);
  });
  nav.prepend(row);
  return nav;
}

/* inert subscribe foot (publications): label | placeholder | button */
function buildSubscribeFoot(footRows) {
  const cells = [];
  footRows.forEach((r) => r.cells.forEach((c) => { if (text(c)) cells.push(text(c)); }));
  const [labelTxt, placeholder, buttonTxt] = cells;
  const wrap = el('div', 'pub-subscribe');
  const label = el('label', 'ds-label', labelTxt);
  label.setAttribute('for', 'ledger-subscribe-email');
  const inline = el('div', 'inline-form');
  const input = el('input', 'ds-input');
  input.type = 'email';
  input.id = 'ledger-subscribe-email';
  input.placeholder = placeholder || '';
  input.autocomplete = 'email';
  const btn = el('button', 'ledger-btn', buttonTxt || 'Subscribe');
  btn.type = 'button'; /* inert chrome */
  inline.append(input, btn);
  wrap.append(label, inline);
  return wrap;
}

/* ---------------------------------------------------------------------- */

export default async function decorate(block) {
  const variant = ['entries', 'terms', 'experts', 'revenue', 'publications', 'collections']
    .find((v) => block.classList.contains(v)) || 'entries';
  const hiddenHead = ['terms', 'experts', 'revenue', 'collections'].includes(variant);

  /* section head authored as default content before the block */
  const headEls = absorbedHead(block);

  const rows = rowsOf(block);
  const parsed = rows.map(({ row, cells }) => {
    const f = features(cells);
    const isLetter = variant === 'terms' && cells.length === 1 && /^[A-Z]$/i.test(text(cells[0]));
    const isUnit = !isLetter && !!(f.heading || f.img || f.link);
    return { row, cells, f, isLetter, isUnit };
  });

  const firstUnit = parsed.findIndex((r) => r.isUnit || r.isLetter);
  const lastUnit = parsed.length - 1 - [...parsed].reverse().findIndex((r) => r.isUnit || r.isLetter);
  const headRows = parsed.filter((r, i) => !r.isUnit && !r.isLetter && i < firstUnit);
  const footRows = parsed.filter((r, i) => !r.isUnit && !r.isLetter && i > lastUnit);
  const unitRows = parsed.filter((r) => r.isUnit || r.isLetter);

  /* detach retained nodes before wiping */
  const wrap = el('div', 'ledger-wrap');

  /* — reabsorbed section head — */
  if (headEls.length) {
    const headline = el('div', 'ledger-headline');
    headEls.forEach((n) => {
      n.remove();
      if (/^H[1-6]$/.test(n.tagName)) {
        n.className = hiddenHead ? 'ledger-title visually-hidden' : 'ledger-title';
        headline.append(n);
      } else if (text(n).length <= SHORT && !/^h/i.test(n.tagName)) {
        headline.append(el('p', 'meta-label ledger-count', text(n)));
      } else if (variant === 'collections') {
        n.className = 'visually-hidden';
        headline.append(n);
      } else {
        n.className = 'section-lede';
        headline.append(n);
      }
    });
    wrap.append(headline);
  }

  /* — in-block head labels (entries: "All entries | 25 entries") — */
  if (headRows.length) {
    if (variant === 'entries') {
      const lh = el('div', 'ledger-head');
      headRows.forEach((r) => r.cells.forEach((c) => { if (text(c)) lh.append(el('p', 'meta-label', text(c))); }));
      wrap.append(lh);
    } else {
      headRows.forEach((r) => r.cells.forEach((c) => { if (text(c)) wrap.append(el('p', 'meta-label ledger-count', text(c))); }));
    }
  }

  /* — units — */
  if (variant === 'terms') {
    let group = null;
    let list = null;
    unitRows.forEach((r) => {
      if (r.isLetter) {
        group = el('div', 'letter-group');
        const label = el('p', 'meta-label letter-label', text(r.cells[0]).toUpperCase());
        label.setAttribute('aria-hidden', 'true');
        group.append(label);
        list = el('ul', 'term-list');
        list.setAttribute('role', 'list');
        group.append(list);
        wrap.append(group);
        return;
      }
      if (!list) {
        group = el('div', 'letter-group');
        list = el('ul', 'term-list');
        list.setAttribute('role', 'list');
        group.append(list);
        wrap.append(group);
      }
      list.append(buildTermUnit(r.f));
    });
  } else if (variant === 'collections') {
    const box = el('div', 'collection-list');
    unitRows.forEach((r) => box.append(buildCollectionUnit(r.f)));
    wrap.append(box);
  } else {
    const list = el('ul', `${variant.replace(/s$/, '')}-list`);
    list.setAttribute('role', 'list');
    unitRows.forEach((r) => {
      const unit = {
        entries: buildEntryUnit,
        experts: (f) => buildExpertUnit(f, r.cells),
        revenue: buildRevenueUnit,
        publications: buildPublicationUnit,
      }[variant](r.f);
      if (unit.tagName === 'ARTICLE') wrap.append(unit); /* the newsroom lead sits above the ruled list */
      else list.append(unit);
    });
    wrap.append(list);
  }

  /* — foot rows — */
  if (footRows.length) {
    if (variant === 'publications') wrap.append(buildSubscribeFoot(footRows));
    else wrap.append(buildPageFoot(footRows));
  }

  block.textContent = '';
  block.append(wrap);
}
