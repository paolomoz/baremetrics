/**
 * steps — single-spine walkthrough / spine ledger rows ("The Ledger").
 *
 * Variants (extra classes on the block):
 *   default  4-step setup procedure — centered hairline spine, steps dock
 *            alternately (recover solution-steps)
 *   entries  spine ledger rows — whole-row links on one shared dotted spine
 *            (stripe data-driven)
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   features-recover.json (solution-steps), stripe.json (data-driven).
 *
 * Decode (#62/#48/#79/#72/#76): one authored row per step — copy cell
 * (pre-heading short text = the "Step 1"/"Entry 01" meta-label, #76; heading;
 * body prose), optional link cell (entries), media cell (window-chromed).
 * Alternation is CSS nth-child — never authored.
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

function win(img) {
  const w = el('span', 'win');
  const bar = el('span', 'win-bar');
  bar.setAttribute('aria-hidden', 'true');
  bar.append(el('span'), el('span'), el('span'));
  w.append(bar, img);
  return w;
}

function go(label) {
  const span = el('span', 'go', label);
  const arrow = el('span', '', ' →');
  arrow.setAttribute('aria-hidden', 'true');
  span.append(arrow);
  return span;
}

export default async function decorate(block) {
  const isEntries = block.classList.contains('entries');

  const headEls = absorbedHead(block).map((n) => { n.remove(); return n; });

  const units = [];
  rowsOf(block).forEach(({ cells }) => {
    const u = {
      meta: null, heading: null, paras: [], img: null, link: null, linkText: '',
    };
    cells.forEach((cell) => {
      if (MEDIA(cell)) { u.img = cell.querySelector('img'); return; }
      const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
      const link = cell.querySelector('a');
      if (heading) {
        u.heading = heading;
        let before = true;
        [...cell.children].forEach((n) => {
          if (n === heading) { before = false; return; }
          if (!text(n)) return;
          if (before && text(n).length <= 48) u.meta = n; /* buffered eyebrow (#76) */
          else u.paras.push(n);
        });
        return;
      }
      if (link) { u.link = link; u.linkText = text(link); return; }
      const t = text(cell);
      if (!t) return;
      if (t.length <= 48 && !u.heading && !u.meta) u.meta = cell.querySelector('p') || el('p', '', t);
      else u.paras.push(cell.querySelector('p') || el('p', '', t));
    });
    if (u.heading || u.img || u.paras.length) units.push(u);
  });

  const kept = units.flatMap((u) => [u.meta, u.heading, ...u.paras, u.img, u.link]).filter(Boolean);
  kept.forEach((n) => n.remove && n.remove());
  block.textContent = '';

  const wrap = el('div', 'steps-wrap');
  block.append(wrap);
  headEls.forEach((n) => {
    if (!/^H[1-6]$/.test(n.tagName)) n.className = 'section-lede';
    wrap.append(n);
  });

  const list = el(isEntries ? 'div' : 'ol', isEntries ? 'spine-rows' : 'step-list');
  wrap.append(list);

  units.forEach((u) => {
    if (isEntries) {
      const row = el(u.link ? 'a' : 'div', 'spine-row');
      if (u.link) {
        row.classList.add('surface-link');
        row.href = u.link.getAttribute('href') || '#';
        if (u.heading) row.setAttribute('aria-label', text(u.heading));
      }
      const copy = el('span', 'spine-copy');
      if (u.meta) { u.meta.className = 'meta-label'; appendSpaced(copy, u.meta); }
      if (u.heading) appendSpaced(copy, u.heading);
      u.paras.forEach((p) => { p.removeAttribute('class'); appendSpaced(copy, p); });
      if (u.linkText) appendSpaced(copy, go(u.linkText));
      const media = el('span', 'spine-media');
      if (u.img) media.append(win(u.img));
      row.append(copy, ' ', media);
      list.append(row);
    } else {
      const li = el('li', 'step');
      const copy = el('div', 'step-copy');
      if (u.meta) { u.meta.className = 'meta-label'; appendSpaced(copy, u.meta); }
      if (u.heading) appendSpaced(copy, u.heading);
      u.paras.forEach((p) => { p.className = 'step-body'; appendSpaced(copy, p); });
      li.append(copy);
      if (u.img) {
        const media = win(u.img);
        media.classList.add('step-media');
        li.append(' ', media);
      }
      list.append(li);
    }
  });
}
