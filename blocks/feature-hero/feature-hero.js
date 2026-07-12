/**
 * feature-hero — template-slotted feature mastheads ("The Ledger").
 *
 * Variants (extra classes on the block):
 *   recover      statement hero on dotted rulings + the captured "$423.77
 *                Recovered · in Rio" document-sheet aside; Recover magenta
 *                tag-chip (chip dot + rulings + sheet chrome are template-
 *                owned; figure/labels/chip text are authored)   (features/recover)
 *   integration  ruled wordmark pairing (baremetrics mark × captured Stripe
 *                wordmark) + verified-badge meta row (white badge on ink chip)
 *                + h1 + lede + CTAs + preview note + window-chromed exhibit
 *                                                               (stripe)
 *   case         feature promo split — tag-chip + h2 + lede + CTAs +
 *                record quote w/ avatar attribution + window-chromed media;
 *                `mirror` docks the media left, `mist` grounds it (stripe
 *                cancellation-insights + recover promos — band `split` was
 *                the preferred device but its decode drops the avatar
 *                attribution row's text; this variant keeps the full anatomy)
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   features-recover.json (hero), stripe.json (integration-masthead,
 *   feature-cancellation-insights, feature-recover).
 *
 * Decode (#62/#48/#79/#72): rows classified by CONTENT — heading row = h1/h2
 * (+ in-cell lede); rows whose links are ALL strong/em-wrapped = CTA cells
 * (cloned, ak.js decoration preserved); a link row with surrounding text =
 * the preview note; short-text rows = chip/eyebrow/labels; figure-pattern row
 * = the sheet figure; media rows = pair (2 imgs) / badge (small img) /
 * exhibit (large img) / avatar-attribution (img + text).
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

function el(tag, cls, txt) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (txt !== undefined) node.textContent = txt;
  return node;
}

function win(img) {
  const w = el('div', 'win');
  const bar = el('div', 'win-bar');
  bar.setAttribute('aria-hidden', 'true');
  bar.append(el('span'), el('span'), el('span'));
  w.append(bar, img);
  return w;
}

/* the feature-coding chip — the dot is template-owned chrome */
function chip(txt) {
  const c = el('p', 'tag-chip meta-label', txt);
  if (/cancel/i.test(txt)) c.dataset.feature = 'cancellation';
  else if (/recover/i.test(txt)) c.dataset.feature = 'recover';
  return c;
}

/* a row is a CTA row when its only text is link labels; loose prose around a
   link makes it a note row instead (robust to ak.js's strong→.btn rewrite) */
function isActionRow(row) {
  const links = [...row.querySelectorAll('a')];
  if (!links.length) return false;
  let t = text(row);
  links.forEach((a) => { t = t.replace(text(a), ''); });
  return !t.replace(/[\s.,·]+/g, '');
}

