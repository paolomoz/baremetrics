/**
 * rate-card — pricing's connected 3-plan table ("The Ledger" design system).
 * Template-slotted (#95): holds the prototype section DOM verbatim and slots
 * authored values by role.
 *
 * Shape: one hairline-framed grid of plan columns; the SECOND plan of three
 * ("Growth") is INK-INVERTED — the pricing fingerprint's variationGroup
 * (ARTICLE.plan variant idx 1, bg oklch(0.32 0.04 285)). The inversion is
 * POSITIONAL per #61 (plans[1] of 3) with an authored marker override: a plan
 * name wrapped in <em>/<strong> (e.g. <h2><em>Growth</em></h2>) claims the
 * inversion instead. Above the grid sits the INERT annual/monthly switch
 * (role="switch" aria-checked="true" aria-readonly="true" + the visible
 * annual note it aria-describedby's); below it the captured "OR" divider.
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/pricing.json
 * (rate-card section; the switch + note are pricing-hero items 1–2, folded in
 * here so the switch keeps its role semantics — masthead owns only the h1).
 *
 * Authored rows (decoded by CONTENT, no hard indexes — #62/#48/#79):
 *   - pre-plan single-cell text rows: first = the switch label, rest = the
 *     annual note;
 *   - one row per plan, cells classified by content:
 *       heading cell   h2 name (+ trailing short text = the POPULAR badge)
 *       desc cell      plain prose
 *       price cell     "STARTS AT:" label + "$49 / mo" figure (split into
 *                      price-cur / figure / price-per spans, tabular)
 *       CTA cell       first link = plan CTA (<strong>-wrapped per the button
 *                      convention; raw <strong><a> is normalised when ak.js
 *                      hasn't run), second link = the ARR range link, plain
 *                      text = the integration note
 *       includes cell  leading text = the includes label, ul = feature list
 *   - post-plan short single-cell row = the "OR" divider label.
 */

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

const PRICE = /([$€£]?)\s*([\d][\d,.]*)\s*(.*)/;

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

function el(tag, cls, txt) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (txt !== undefined) node.textContent = txt;
  return node;
}

/* normalise a plan CTA: under the EDS runtime ak.js has already turned
   <strong><a> into a.btn.btn-primary; in the raw harness the wrapper is
   still there — both end as a.btn.btn-primary (#41 button convention). */
function asButton(a) {
  const strong = a.closest('strong');
  if (strong) strong.replaceWith(a);
  a.classList.add('btn', 'btn-primary');
  return a;
}

