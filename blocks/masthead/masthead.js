/**
 * masthead — page-opening statement ("The Ledger" design system).
 *
 * Variants (extra classes on the block):
 *   default            h1 + lede                       (experts)
 *   form               + subscribe line + email row    (blog, glossary)
 *     mist             form row on a full-bleed mist band (glossary)
 *   search             kb search row (inert chrome)    (help)
 *   art                flanking illustrations          (open-startups)
 *   counter | versus | tool                            (about, compare, ltv-calc — Wave B pages)
 *
 * The tag/category rail (glossary tag-rail, experts category-rail) is FOLDED IN
 * as a masthead sub-row (documented decision): a row whose cells hold 3+ links
 * becomes .mast-rail; the current link is authored wrapped in <strong> (ak.js
 * turns it into a .btn — both signals are read here and converted to
 * aria-current, never left as a button).
 *
 * ENCODE/DECODE contract (#93):
 *   ../baremetrics/stardust/eds-schema/blog.json          (index-masthead)
 *   ../baremetrics/stardust/eds-schema/glossary.json      (academy-masthead + tag-rail)
 *   ../baremetrics/stardust/eds-schema/experts.json       (experts-masthead + category-rail)
 *   ../baremetrics/stardust/eds-schema/open-startups.json (masthead)
 *   ../baremetrics/stardust/eds-schema/help.json          (kb-masthead)
 *
 * Decode discipline (#62/#48/#52): cells are classified by CONTENT (heading tag,
 * media, link count, text length), never by hard row index. Pre-heading short
 * text is buffered as the kicker (#76). Media matched via `picture, img` (#72).
 * Text is read per CELL, never querySelectorAll('p') (#79).
 */

const MEDIA = (el) => (el.matches && el.matches('picture, img')) || !!el.querySelector('picture, img');

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

/* cell-cascade collector: rows are block children; cells are the row's div
   children (fallback: the row itself). Bare text nodes get wrapped in <p>. */
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

/* Reabsorb a section head authored as default content before the block —
   works under the EDS runtime (.block-content sibling) AND in the raw
   round-trip harness (bare element siblings inside the section). */
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
    let el = block.previousElementSibling;
    const buf = [];
    while (el && el.tagName !== 'DIV') { buf.unshift(el); el = el.previousElementSibling; }
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

function buildFormRow(cells, isSearch) {
  const [labelTxt, placeholder, buttonTxt] = cells.map(text);
  const form = el('div', isSearch ? 'kb-search' : 'subscribe-form');
  const inputId = isSearch ? 'masthead-search' : 'masthead-email';
  const label = el('label', isSearch ? 'kb-search-label' : 'meta-label', labelTxt);
  label.setAttribute('for', inputId);
  const input = el('input', isSearch ? 'kb-search-input' : 'ds-input');
  input.id = inputId;
  input.type = isSearch ? 'search' : 'email';
  input.placeholder = placeholder || '';
  if (isSearch) {
    input.readOnly = true;
    input.setAttribute('aria-disabled', 'true');
  } else {
    input.autocomplete = 'email';
  }
  const button = el('button', isSearch ? 'kb-search-btn' : 'mast-btn');
  button.type = 'button'; /* inert chrome — non-submitting per the fragments-CSP rule */
  if (isSearch) {
    button.setAttribute('aria-disabled', 'true');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.3 15.3 21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    button.append(el('span', 'visually-hidden', buttonTxt || 'Search'));
    const row = el('div', 'kb-search-row');
    row.append(input, button);
    form.append(label, row);
  } else {
    button.textContent = buttonTxt || 'Subscribe';
    form.append(label, input, button);
  }
  return form;
}

function buildRail(cells) {
  const rail = el('nav', 'mast-rail');
  rail.setAttribute('aria-label', 'Index');
  const wrap = el('div', 'mast-rail-wrap');
  rail.append(wrap);
  const counts = [];
  const notes = [];
  cells.forEach((cell) => {
    /* long trailing text = the rail's sr-note (experts filtering note) —
       pull it out BEFORE links so it never joins the count label */
    [...cell.querySelectorAll('p')].forEach((p) => {
      if (!p.querySelector('a') && text(p).length > 48) {
        notes.push(text(p));
        p.remove();
      }
    });
    cell.querySelectorAll('a').forEach((a) => {
      /* current marker: authored <strong><a> — raw in the harness, already
         btn-decorated under the EDS runtime; both become aria-current */
      const strong = a.closest('strong');
      if (strong || a.classList.contains('btn')) {
        a.setAttribute('aria-current', 'true');
        a.classList.remove('btn', 'btn-primary', 'btn-secondary', 'btn-accent');
      }
      wrap.append(a);
      if (strong) strong.remove();
    });
    /* whatever text remains in the cell is the rail count meta-label */
    const leftover = text(cell);
    if (leftover) counts.push(leftover);
  });
  counts.forEach((c) => wrap.append(el('span', 'meta-label rail-count', c)));
  notes.forEach((n) => wrap.append(el('p', 'visually-hidden', n)));
  return rail;
}

