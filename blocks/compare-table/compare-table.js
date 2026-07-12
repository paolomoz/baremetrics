/**
 * compare-table — grouped comparison matrix ("The Ledger" design system).
 * Reconstructive: rebuilds the prototype's true-<table> ledger moment from
 * authored rows. Used by compare/profitwell-alternative for the main
 * 10-row matrix AND (variant `gap`) the three capability-gap sub-tables —
 * 25 feature rows across 4 grouped sub-tables page-wide.
 *
 * Semantics (verbatim from the prototype): <table role="table"> with a
 * visually-hidden <caption>, scope=col columnheaders (wordmark imgs, alt=""
 * + visually-hidden brand names + visible suffixes), scope=row rowheaders,
 * ✓ (var(--color-action)) / ✗ (var(--color-x)) glyph cells with
 * visually-hidden "Included — "/"Not included — " text, descriptor cells,
 * and per-cell aria-hidden .data-col-label spans that surface as column
 * labels in the role-RETAINING stacked collapse ≤640px (explicit
 * role=table/row/rowheader/cell survive the CSS display overrides).
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   compare-profitwell-alternative.json (comparison-matrix, capability-gaps).
 *
 * Authored rows (decoded defensively by the cell-cascade collector — #62/#68,
 * classified by content #48, NO hard indexes):
 *   - a single-cell long-text row  = the sr caption of the NEXT group;
 *   - a row containing imgs        = a column-head row (starts a new group):
 *       cell 1 = the feature-column label (empty → visually-hidden "Feature"),
 *       cells 2+ = wordmark img + brand name text (+ optional suffix text);
 *   - every other multi-cell row   = a feature row: cell 1 = the rowheader
 *       label, cells 2+ = data cells whose first text is "yes" / "no" /
 *       "N/A" / free text ("yes"/"no" render the glyph, remaining text is
 *       the descriptor).
 * The section head (h2/h3/claim/body prose) is reabsorbed default content
 * (#76) and styled by this block's CSS (matrix statement / gap entry type).
 */

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

const SVG_NS = 'http://www.w3.org/2000/svg';

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

function vh(txt) { return el('span', 'visually-hidden', txt); }

function glyph(yes) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', yes ? 'gl-yes' : 'gl-no');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', yes ? 'M3.5 10.5l4.5 4.5L16.5 5.5' : 'M5 5l10 10M15 5L5 15');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.4');
  path.setAttribute('stroke-linecap', 'round');
  if (yes) path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

/* a data cell: first text token decides the shape */
function parseData(cell) {
  const texts = [...cell.children].map(text).filter(Boolean);
  if (!texts.length) return { text: '' };
  const t0 = texts[0].toLowerCase();
  if (t0 === 'yes') return { glyph: true, text: texts.slice(1).join(' ') };
  if (t0 === 'no') return { glyph: false, text: texts.slice(1).join(' ') };
  if (texts.length === 1 && t0 === 'n/a') return { na: true, text: texts[0] };
  return { text: texts.join(' ') };
}