export default async function decorate(block) {
  const head = { label: null, notes: [] };
  const plans = [];
  let divider = null;

  rowsOf(block).forEach(({ row, cells }) => {
    const heading = row.querySelector('h1, h2, h3, h4, h5, h6');
    if (!heading) {
      const t = cells.map(text).filter(Boolean).join(' ');
      if (!t) return;
      if (plans.length && t.length <= 8) divider = t;
      else if (!head.label) head.label = t;
      else head.notes.push(t);
      return;
    }
    const plan = {
      heading, badge: null, desc: [], priceLabel: null, price: null,
      cta: null, arr: null, integration: [], includesLabel: null, features: null,
    };
    /* authored <em>/<strong> marker on the name = inversion override (#61) */
    const marker = heading.querySelector('em, strong');
    if (marker) {
      plan.marked = true;
      marker.replaceWith(...marker.childNodes);
    }
    cells.forEach((cell) => {
      const links = [...cell.querySelectorAll('a')];
      const list = cell.querySelector('ul, ol');
      if (cell.contains(heading)) {
        [...cell.children].forEach((n) => {
          if (n === heading) return;
          const t = text(n);
          if (t && t.length <= 24 && !plan.badge) plan.badge = t;
          else if (t) plan.desc.push(n);
        });
        return;
      }
      if (list) {
        plan.features = list;
        [...cell.children].forEach((n) => {
          if (n !== list && text(n) && !plan.includesLabel) plan.includesLabel = text(n);
        });
        return;
      }
      if (links.length) {
        [plan.cta, plan.arr] = links;
        [...cell.children].forEach((n) => {
          const t = text(n);
          if (t && !n.querySelector('a') && !n.closest('a')) plan.integration.push(t);
        });
        return;
      }
      const t = text(cell);
      if (!t) return;
      if (/[$€£]\s*\d/.test(t) && t.length <= 64) {
        /* price cell: the $-figure text = price, any other short text = label */
        [...cell.children].forEach((n) => {
          const nt = text(n);
          if (!nt) return;
          if (/[$€£]\s*\d/.test(nt)) plan.price = nt;
          else if (!plan.priceLabel) plan.priceLabel = nt;
        });
        if (!plan.price) plan.price = t;
        return;
      }
      plan.desc.push(cell.querySelector('p') || el('p', '', t));
    });
    plans.push(plan);
  });

  /* detach retained live nodes before wiping the block */
  plans.forEach((p) => [p.heading, ...p.desc, p.cta, p.arr, p.features]
    .filter(Boolean).forEach((n) => n.remove && n.remove()));
  block.textContent = '';

  /* — inert annual switch (role=switch, checked, readonly) + visible note — */
  const wrap = el('div', 'rc-wrap');
  if (head.label) {
    const toggle = el('div', 'discount-toggle');
    const btn = el('button', 'toggle-switch');
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', 'true');
    btn.setAttribute('aria-readonly', 'true');
    btn.append(document.createTextNode(head.label));
    const track = el('span', 'toggle-track');
    track.setAttribute('aria-hidden', 'true');
    track.append(el('span', 'toggle-knob'));
    btn.append(track);
    toggle.append(btn);
    if (head.notes.length) {
      const note = el('p', 'annual-note', head.notes.join(' '));
      note.id = `annual-note-${Math.random().toString(36).slice(2, 7)}`;
      btn.setAttribute('aria-describedby', note.id);
      toggle.append(note);
    }
    wrap.append(toggle);
  }

  /* — the connected plan grid; ink Growth via marker, else plans[1] of 3 — */
  const grid = el('div', 'rc-grid');
  const marked = plans.findIndex((p) => p.marked);
  const inkIdx = marked >= 0 ? marked : (plans.length === 3 ? 1 : -1);
  plans.forEach((plan, i) => {
    const art = el('article', `plan${i === inkIdx ? ' plan-growth' : ''}`);
    const planHead = el('div', 'plan-head');
    planHead.append(plan.heading);
    if (plan.badge) planHead.append(el('p', 'meta-label', plan.badge));
    art.append(planHead);
    plan.desc.forEach((d) => { d.className = 'plan-desc'; art.append(d); });
    if (plan.priceLabel) art.append(el('p', 'meta-label', plan.priceLabel));
    if (plan.price) {
      const m = plan.price.match(PRICE);
      const price = el('p', 'plan-price');
      if (m[1]) price.append(el('span', 'price-cur', m[1]));
      price.append(el('span', 'figure', m[2]));
      if (m[3]) price.append(el('span', 'price-per', m[3]));
      art.append(price);
    }
    if (plan.cta) art.append(asButton(plan.cta));
    if (plan.arr) { plan.arr.className = 'ds-link plan-arr'; art.append(plan.arr); }
    plan.integration.forEach((t) => art.append(el('p', 'plan-integration', t)));
    if (plan.includesLabel) art.append(el('p', 'plan-includes', plan.includesLabel));
    if (plan.features) {
      plan.features.className = 'plan-features';
      plan.features.setAttribute('role', 'list');
      art.append(plan.features);
    }
    grid.append(art);
  });
  wrap.append(grid);

  if (divider) {
    const or = el('div', 'or-divider');
    or.append(el('span', 'meta-label', divider));
    wrap.append(or);
  }
  block.append(wrap);
}
