/**
 * logos — customer/integration mark registers ("The Ledger" design system).
 *
 * Variants (extra classes on the block):
 *   table    ruled logo table — 1px hairline grid cells; optional heading and
 *            label cell; marks may be links       (customers, home payment-providers)
 *   strip    plain ruled flex row of marks
 *   banded   tint ground + h2/lede + label + ruled logo cells (recover dunning)
 *   counter  +900 pull-figure row beside ruled marks; grounds `accent`
 *            (periwinkle inversion, inverted marks — home) or `mist` (stripe)
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   customers.json (customer-logos), home-B.json (payment-providers,
 *   customer-logos counter), stripe.json (customer-count),
 *   features-recover.json (dunning-lede).
 *
 * Decode (#62/#48/#72/#79): the section head (h2/lede) is reabsorbed default
 * content; a short text row = the table label / strip label; a row whose
 * first cell matches /^[+~]?[\d,.]+/ = the counter (figure + rest); every img
 * (optionally link-wrapped) is a mark cell.
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

export default async function decorate(block) {
  const isTable = block.classList.contains('table');
  const isCounter = block.classList.contains('counter');

  const model = {
    heading: null, ledes: [], label: null, counterFigure: null, counterRest: null, marks: [],
  };

  absorbedHead(block).forEach((n) => {
    n.remove();
    if (/^H[1-6]$/.test(n.tagName)) model.heading = n;
    else if (text(n)) model.ledes.push(n);
  });

  rowsOf(block).forEach(({ row, cells }) => {
    if (MEDIA(row)) {
      /* mark cells — keep an authored wrapping link per mark */
      cells.forEach((cell) => {
        cell.querySelectorAll('img').forEach((img) => {
          const a = img.closest('a');
          model.marks.push(a && cell.contains(a) ? a : img);
        });
      });
      return;
    }
    const heading = row.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      model.heading = heading;
      cells.forEach((c) => [...c.children].forEach((n) => { if (n !== heading && text(n)) model.ledes.push(n); }));
      return;
    }
    const texts = cells.map(text).filter(Boolean);
    if (!texts.length) return;
    if (/^[+~]?[\d,.]+[%×x+]?$/.test(texts[0]) && texts.length >= 1) {
      [model.counterFigure] = texts;
      model.counterRest = texts.slice(1).join(' ') || null;
      return;
    }
    if (!model.label) model.label = texts.join(' · ');
    else model.ledes.push(el('p', '', texts.join(' ')));
  });

  const kept = [model.heading, ...model.ledes, ...model.marks].filter(Boolean);
  kept.forEach((n) => n.remove && n.remove());
  block.textContent = '';

  const wrap = el('div', 'logos-wrap');
  block.append(wrap);

  if (model.heading) wrap.append(model.heading);
  model.ledes.forEach((p) => { p.className = 'section-lede'; wrap.append(p); });

  if (isCounter) {
    const rowEl = el('div', 'counter-row');
    const pull = el('p', 'counter-pull');
    const fig = el('span', 'figure counter-figure', model.counterFigure || '');
    pull.append(fig);
    if (model.counterRest) pull.append(el('span', 'counter-rest', model.counterRest));
    rowEl.append(pull);
    const ul = el('ul', 'counter-logos');
    ul.setAttribute('role', 'list');
    model.marks.forEach((m) => {
      const li = el('li');
      li.append(m);
      ul.append(li);
    });
    rowEl.append(ul);
    wrap.append(rowEl);
    return;
  }

  if (model.label && !isTable) wrap.append(el('p', 'meta-label logo-strip-label', model.label));

  const ul = el('ul', isTable ? 'logo-table' : 'logo-cells');
  ul.setAttribute('role', 'list');
  if (model.label && isTable) {
    const li = el('li', 'logo-table-label');
    li.append(el('span', 'meta-label', model.label));
    ul.append(li);
  }
  model.marks.forEach((m) => {
    const li = el('li');
    li.append(m);
    ul.append(li);
  });
  wrap.append(ul);
}
