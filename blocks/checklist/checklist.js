/**
 * checklist — red-✗ comparison columns ("The Ledger" design system).
 *
 * Variant: default (the only one) — two window-chromed screenshots, each with
 * a bold claim and a red-✗ list (recover "problem" section, mist ground).
 *
 * ENCODE/DECODE contract (#93):
 *   ../baremetrics/stardust/eds-schema/features-recover.json (problem).
 *
 * Decode (#62/#48/#79/#72): the h2 + lede head is reabsorbed default content;
 * one authored row per column — img cell (window-chromed), claim + list cell
 * (bold claim paragraph, then the ✗ items as a plain authored list; the red ✗
 * glyphs are chrome, prepended aria-hidden).
 */

const MEDIA = (el) => (el.matches && el.matches('picture, img')) || !!el.querySelector('picture, img');

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

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

function win(img) {
  const w = el('span', 'win');
  const bar = el('span', 'win-bar');
  bar.setAttribute('aria-hidden', 'true');
  bar.append(el('span'), el('span'), el('span'));
  w.append(bar, img);
  return w;
}

export default async function decorate(block) {
  const headEls = absorbedHead(block).map((n) => { n.remove(); return n; });

  const cols = [];
  rowsOf(block).forEach(({ cells }) => {
    const col = { img: null, claim: null, list: null };
    cells.forEach((cell) => {
      if (MEDIA(cell)) { col.img = cell.querySelector('img'); return; }
      const list = cell.querySelector('ul, ol');
      if (list) col.list = list;
      [...cell.children].forEach((n) => {
        if (n !== list && text(n) && !col.claim) col.claim = n;
      });
    });
    if (col.img || col.claim || col.list) cols.push(col);
  });

  cols.flatMap((c) => [c.img, c.claim, c.list]).filter(Boolean)
    .forEach((n) => n.remove && n.remove());
  block.textContent = '';

  const wrap = el('div', 'checklist-wrap');
  block.append(wrap);
  headEls.forEach((n) => {
    if (!/^H[1-6]$/.test(n.tagName)) n.className = 'section-lede';
    wrap.append(n);
  });

  const grid = el('div', 'compare');
  wrap.append(grid);
  cols.forEach((col) => {
    const colEl = el('div', 'compare-col');
    if (col.img) colEl.append(win(col.img));
    if (col.claim) {
      col.claim.className = 'compare-claim';
      colEl.append(col.claim);
    }
    if (col.list) {
      col.list.className = 'x-list';
      col.list.setAttribute('role', 'list');
      [...col.list.querySelectorAll('li')].forEach((li) => {
        const x = el('span', 'x', '×');
        x.setAttribute('aria-hidden', 'true');
        li.prepend(x, ' ');
      });
      colEl.append(col.list);
    }
    grid.append(colEl);
  });
}
