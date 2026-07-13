/**
 * cards — record cards and partitioned canvases ("The Ledger" design system).
 *
 * Variants (extra classes on the block):
 *   cases      customers — window-chromed 2-col ruled grid (+ optional
 *              newsroom lead unit when a row carries an h2)
 *   triptych   home/stripe — 3 hairline columns, whole-column links
 *   mosaic     home/stripe — ONE hairline canvas, dotted partitions (a b / a c)
 *   roster     about — team list rows (photo/monogram | name | role | mailto)
 *   filmstrip  home — scroll-snap tile rail (no JS)
 *   cohort     accelerator — hairline-ruled company grid (logo tile | industry
 *              chip + name + blurb | external "learn more" link). The logo
 *              tile's captured background rides a <code> color in the logo cell
 *              (DA preserves <code>) so light-on-dark marks stay legible.
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   customers.json (lead-story + case-ledger), stripe.json (growth-triptych +
 *   insight-mosaic), about.json (team-roster), home-B.json (dashboard-proof,
 *   growth-drivers, open-startups filmstrip).
 *
 * Decode discipline (#62/#48/#52/#79/#72/#76/#55): cells classified by content
 * (media / heading level / link / short text); meta-labels are the short texts
 * BEFORE the unit heading in its cell (buffered, #76); one row per unit.
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

/* window chrome (.win/.win-bar are foundation primitives) */
function win(img) {
  const w = el('span', 'win');
  const bar = el('span', 'win-bar');
  bar.setAttribute('aria-hidden', 'true');
  bar.append(el('span'), el('span'), el('span'));
  w.append(bar, img);
  return w;
}

function parseUnit(cells) {
  const u = {
    imgs: [], heading: null, metas: [], paras: [], link: null, linkText: '', lists: [], code: '',
  };
  cells.forEach((cell) => {
    const codeEl = cell.querySelector && cell.querySelector('code');
    if (codeEl) u.code = text(codeEl);
    if (MEDIA(cell)) {
      u.imgs.push(...cell.querySelectorAll('img'));
      return;
    }
    const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
    const link = cell.querySelector('a');
    if (heading) {
      u.heading = heading;
      let before = true;
      [...cell.children].forEach((n) => {
        if (n === heading) { before = false; return; }
        if (n.matches('ul, ol')) u.lists.push(n);
        else if (!text(n)) { /* skip */ }
        else if (before && text(n).length <= 48) u.metas.push(n); /* pre-heading eyebrow (#76) */
        else u.paras.push(n);
      });
      return;
    }
    if (link && !MEDIA(cell)) {
      u.link = link;
      u.linkText = text(link);
      return;
    }
    [...cell.children].forEach((n) => {
      if (n.matches && n.matches('ul, ol')) u.lists.push(n);
      else if (text(n)) (text(n).length <= 48 ? u.metas : u.paras).push(n);
    });
  });
  return u;
}

function go(label) {
  const span = el('span', 'go', label);
  const arrow = el('span', '', ' →');
  arrow.setAttribute('aria-hidden', 'true');
  span.append(arrow);
  return span;
}

function buildCase(u) {
  const isLead = u.heading && u.heading.tagName === 'H2';
  const article = el('article', isLead ? 'case-lead' : 'entry');
  const a = el('a', isLead ? 'surface-link lead-link' : 'surface-link entry-link');
  if (u.link) a.href = u.link.getAttribute('href') || '#';
  if (u.heading) a.setAttribute('aria-label', text(u.heading));
  const [shot, avatar] = u.imgs;
  if (isLead) {
    const wrapEl = el('div', 'lead-wrap');
    if (shot) wrapEl.append(win(shot));
    const copy = el('div', 'lead-copy');
    u.metas.forEach((m) => { m.className = 'meta-label'; appendSpaced(copy, m); });
    appendSpaced(copy, u.heading);
    u.paras.forEach((p) => { p.className = 'lead-teaser'; appendSpaced(copy, p); });
    const foot = el('p', 'lead-foot');
    appendSpaced(foot, go(u.linkText || 'Continue Reading'));
    if (avatar) { avatar.alt = avatar.alt || ''; foot.append(' ', avatar); }
    copy.append(' ', foot);
    wrapEl.append(copy);
    a.append(wrapEl);
  } else {
    if (shot) appendSpaced(a, win(shot));
    u.metas.forEach((m) => { m.className = 'meta-label'; appendSpaced(a, m); });
    appendSpaced(a, u.heading);
    u.paras.forEach((p) => { p.className = 'entry-teaser'; appendSpaced(a, p); });
    const arrow = el('span', 'entry-arrow', '→');
    arrow.setAttribute('aria-hidden', 'true');
    appendSpaced(a, arrow);
  }
  article.append(a);
  return article;
}