export default async function decorate(block) {
  const isSearch = block.classList.contains('search');
  const isForm = block.classList.contains('form');

  const model = {
    heading: null, artImgs: [], pre: [], post: [], formCells: null, notes: [], railCells: null,
  };
  let formSeen = false;
  const pushText = (p) => {
    if (formSeen) model.notes.push(p);
    else if (model.heading) model.post.push(p);
    else model.pre.push(p);
  };

  absorbedHead(block).forEach((n) => {
    if (/^H[1-6]$/.test(n.tagName)) model.heading = n;
    else if (text(n)) pushText(n);
  });

  rowsOf(block).forEach(({ row, cells }) => {
    const linkCount = row.querySelectorAll('a').length;
    const heading = row.querySelector('h1, h2, h3, h4, h5, h6');
    if (linkCount >= 3) {
      model.railCells = cells;
      return; /* row removed at the end via block reset */
    }
    if (heading) {
      model.heading = heading;
      cells.forEach((c) => [...c.children].forEach((n) => {
        if (n === heading) return;
        if (MEDIA(n)) model.artImgs.push(...(n.matches('img') ? [n] : n.querySelectorAll('img')));
        else if (text(n)) model.post.push(n);
      }));
      return;
    }
    if (MEDIA(row)) {
      model.artImgs.push(...row.querySelectorAll('img'));
      return;
    }
    const filled = cells.filter((c) => text(c));
    if (filled.length >= 2) {
      model.formCells = filled;
      formSeen = true;
    } else if (filled.length === 1) {
      pushText(filled[0].querySelector('p, h2, h3, h4') || el('p', '', text(filled[0])));
    }
  });

  /* detach everything we keep BEFORE wiping the block */
  const keep = [model.heading, ...model.artImgs, ...model.pre, ...model.post, ...model.notes];
  keep.forEach((n) => n && n.remove());
  const railCells = model.railCells ? model.railCells.map((c) => { c.remove(); return c; }) : null;
  const formCells = model.formCells ? model.formCells.map((c) => { c.remove(); return c; }) : null;
  block.textContent = '';

  /* — flanking art (open-startups) — */
  model.artImgs.forEach((img, i) => {
    img.className = `mast-art mast-art-${i === 0 ? 'left' : 'right'}`;
    img.setAttribute('aria-hidden', 'true');
    img.alt = '';
    block.append(img);
  });

  const inner = el('div', 'mast-inner');
  block.append(inner);

  /* pre-heading short text = kicker (#76); anything else joins the ledes */
  const post = [...model.post];
  model.pre.forEach((p) => {
    if (text(p).length <= 48 && model.heading) {
      p.className = 'meta-label kicker';
      inner.append(p);
    } else post.unshift(p);
  });
  if (model.heading) inner.append(model.heading);

  /* with a form row, the LAST plain text before it is the subscribe line */
  let subscribeLine = null;
  if ((isForm || formCells) && !isSearch && post.length > 1) subscribeLine = post.pop();
  post.forEach((t) => { t.className = 'section-lede'; inner.append(t); });

  /* — form row — */
  if (formCells) {
    const formEl = buildFormRow(formCells, isSearch);
    if (isSearch) {
      inner.append(formEl);
      model.notes.forEach((n) => { n.className = 'visually-hidden'; formEl.append(n); });
    } else {
      const band = el('div', 'mast-band');
      const bandWrap = el('div', 'mast-band-wrap');
      const formRow = el('div', 'mast-form-row');
      if (subscribeLine) { subscribeLine.className = 'subscribe-line'; formRow.append(subscribeLine); }
      formRow.append(formEl);
      bandWrap.append(formRow);
      band.append(bandWrap);
      block.append(band);
      model.notes.forEach((n) => { n.className = 'visually-hidden'; band.append(n); });
    }
  } else if (subscribeLine) {
    subscribeLine.className = 'section-lede';
    inner.append(subscribeLine);
  }

  /* — folded-in rail — */
  if (railCells) block.append(buildRail(railCells));
}
