/**
 * accordion — hairline-ruled FAQ ("The Ledger" design system).
 *
 * Variant: default (the only one). One authored row per Q/A pair:
 * cell 1 = the question (h3 or plain text), cell 2 = the answer (p's / lists).
 * A trailing row with a link and no question mark-style pairing becomes the
 * .faq-more foot ("More questions? Contact us.").
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   features-recover.json (faq), compare-profitwell-alternative.json (faq).
 *
 * Rendering follows the prototypes: h3 > button.faq-q (aria-expanded) +
 * region panel. Panels are OPEN in markup (JS-off readable); this decorate
 * closes them on init and wires the toggle — no motion beyond the glyph
 * (prefers-reduced-motion safe).
 */

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
  const headEls = absorbedHead(block).map((n) => { n.remove(); return n; });

  const pairs = [];
  let more = null;
  rowsOf(block).forEach(({ cells }) => {
    if (cells.length < 2) {
      /* single-cell trailing row with a link = the .faq-more foot */
      if (cells[0] && cells[0].querySelector('a')) more = [...cells[0].childNodes];
      return;
    }
    const [qCell, aCell] = cells;
    const q = text(qCell);
    const answer = [...aCell.children].filter((n) => text(n) || n.matches('ul, ol'));
    if (q) pairs.push({ q, answer });
  });

  const keep = pairs.flatMap((p) => p.answer);
  keep.forEach((n) => n.remove());
  if (more) more.forEach((n) => n.remove && n.remove());
  block.textContent = '';

  const wrap = el('div', 'accordion-wrap');
  block.append(wrap);
  headEls.forEach((n) => {
    if (!/^H[1-6]$/.test(n.tagName)) n.className = 'section-lede';
    wrap.append(n);
  });

  const list = el('div', 'faq-list');
  wrap.append(list);
  const uid = `faq-${Math.random().toString(36).slice(2, 7)}`;

  pairs.forEach((pair, i) => {
    const item = el('div', 'faq-item');
    const h3 = el('h3');
    const btn = el('button', 'faq-q');
    btn.type = 'button';
    btn.id = `${uid}-q-${i + 1}`;
    btn.setAttribute('aria-controls', `${uid}-panel-${i + 1}`);
    btn.setAttribute('aria-expanded', 'false');
    btn.append(document.createTextNode(pair.q));
    const glyph = el('span', 'glyph');
    glyph.setAttribute('aria-hidden', 'true');
    btn.append(glyph);
    h3.append(btn);
    const panel = el('div', 'faq-panel');
    panel.id = `${uid}-panel-${i + 1}`;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', btn.id);
    pair.answer.forEach((n) => panel.append(n));
    panel.hidden = true; /* closed on init, per the prototype script */
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
    item.append(h3, panel);
    list.append(item);
  });

  if (more) {
    const foot = el('p', 'faq-more');
    more.forEach((n) => foot.append(n));
    foot.querySelectorAll('a').forEach((a) => a.classList.add('ds-link'));
    wrap.append(foot);
  }
}