export default async function decorate(block) {
  const variant = ['integration', 'case'].find((v) => block.classList.contains(v)) || 'recover';

  const model = {
    heading: null,
    ledes: [],
    actionCells: null,
    note: null,
    shorts: [], // chip / eyebrow / sheet labels, in authored order
    figure: null,
    pairImgs: [],
    badgeImg: null,
    exhibitImg: null,
    avatarImg: null,
    citeText: null,
    quote: null,
  };
  let actionsSeen = false;

  rowsOf(block).forEach(({ row, cells }) => {
    const heading = row.querySelector('h1, h2, h3');
    if (heading) {
      model.heading = heading;
      cells.forEach((c) => [...c.children].forEach((n) => {
        if (n !== heading && text(n)) model.ledes.push(n);
      }));
      return;
    }
    if (MEDIA(row)) {
      const imgs = [...row.querySelectorAll('img')];
      const texts = cells.filter((c) => !MEDIA(c)).map(text).filter(Boolean);
      if (imgs.length >= 2) { model.pairImgs = imgs; return; }
      if (texts.length) {
        /* avatar + attribution (case) */
        [model.avatarImg] = imgs;
        model.citeText = texts.join(' ');
        return;
      }
      const w = parseInt(imgs[0].getAttribute('width') || '0', 10);
      if (w && w <= 300) [model.badgeImg] = imgs;
      else [model.exhibitImg] = imgs;
      return;
    }
    if (row.querySelector('a')) {
      if (isActionRow(row)) {
        model.actionCells = cells;
        actionsSeen = true;
      } else {
        /* prose note with an inline link (integration preview note).
           DA unwraps a single-text cell's <p> to a bare <div> (#79), so when
           there's no <p>, MOVE the cell's child nodes (incl. the <a>) into a
           new <p> — never text(cell), which would drop the inline link. */
        let np = cells[0].querySelector('p');
        if (!np) { np = el('p'); while (cells[0].firstChild) np.append(cells[0].firstChild); }
        model.note = np;
      }
      return;
    }
    const texts = cells.map(text).filter(Boolean);
    if (!texts.length) return;
    if (texts.length === 1 && /^~?\$[\d,.]+$/.test(texts[0])) { [model.figure] = texts; return; }
    texts.forEach((t) => {
      if (t.length <= 48) model.shorts.push(t);
      else if (actionsSeen && !model.quote) model.quote = t; /* case record quote */
      else model.ledes.push(el('p', '', t));
    });
  });

  /* detach retained nodes before wiping */
  const kept = [model.heading, ...model.ledes, model.note,
    ...model.pairImgs, model.badgeImg, model.exhibitImg, model.avatarImg].filter(Boolean);
  kept.forEach((n) => n.remove && n.remove());
  const actionEls = model.actionCells
    ? model.actionCells.flatMap((c) => [...c.childNodes].filter((n) => n.nodeType === 1))
    : [];
  actionEls.forEach((n) => n.remove());
  block.textContent = '';

  const wrap = el('div', 'fh-wrap');
  block.append(wrap);

  if (variant === 'recover') {
    const rulings = el('div', 'hero-rulings');
    rulings.setAttribute('aria-hidden', 'true');
    rulings.append(el('i'), el('i'), el('i'));
    block.prepend(rulings);

    const row = el('div', 'hero-row');
    wrap.append(row);
    const copy = el('div', 'hero-copy');
    row.append(copy);
    if (model.heading) copy.append(model.heading);
    model.ledes.forEach((p) => { p.className = 'hero-lede'; copy.append(p); });
    if (actionEls.length) {
      const ctas = el('div', 'hero-ctas');
      actionEls.forEach((n) => ctas.append(n));
      copy.append(ctas);
    }

    const [chipText, ...labels] = model.shorts;
    const aside = el('aside', 'sheet stat-sheet');
    aside.setAttribute('aria-label', 'Recovered payment record — the captured Recover stat card');
    if (chipText) aside.append(chip(chipText));
    if (labels.length) {
      const head = el('div', 'stat-head');
      labels.forEach((t) => head.append(el('span', 'meta-label', t)));
      aside.append(head);
    }
    if (model.figure) {
      const data = el('data', 'figure', model.figure);
      data.setAttribute('value', model.figure.replace(/[^0-9.]/g, ''));
      aside.append(data);
    }
    row.append(aside);
    return;
  }

  if (variant === 'integration') {
    const handshake = el('p', 'handshake');
    const pair = el('span', 'handshake-pair');
    if (model.pairImgs[0]) {
      model.pairImgs[0].classList.add('handshake-bm');
      pair.append(model.pairImgs[0]);
    }
    const x = el('span', 'handshake-x', '×');
    x.setAttribute('aria-hidden', 'true');
    pair.append(x);
    if (model.pairImgs[1]) {
      model.pairImgs[1].classList.add('handshake-stripe');
      pair.append(model.pairImgs[1]);
    }
    handshake.append(pair);
    if (model.badgeImg) {
      const badge = el('span', 'handshake-verified verified-chip');
      badge.append(model.badgeImg);
      handshake.append(' ', badge);
    }
    wrap.append(handshake);

    const grid = el('div', 'masthead-grid');
    wrap.append(grid);
    const copy = el('div', 'masthead-copy');
    grid.append(copy);
    if (model.shorts.length) copy.append(el('p', 'meta-label masthead-kicker', model.shorts[0]));
    if (model.heading) copy.append(model.heading);
    model.ledes.forEach((p) => { p.className = 'masthead-lede'; copy.append(p); });
    if (actionEls.length) {
      const ctas = el('div', 'masthead-ctas');
      actionEls.forEach((n) => ctas.append(n));
      copy.append(ctas);
    }
    if (model.note) {
      model.note.className = 'preview-note';
      copy.append(model.note);
    }
    if (model.exhibitImg) {
      const media = el('div', 'masthead-media');
      media.append(win(model.exhibitImg));
      grid.append(media);
    }
    return;
  }

  /* case — feature promo split */
  const grid = el('div', 'case-grid');
  wrap.append(grid);
  const copy = el('div', 'case-copy');
  grid.append(copy);
  if (model.shorts.length) copy.append(chip(model.shorts[0]));
  if (model.heading) copy.append(model.heading);
  model.ledes.forEach((p) => { p.className = 'section-lede'; copy.append(p); });
  if (actionEls.length) {
    const ctas = el('div', 'feature-ctas');
    actionEls.forEach((n) => ctas.append(n));
    /* the un-wrapped link is the prototype's quiet .ds-link */
    ctas.querySelectorAll('a').forEach((a) => {
      if (!a.closest('strong, em') && !a.classList.contains('btn')) a.classList.add('ds-link');
    });
    copy.append(ctas);
  }
  if (model.quote) {
    const fig = el('figure', 'case-quote');
    const bq = el('blockquote');
    bq.append(el('p', '', model.quote));
    fig.append(bq);
    if (model.avatarImg || model.citeText) {
      const cap = el('figcaption', 'quote-attrib');
      if (model.avatarImg) cap.append(model.avatarImg);
      if (model.citeText) cap.append(el('cite', '', model.citeText));
      fig.append(cap);
    }
    copy.append(fig);
  }
  if (model.exhibitImg) {
    const media = el('div', 'case-media');
    media.append(win(model.exhibitImg));
    grid.append(media);
  }
}