function buildTriptychCol(u) {
  const a = el(u.link ? 'a' : 'div', 'tript-col');
  if (u.link) {
    a.classList.add('surface-link');
    a.href = u.link.getAttribute('href') || '#';
    if (u.heading) a.setAttribute('aria-label', text(u.heading));
  }
  if (u.heading) appendSpaced(a, u.heading);
  [...u.metas, ...u.paras].forEach((p) => { p.removeAttribute('class'); appendSpaced(a, p); });
  if (u.linkText) appendSpaced(a, go(u.linkText));
  if (u.imgs[0]) appendSpaced(a, win(u.imgs[0]));
  return a;
}

function buildPanel(u, idx) {
  const cls = `panel panel-${['a', 'b', 'c'][idx] || 'c'}`;
  const a = el(u.link ? 'a' : 'div', u.link ? `${cls} surface-link` : cls);
  if (u.link) {
    a.href = u.link.getAttribute('href') || '#';
    if (u.heading) a.setAttribute('aria-label', text(u.heading));
  }
  if (u.heading) appendSpaced(a, u.heading);
  [...u.metas, ...u.paras].forEach((p) => { p.removeAttribute('class'); appendSpaced(a, p); });
  if (u.imgs[0]) {
    const frag = el('span', 'chart-frag');
    frag.append(u.imgs[0]);
    appendSpaced(a, frag);
  }
  if (u.linkText) appendSpaced(a, go(u.linkText));
  return a;
}

function buildPerson(u) {
  const li = el('li', 'person');
  let metas = [...u.metas];
  if (u.imgs[0]) {
    u.imgs[0].className = 'person-photo';
    li.append(u.imgs[0]);
  } else {
    /* captured no-portrait behaviour: monogram tile — an authored 2-letter
       cell, else initials generated from the name (chrome, aria-hidden) */
    const monoIdx = metas.findIndex((m) => /^[A-Z]{2}$/.test(text(m)));
    const initials = monoIdx >= 0 ? text(metas[monoIdx])
      : (u.heading ? text(u.heading).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '');
    if (monoIdx >= 0) metas = metas.filter((_, i) => i !== monoIdx);
    const tile = el('span', 'person-monogram', initials);
    tile.setAttribute('aria-hidden', 'true');
    li.append(tile);
  }
  const id = el('div', 'person-id');
  if (u.heading) appendSpaced(id, u.heading);
  [...metas, ...u.paras].forEach((m) => { m.className = 'meta-label'; appendSpaced(id, m); });
  if (u.link) {
    u.link.className = 'person-mail';
    appendSpaced(id, u.link);
  }
  li.append(' ', id);
  return li;
}

