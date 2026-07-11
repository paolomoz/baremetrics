/**
 * toc — article sticky rail: Table of Contents + More Articles ("The Ledger").
 *
 * Variant: default (the only one). Renders BOTH devices from one authored
 * source, exactly like the prototypes:
 *   - >=901px: sticky hairline-ruled <aside class="toc-rail"> (all groups)
 *   - <=900px: native <details class="toc-disclosure sheet"> (first group
 *     only — the TOC), no JS
 * The article template (templates/article, B4) places the block in its rail
 * grid column; the block itself is self-positioning-agnostic.
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/
 *   blog-customer-retention-metrics.json (article rail),
 *   founder-chats-natalie-nagele.json (transcript rail).
 *
 * Authoring: one row per nav group — cell 1 = the group label ("Table of
 * Contents" / "More Retention Articles"), cell 2 = the links (an authored
 * list or a run of links). The current article's link is wrapped in <strong>
 * (or arrives .btn-decorated by ak.js) and becomes aria-current="page" —
 * never a button.
 */

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

function rowsOf(block) {
  return [...block.children].filter((r) => r.tagName === 'DIV').map((row) => {
    let cells = [...row.children].filter((c) => c.tagName === 'DIV');
    if (!cells.length) cells = [row];
    return { row, cells };
  });
}

function el(tag, cls, txt) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (txt !== undefined) node.textContent = txt;
  return node;
}

export default async function decorate(block) {
  const groups = [];
  rowsOf(block).forEach(({ cells }) => {
    const links = [];
    let label = null;
    cells.forEach((cell) => {
      const cellLinks = [...cell.querySelectorAll('a')];
      if (cellLinks.length) {
        cellLinks.forEach((a) => {
          const strong = a.closest('strong');
          if (strong || a.classList.contains('btn')) {
            a.setAttribute('aria-current', 'page');
            a.classList.remove('btn', 'btn-primary', 'btn-secondary', 'btn-accent');
          }
          links.push(a);
        });
      } else if (text(cell) && !label) {
        label = text(cell);
      }
    });
    if (links.length) groups.push({ label, links });
  });

  groups.forEach((g) => g.links.forEach((a) => a.remove()));
  block.textContent = '';

  const isMore = (label) => /more/i.test(label || '');

  const buildList = (links, withArrow) => {
    const ul = el('ul');
    ul.setAttribute('role', 'list');
    links.forEach((a) => {
      const li = el('li');
      if (withArrow && !a.querySelector('[aria-hidden]')) {
        const arrow = el('span', '', ' →');
        arrow.setAttribute('aria-hidden', 'true');
        a.append(arrow);
      }
      li.append(a);
      ul.append(li);
    });
    return ul;
  };

  /* mobile: native disclosure for the first (TOC) group */
  const tocGroup = groups.find((g) => !isMore(g.label)) || groups[0];
  if (tocGroup) {
    const details = el('details', 'toc-disclosure sheet');
    const summary = el('summary');
    summary.append(el('span', 'meta-label', tocGroup.label || 'Table of Contents'));
    details.append(summary);
    const nav = el('nav');
    nav.setAttribute('aria-label', tocGroup.label || 'Table of contents');
    nav.append(buildList(tocGroup.links.map((a) => a.cloneNode(true)), false));
    details.append(nav);
    block.append(details);
  }

  /* desktop: the sticky rail with every group */
  const rail = el('aside', 'toc-rail');
  groups.forEach((g) => {
    const nav = el('nav', isMore(g.label) ? 'more-articles' : 'toc-nav');
    nav.setAttribute('aria-label', g.label || 'Table of contents');
    nav.append(el('p', 'meta-label', g.label || ''));
    nav.append(buildList(g.links, isMore(g.label)));
    rail.append(nav);
  });
  block.append(rail);
}
