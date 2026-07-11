/**
 * band — full-bleed statement bands ("The Ledger" design system).
 *
 * Grounds (extra classes): ink | tint | accent | mist   (default: white)
 * Shapes  (extra classes): cta | form | stats | pull | author
 * Modifiers: quiet (section title rendered visually-hidden — help contact),
 *            split (copy + window-chromed media aside — recover trial,
 *                   stripe open-startups)
 *
 * ENCODE/DECODE contract (#93):
 *   ../baremetrics/stardust/eds-schema/open-startups.json (subscribe → tint form)
 *   ../baremetrics/stardust/eds-schema/help.json          (contact-band → tint cta quiet)
 *   (Wave B: features-recover trial-band, compare/stripe/home closing-cta,
 *    about mission-stats + careers, blog-article/founder-chats author-band +
 *    newsletter, ltv-calc trial-cta.)
 *
 * Decode discipline (#62/#48/#52/#79): rows classified by CONTENT —
 *   - link rows       → .band-actions (cell children are CLONED into the
 *                       wrapper so ak.js's strong/em button decoration is
 *                       preserved — never manufacture anchors);
 *   - 2–3 short cells → form row (label [placeholder] button); a 3-cell row
 *                       hides its label (open-startups pattern), a 2-cell row
 *                       shows it (newsletter pattern);
 *   - label|figure pairs (stats shape) → dl.stat-row;
 *   - media rows      → .band-media (.win chrome) / author avatar;
 *   - short text before the heading → eyebrow; after actions → note/coda.
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

function buildForm(cells) {
  const texts = cells.map(text);
  const hasPlaceholder = texts.length >= 3;
  const [labelTxt, placeholder, buttonTxt] = hasPlaceholder
    ? texts : [texts[0], '', texts[1]];
  const form = el('div', 'band-form');
  const label = el('label', hasPlaceholder ? 'visually-hidden' : 'band-form-label', labelTxt);
  label.setAttribute('for', 'band-email');
  const row = el('div', 'band-form-row');
  const input = el('input', 'ds-input');
  input.type = 'email';
  input.id = 'band-email';
  input.autocomplete = 'email';
  if (placeholder) input.placeholder = placeholder;
  const button = el('button', 'band-btn', buttonTxt || 'Subscribe');
  button.type = 'button'; /* inert chrome — non-submitting */
  row.append(input, button);
  form.append(label, row);
  return form;
}