function buildCohort(u) {
  const article = el('article', 'cohort-card');
  const a = el('a', 'surface-link cohort-link');
  if (u.link) {
    a.href = u.link.getAttribute('href') || '#';
    a.target = '_blank';
    a.rel = 'noopener';
  }
  if (u.heading) a.setAttribute('aria-label', `Learn more about ${text(u.heading)}`);
  if (u.imgs[0]) {
    const tile = el('span', 'cohort-logo');
    if (u.code) tile.style.background = u.code;
    u.imgs[0].loading = 'lazy';
    tile.append(u.imgs[0]);
    a.append(tile);
  }
  const copy = el('div', 'cohort-copy');
  u.metas.forEach((m) => { m.className = 'cohort-tag meta-label'; appendSpaced(copy, m); });
  if (u.heading) appendSpaced(copy, u.heading);
  u.paras.forEach((p) => { p.className = 'cohort-blurb'; appendSpaced(copy, p); });
  a.append(copy);
  const arrow = el('span', 'cohort-arrow', '→');
  arrow.setAttribute('aria-hidden', 'true');
  a.append(arrow);
  article.append(a);
  return article;
}

export default async function decorate(block) {
  const variant = ['cases', 'triptych', 'mosaic', 'roster', 'filmstrip', 'cohort']
    .find((v) => block.classList.contains(v)) || 'cases';

  const headEls = absorbedHead(block);
  const rows = rowsOf(block);
  const units = [];
  const headExtra = [];
  rows.forEach(({ cells }) => {
    const isUnit = cells.some((c) => MEDIA(c) || c.querySelector('h1,h2,h3,h4,h5,h6,a'));
    if (!isUnit && cells.length && !units.length) {
      /* short-text head row (counter labels etc.) */
      cells.forEach((c) => { if (text(c)) headExtra.push(text(c)); });
      return;
    }
    units.push(parseUnit(cells));
  });

  const kept = [];
  units.forEach((u) => kept.push(u.heading, ...u.imgs, ...u.metas, ...u.paras, ...u.lists, u.link));
  kept.forEach((n) => n && n.remove && n.remove());
  const headKept = headEls.map((n) => { n.remove(); return n; });
  block.textContent = '';

  const wrap = el('div', 'cards-wrap');
  block.append(wrap);

  if (headKept.length || headExtra.length) {
    const head = el('div', 'cards-head');
    headKept.forEach((n) => {
      if (/^H[1-6]$/.test(n.tagName)) head.append(n);
      else if (n.matches('p') && text(n).length <= 48) { n.className = 'meta-label'; head.prepend(n); } else if (n.querySelector && n.querySelector('a')) { n.className = 'cards-head-link'; head.append(n); } else { n.className = 'section-lede'; head.append(n); }
    });
    headExtra.forEach((t) => head.append(el('p', 'meta-label', t)));
    wrap.append(head);
  }

  if (variant === 'roster') {
    const list = el('ul', 'team-roster');
    list.setAttribute('role', 'list');
    units.forEach((u) => list.append(buildPerson(u)));
    wrap.append(list);
  } else if (variant === 'triptych') {
    const grid = el('div', 'triptych');
    units.forEach((u) => grid.append(buildTriptychCol(u)));
    wrap.append(grid);
  } else if (variant === 'mosaic') {
    const grid = el('div', 'mosaic');
    units.forEach((u, i) => grid.append(buildPanel(u, i)));
    wrap.append(grid);
  } else if (variant === 'cohort') {
    const grid = el('div', 'cohort-grid');
    units.forEach((u) => grid.append(buildCohort(u)));
    wrap.append(grid);
  } else if (variant === 'filmstrip') {
    const rail = el('div', 'film-rail');
    rail.setAttribute('tabindex', '0');
    rail.setAttribute('role', 'region');
    rail.setAttribute('aria-label', 'Company tiles — scroll sideways or use the left and right arrow keys to browse');
    let i = 0;
    units.forEach((u) => u.imgs.forEach((img) => {
      i += 1;
      const fig = el('figure', 'rail-tile');
      fig.dataset.tile = String(((i - 1) % 9) + 1);
      fig.append(img);
      rail.append(fig);
    }));
    wrap.append(rail);
  } else {
    /* cases */
    const grid = el('div', 'case-grid');
    units.forEach((u) => {
      const c = buildCase(u);
      if (c.classList.contains('case-lead')) wrap.insertBefore(c, grid.isConnected ? grid : null);
      else grid.append(c);
    });
    wrap.append(grid);
  }
}
