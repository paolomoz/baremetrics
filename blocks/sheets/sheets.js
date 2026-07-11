/**
 * sheets — document-sheet groupings ("The Ledger" design system).
 *
 * Variants (extra classes on the block):
 *   honest   concession sheets: icon img + h4 + prose, 2-col   (compare)
 *   addons   sheet pair split by a dotted ruling: h3 + price figure +
 *            bullet register + whole-sheet link               (pricing)
 *   support  stat trio in ruled cells: icon + tabular figure + note (compare)
 *   note     method note: "Method" meta rail + two prose columns (ltv-calc)
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   compare-profitwell-alternative.json (being-honest, support),
 *   pricing.json (add-ons), ltv-calc.json (method-note).
 *
 * Decode (#62/#48/#79/#72): one authored row per sheet/cell; cells classified
 * by content — img cell (icon), heading cell (+ trailing prose), price text
 * (leading +$ figure, split on "/"), list cell (bullets), link cell.
 * The kicker+title head is reabsorbed default content (two headings: the
 * first, shorter ALL-CAPS one is the kicker — captured casing preserved).
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

function appendSpaced(parent, ...nodes) {
  nodes.forEach((n) => {
    if (!n) return;
    if (parent.childNodes.length) parent.append(' ');
    parent.append(n);
  });
}

function go(label) {
  const span = el('span', 'go', label);
  const arrow = el('span', '', ' →');
  arrow.setAttribute('aria-hidden', 'true');
  span.append(arrow);
  return span;
}

export default async function decorate(block) {
  const variant = ['honest', 'addons', 'support', 'note']
    .find((v) => block.classList.contains(v)) || 'honest';

  const headEls = absorbedHead(block).map((n) => { n.remove(); return n; });

  const units = [];
  rowsOf(block).forEach(({ cells }) => {
    const u = {
      img: null, heading: null, paras: [], metas: [], list: null, link: null,
      linkText: '', price: null, cols: [],
    };
    cells.forEach((cell) => {
      if (MEDIA(cell)) { u.img = cell.querySelector('img'); return; }
      const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
      const link = cell.querySelector('a');
      const list = cell.querySelector('ul, ol');
      if (heading) {
        /* prose column: heading + trailing content stays together (note variant) */
        u.cols.push([...cell.children]);
        u.heading = u.heading || heading;
        [...cell.children].forEach((n) => {
          if (n === heading) return;
          if (n.matches('ul, ol')) u.list = u.list || n;
          else if (text(n)) u.paras.push(n);
        });
        return;
      }
      if (list && !link) { u.list = list; return; }
      if (link) { u.link = link; u.linkText = text(link); return; }
      const t = text(cell);
      if (!t) return;
      if (/^[+~]?[$€£]?[\d,.]+/.test(t) && !u.price && variant === 'addons') u.price = t;
      else if (t.length <= 48) u.metas.push(cell);
      else u.paras.push(cell.querySelector('p') || el('p', '', t));
    });
    if (u.img || u.heading || u.paras.length || u.metas.length || u.list || u.link) units.push(u);
  });

  const kept = [];
  units.forEach((u) => {
    kept.push(u.img, u.list, u.link);
    u.cols.forEach((col) => kept.push(...col));
    kept.push(...u.paras);
  });
  kept.filter(Boolean).forEach((n) => n.remove && n.remove());
  block.textContent = '';

  const wrap = el('div', 'sheets-wrap');
  block.append(wrap);

  /* head: two headings → kicker (first, short) + title; single heading → title */
  const headings = headEls.filter((n) => /^H[1-6]$/.test(n.tagName));
  const rest = headEls.filter((n) => !/^H[1-6]$/.test(n.tagName));
  if (headings.length >= 2) {
    headings[0].className = 'sheets-kicker';
    headings[1].className = 'sheets-title';
    wrap.append(headings[0], headings[1]);
  } else if (headings.length === 1) {
    headings[0].className = 'sheets-title';
    wrap.append(headings[0]);
  }
  rest.forEach((n) => {
    if (text(n).length <= 48) { n.className = 'meta-label sheets-label'; wrap.append(n); } else { n.className = 'section-lede'; wrap.append(n); }
  });

  if (variant === 'note') {
    const method = el('div', 'method');
    const label = units.find((u) => u.metas.length && !u.heading);
    const labelText = label ? text(label.metas[0]) : (rest.length ? '' : 'Method');
    method.append(el('p', 'meta-label', labelText || 'Method'));
    const body = el('div', 'method-body');
    units.forEach((u) => {
      if (u === label) return;
      u.cols.forEach((col) => {
        const colEl = el('div', 'method-col');
        col.forEach((n) => colEl.append(n));
        body.append(colEl);
      });
    });
    method.append(body);
    wrap.append(method);
    return;
  }

  const grid = el('div', {
    honest: 'honest-grid', addons: 'addons-pair', support: 'support-trio',
  }[variant]);
  wrap.append(grid);

  units.forEach((u) => {
    if (variant === 'addons') {
      const a = el(u.link ? 'a' : 'article', 'addon');
      if (u.link) {
        a.classList.add('surface-link');
        a.href = u.link.getAttribute('href') || '#';
        if (u.heading) a.setAttribute('aria-label', text(u.heading));
      }
      if (u.heading) appendSpaced(a, u.heading);
      if (u.price) {
        const [fig, per] = u.price.split('/');
        const p = el('p', 'addon-price');
        p.append(el('span', 'figure', fig.trim()));
        if (per) p.append(el('span', 'price-per', `/${per.trim()}`));
        appendSpaced(a, p);
      }
      if (u.list) {
        u.list.className = 'addon-bullets';
        u.list.setAttribute('role', 'list');
        appendSpaced(a, u.list);
      }
      if (u.linkText) appendSpaced(a, go(u.linkText));
      grid.append(a);
    } else if (variant === 'support') {
      const cell = el('div', 'support-cell');
      if (u.img) { u.img.alt = u.img.alt || ''; appendSpaced(cell, u.img); }
      const [figure, ...notes] = [...u.metas.map(text), ...u.paras.map(text)];
      if (figure) appendSpaced(cell, el('p', 'stat-figure', figure));
      notes.forEach((n) => appendSpaced(cell, el('p', 'stat-note', n)));
      grid.append(cell);
    } else {
      /* honest */
      const sheet = el('article', 'sheet honest-sheet');
      if (u.img) { u.img.alt = u.img.alt || ''; appendSpaced(sheet, u.img); }
      if (u.heading) appendSpaced(sheet, u.heading);
      u.paras.forEach((p) => { p.removeAttribute && p.removeAttribute('class'); appendSpaced(sheet, p); });
      grid.append(sheet);
    }
  });
}