export default async function decorate(block) {
  const isStats = block.classList.contains('stats');
  const isAuthor = block.classList.contains('author');
  const isForm = block.classList.contains('form');
  const quiet = block.classList.contains('quiet');

  const model = {
    eyebrow: null, heading: null, ledes: [], notes: [], actions: null, formCells: null,
    stats: [], media: [], pull: null, coda: null,
  };
  let actionsSeen = false;
  const pushText = (n) => {
    const t = text(n);
    if (!t) return;
    if (!model.eyebrow && !model.ledes.length && !actionsSeen && !model.formCells
      && t.length <= SHORT) model.eyebrow = n;
    else if (actionsSeen || model.formCells) model.notes.push(n);
    else model.ledes.push(n);
  };

  absorbedHead(block).forEach((n) => {
    n.remove();
    if (/^H[1-6]$/.test(n.tagName)) model.heading = n;
    else pushText(n);
  });

  rowsOf(block).forEach(({ row, cells }) => {
    const heading = row.querySelector('h1, h2, h3, h4, h5, h6');
    const links = row.querySelectorAll('a');
    if (heading) {
      model.heading = heading;
      cells.forEach((c) => [...c.children].forEach((n) => { if (n !== heading) pushText(n); }));
      return;
    }
    if (links.length) {
      model.actions = cells;
      actionsSeen = true;
      return;
    }
    if (MEDIA(row)) {
      model.media.push(...row.querySelectorAll('img'));
      return;
    }
    const filled = cells.filter((c) => text(c));
    if (!filled.length) return;
    if (isStats && filled.length >= 2) {
      model.stats.push(filled.map(text));
      return;
    }
    if (isForm && filled.length >= 2) {
      model.formCells = filled;
      return;
    }
    if (filled.length === 2 && actionsSeen) {
      model.coda = filled.map(text);
      return;
    }
    if (block.classList.contains('pull') && /^[\d+×x%$.,—-]+$/.test(text(filled[filled.length - 1]))
      && filled.length >= 1 && text(filled[0]).length <= 8) {
      model.pull = text(filled[0]);
      return;
    }
    filled.forEach((c) => pushText(c.querySelector('p, h2, h3') || el('p', '', text(c))));
  });

  /* detach retained live nodes */
  [model.heading, ...model.ledes, ...model.notes, ...model.media].forEach((n) => n && n.remove());
  const actionCells = model.actions ? model.actions.map((c) => { c.remove(); return c; }) : null;
  const formCells = model.formCells ? model.formCells.map((c) => { c.remove(); return c; }) : null;
  block.textContent = '';

  const wrap = el('div', 'band-wrap');
  block.append(wrap);
  const copy = el('div', 'band-copy');
  wrap.append(copy);

  if (model.eyebrow) {
    model.eyebrow.className = 'meta-label band-eyebrow';
    copy.append(model.eyebrow);
  }
  if (isAuthor && model.media.length) {
    const img = model.media.shift();
    img.className = 'band-avatar';
    copy.classList.add('band-author');
    copy.append(img);
    const authorCol = el('div', 'band-author-copy');
    copy.append(authorCol);
    if (model.eyebrow) authorCol.append(model.eyebrow);
    if (model.heading) authorCol.append(model.heading);
    model.ledes.forEach((p) => { p.className = 'band-bio'; authorCol.append(p); });
  } else {
    if (model.heading) {
      if (quiet) model.heading.classList.add('visually-hidden');
      copy.append(model.heading);
    }
    model.ledes.forEach((p, i) => {
      p.className = (isForm && i === 0 && !model.heading) ? 'band-form-title' : 'band-lede';
      copy.append(p);
    });
    if (isAuthor) {
      /* text-only author strip (blog-article) */
      copy.classList.add('band-author-plain');
    }
  }

  if (model.pull) {
    const fig = el('p', 'figure band-pull', model.pull);
    fig.setAttribute('aria-hidden', 'true');
    wrap.append(fig);
    block.classList.add('has-pull');
  }

  if (isStats && model.stats.length) {
    const dl = el('dl', 'stat-row');
    model.stats.forEach(([label, figure, note]) => {
      const stat = el('div', 'stat');
      stat.append(el('dt', '', label));
      const dd = el('dd');
      dd.append(el('span', 'figure', figure || '—'));
      if (note) dd.append(el('span', 'visually-hidden', note));
      stat.append(dd);
      dl.append(stat);
    });
    copy.append(dl);
  }

  if (actionCells) {
    const actions = el('div', 'band-actions');
    /* clone cell children — ak.js's strong/em → .btn decoration must survive */
    actionCells.forEach((c) => actions.append(...c.childNodes));
    actions.querySelectorAll('p').forEach((p) => {
      if (!p.textContent.trim() && !p.children.length) p.remove();
      else if (p.querySelector('a')) {
        p.classList.add('btn-group');
      }
    });
    copy.append(actions);
  }
  model.notes.forEach((n) => { n.className = 'band-note'; copy.append(n); });

  if (formCells) copy.append(buildForm(formCells));

  if (model.media.length) {
    const media = el('div', 'band-media');
    model.media.forEach((img) => {
      const win = el('span', 'win');
      const bar = el('span', 'win-bar');
      bar.setAttribute('aria-hidden', 'true');
      bar.append(el('span'), el('span'), el('span'));
      win.append(bar, img);
      media.append(win);
    });
    wrap.append(media);
  }

  if (model.coda) {
    const coda = el('div', 'band-coda');
    coda.append(el('p', 'meta-label', model.coda[0]), el('p', '', model.coda[1]));
    wrap.append(coda);
  }
}