export default async function decorate(block) {
  const headEls = absorbedHead(block).map((n) => { n.remove(); return n; });

  const groups = [];
  let cur = null;
  let pendingCaption = null;

  rowsOf(block).forEach(({ row, cells }) => {
    if (row.querySelector('img')) {
      /* column-head row — a new group begins */
      cur = {
        caption: pendingCaption,
        label: text(cells[0] && !cells[0].querySelector('img') ? cells[0] : el('i')),
        cols: cells.filter((c) => c.querySelector('img')).map((c) => ({
          img: c.querySelector('img'),
          texts: [...c.children].filter((n) => n.tagName !== 'IMG' && !n.querySelector('img'))
            .map(text).filter(Boolean),
        })),
        rows: [],
      };
      groups.push(cur);
      pendingCaption = null;
      return;
    }
    if (cells.length === 1) {
      const t = text(cells[0]);
      if (t) pendingCaption = t;
      return;
    }
    if (!cur) {
      cur = { caption: pendingCaption, label: '', cols: [], rows: [] };
      groups.push(cur);
      pendingCaption = null;
    }
    const label = text(cells[0]);
    if (!label) return;
    cur.rows.push({ label, data: cells.slice(1).map(parseData) });
  });

  const keptImgs = groups.flatMap((g) => g.cols.map((c) => c.img)).filter(Boolean);
  keptImgs.forEach((img) => img.remove());
  block.textContent = '';

  const wrap = el('div', 'ct-wrap');
  block.append(wrap);

  if (headEls.length) {
    const head = el('div', 'ct-head');
    headEls.forEach((n) => head.append(n));
    wrap.append(head);
  }

  groups.forEach((group) => {
    const nCols = group.cols.length;
    const cmp = el('div', 'cmp-wrap');
    const table = el('table', `cmp-table ${nCols >= 3 ? 'cmp-main' : 'cmp-sub'}`);
    table.setAttribute('role', 'table');
    if (group.caption) {
      const cap = el('caption', 'visually-hidden', group.caption);
      table.append(cap);
    }
    const colgroup = el('colgroup');
    const colCls = nCols >= 3 ? ['c-feature', 'c-bm', 'c-pwm', 'c-pwr'] : ['c-feature', 'c-a', 'c-b'];
    for (let i = 0; i <= nCols; i += 1) colgroup.append(el('col', colCls[i] || ''));
    table.append(colgroup);

    /* labels for the stacked-view data cells */
    const colLabels = group.cols.map((c) => c.texts.join(' '));

    if (nCols) {
      const thead = el('thead');
      thead.setAttribute('role', 'rowgroup');
      const tr = el('tr');
      tr.setAttribute('role', 'row');
      const th0 = el('th');
      th0.setAttribute('scope', 'col');
      th0.setAttribute('role', 'columnheader');
      if (group.label) th0.append(document.createTextNode(group.label));
      else th0.append(vh('Feature'));
      tr.append(th0);
      group.cols.forEach((col) => {
        const th = el('th');
        th.setAttribute('scope', 'col');
        th.setAttribute('role', 'columnheader');
        const brand = el('span', 'col-brand');
        if (col.img) {
          const src = col.img.getAttribute('src') || '';
          col.img.className = /profitwell/i.test(src) ? 'wm-pw' : 'wm-bm';
          col.img.alt = '';
          col.img.setAttribute('loading', 'lazy');
          brand.append(col.img);
        }
        if (col.texts[0]) brand.append(vh(col.texts[0]));
        if (col.texts[1]) brand.append(el('span', 'col-suffix', col.texts.slice(1).join(' ')));
        th.append(brand);
        tr.append(th);
      });
      thead.append(tr);
      table.append(thead);
    }

    const tbody = el('tbody');
    tbody.setAttribute('role', 'rowgroup');
    group.rows.forEach((r) => {
      const tr = el('tr');
      tr.setAttribute('role', 'row');
      const th = el('th', '', r.label);
      th.setAttribute('scope', 'row');
      th.setAttribute('role', 'rowheader');
      tr.append(th);
      r.data.forEach((d, i) => {
        const td = el('td');
        td.setAttribute('role', 'cell');
        if (colLabels[i]) {
          const lab = el('span', 'data-col-label', colLabels[i]);
          lab.setAttribute('aria-hidden', 'true');
          td.append(lab);
        }
        const cell = el('span', `cell${d.na ? ' cell-na' : ''}`);
        if (d.glyph === true || d.glyph === false) {
          cell.append(glyph(d.glyph));
          const body = el('span');
          body.append(vh(d.glyph ? 'Included — ' : 'Not included — '));
          body.append(document.createTextNode(d.text));
          cell.append(body);
        } else {
          cell.append(document.createTextNode(d.text));
        }
        td.append(cell);
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);
    cmp.append(table);
    wrap.append(cmp);
  });
}
