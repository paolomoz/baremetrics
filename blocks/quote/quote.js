/**
 * quote — customer-record testimony ("The Ledger" design system).
 *
 * Variants (extra classes on the block):
 *   sheet   record sheet inline: meta-label rule + blockquote + avatar/cite
 *           (+ optional review-badge image link)          (recover, stripe)
 *     mist  the sheet sits on a mist ground               (stripe)
 *   band    record sheet on an INK band: avatar + quote + wordmark chip
 *                                                          (customers)
 *   trio    testimony trio — window-chromed captured quote images (recover roi)
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   features-recover.json (testimonial, roi), stripe.json (testimonial),
 *   customers.json (testimonial).
 *
 * Decode (#62/#48/#79/#72): rows classified by content — short text = source
 * meta-label; long text = the quote; a row/cell with a small image + short
 * texts = the attribution (avatar, name, role); an image-linked row = the
 * review badge; image-only rows (trio) = window-chromed testimony shots.
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
  const w = el('span', 'win');
  const bar = el('span', 'win-bar');
  bar.setAttribute('aria-hidden', 'true');
  bar.append(el('span'), el('span'), el('span'));
  w.append(bar, img);
  return w;
}

export default async function decorate(block) {
  const isTrio = block.classList.contains('trio');
  const isBand = block.classList.contains('band');

  const model = {
    source: null, quote: null, avatar: null, name: null, role: null,
    badgeImg: null, badgeHref: null, logoImg: null, trioImgs: [],
  };

  rowsOf(block).forEach(({ row, cells }) => {
    if (isTrio) {
      model.trioImgs.push(...row.querySelectorAll('img'));
      return;
    }
    const link = row.querySelector('a');
    const imgs = [...row.querySelectorAll('img')];
    const texts = cells.map(text).filter(Boolean);
    if (link && imgs.length) {
      /* review badge (G2) — an image link */
      [model.badgeImg] = imgs;
      model.badgeHref = link.getAttribute('href');
      return;
    }
    if (imgs.length && texts.length) {
      /* attribution: avatar | name | role */
      [model.avatar] = imgs;
      const t = cells.filter((c) => !MEDIA(c)).map(text).filter(Boolean);
      [model.name, model.role] = t;
      return;
    }
    if (imgs.length) {
      /* image-only: band wordmark chip (small) or avatar */
      if (!model.avatar && isBand) [model.avatar] = imgs;
      else [model.logoImg] = imgs;
      return;
    }
    texts.forEach((t) => {
      if (!model.source && t.length <= 48 && !model.quote) model.source = t;
      else if (!model.quote) model.quote = t;
      else if (!model.name) model.name = t;
      else if (!model.role) model.role = t;
    });
  });

  const keepImgs = [model.avatar, model.badgeImg, model.logoImg, ...model.trioImgs].filter(Boolean);
  keepImgs.forEach((n) => n.remove());
  block.textContent = '';

  const wrap = el('div', 'quote-wrap');
  block.append(wrap);

  if (isTrio) {
    const ul = el('ul', 'quote-trio');
    ul.setAttribute('role', 'list');
    model.trioImgs.forEach((img) => {
      const li = el('li');
      li.append(win(img));
      ul.append(li);
    });
    wrap.append(ul);
    return;
  }

  const sheet = el('figure', isBand ? 'sheet fp-sheet' : 'sheet record-sheet');
  wrap.append(sheet);

  if (isBand) {
    if (model.avatar) {
      model.avatar.classList.add('fp-avatar');
      model.avatar.alt = model.avatar.alt || '';
      sheet.append(model.avatar);
    }
    const body = el('div');
    const bq = el('blockquote');
    bq.append(el('p', '', model.quote || ''));
    body.append(bq);
    if (model.logoImg) {
      const chip = el('span', 'fp-logo-chip');
      model.logoImg.classList.add('fp-logo');
      chip.append(model.logoImg);
      body.append(chip);
    }
    sheet.append(body);
    return;
  }

  if (model.source) sheet.append(el('span', 'meta-label', model.source));
  const bq = el('blockquote');
  bq.append(el('p', '', model.quote || ''));
  sheet.append(bq);
  if (model.name || model.avatar) {
    const attrib = el('div', 'testimonial-attrib');
    if (model.avatar) attrib.append(model.avatar);
    const cite = el('cite', '', `${model.name || ''} `);
    if (model.role) cite.append(el('span', '', model.role));
    attrib.append(cite);
    sheet.append(attrib);
  }
  if (model.badgeImg) {
    const p = el('div');
    const a = el('a', 'testimonial-g2');
    if (model.badgeHref) a.href = model.badgeHref;
    a.append(model.badgeImg);
    p.append(a);
    sheet.append(p);
  }
}
