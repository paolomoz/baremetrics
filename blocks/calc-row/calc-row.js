/**
 * calc-row — recover's inert pricing-calculator ledger row ("The Ledger").
 *
 * Template-slotted: three ruled cells on one hairline card — What's your MRR
 * ($300,000, inert slider chrome + sr-note) · recoverable (~$27,000) · price
 * ($499 /month + CTA) — figures as <data>, plus the Statusbrew quote +
 * attribution below. Slider chrome, dotted rulings, and the card frame are
 * template-owned; every figure, label, note, and quote string is authored.
 *
 * ENCODE/DECODE contract (#93):
 *   ../baremetrics/stardust/eds-schema/features-recover.json (calculator).
 *
 * Decode (#62/#48/#79/#72): the h2 head is reabsorbed default content; a row
 * containing a figure-pattern cell ($300,000 / ~$27,000 / $499) is a calc
 * cell — label (short) | figure | "/­month"-style unit | CTA cell | long text
 * = the sr-note; a long text row without figures = the quote; an img + text
 * row = the attribution (avatar, name, role). The slider chrome docks in the
 * first cell (the captured control, interactivity at launch).
 */

const MEDIA = (el) => (el.matches && el.matches('picture, img')) || !!el.querySelector('picture, img');

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

const FIGURE = /^~?\$[\d,.]+$/;

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

function figureData(t) {
  const data = el('data', 'figure', t);
  data.setAttribute('value', t.replace(/[^0-9.]/g, ''));
  return data;
}

export default async function decorate(block) {
  const headEls = absorbedHead(block).map((n) => { n.remove(); return n; });

  const cellsModel = []; // { label, figure, unit, note, ctaEls }
  let quote = null;
  let avatar = null;
  let name = null;
  let role = null;

  rowsOf(block).forEach(({ row, cells }) => {
    if (MEDIA(row)) {
      /* attribution: avatar | name | role */
      [avatar] = row.querySelectorAll('img');
      const t = cells.filter((c) => !MEDIA(c)).map(text).filter(Boolean);
      [name, role] = t;
      return;
    }
    const hasFigure = cells.some((c) => FIGURE.test(text(c)));
    if (hasFigure) {
      const unit = { label: null, figure: null, unit: null, note: null, ctaEls: null };
      cells.forEach((cell) => {
        const t = text(cell);
        if (!t) return;
        if (FIGURE.test(t)) { unit.figure = t; return; }
        if (cell.querySelector('a')) {
          unit.ctaEls = [...cell.childNodes].filter((n) => n.nodeType === 1);
          return;
        }
        if (/^\//.test(t) && t.length <= 16) { unit.unit = t; return; }
        if (!unit.label && t.length <= 48) { unit.label = t; return; }
        unit.note = t;
      });
      cellsModel.push(unit);
      return;
    }
    const t = cells.map(text).filter(Boolean).join(' ');
    if (t && !quote) quote = t;
  });

  const keptCtas = cellsModel.flatMap((u) => u.ctaEls || []);
  keptCtas.forEach((n) => n.remove());
  if (avatar) avatar.remove();
  block.textContent = '';

  const wrap = el('div', 'calc-wrap');
  block.append(wrap);
  headEls.forEach((n) => {
    if (!/^H[1-6]$/.test(n.tagName)) n.className = 'section-lede';
    wrap.append(n);
  });

  const grid = el('div', 'calc-grid');
  wrap.append(grid);
  cellsModel.forEach((u, i) => {
    const cell = el('div', 'calc-cell');
    if (u.label) cell.append(el('p', 'meta-label', u.label));
    if (u.unit) {
      const p = el('p');
      if (u.figure) p.append(figureData(u.figure), ' ');
      p.append(el('span', 'calc-per', u.unit));
      cell.append(p);
    } else if (u.figure) {
      cell.append(figureData(u.figure));
    }
    if (i === 0) {
      /* inert slider chrome — captured control, interactivity at launch */
      const slider = el('div', 'calc-slider');
      slider.setAttribute('aria-hidden', 'true');
      slider.append(el('i'));
      cell.append(slider);
    }
    if (u.note) cell.append(el('p', 'visually-hidden', u.note));
    if (u.ctaEls) u.ctaEls.forEach((n) => cell.append(n));
    grid.append(cell);
  });

  if (quote) {
    const q = el('div', 'calc-quote');
    const bq = el('blockquote');
    bq.append(el('p', '', quote));
    q.append(bq);
    if (avatar || name) {
      const attrib = el('div', 'testimonial-attrib');
      if (avatar) attrib.append(avatar);
      const cite = el('cite', '', `${name || ''} `);
      if (role) cite.append(el('span', '', role));
      attrib.append(cite);
      q.append(attrib);
    }
    wrap.append(q);
  }
}
