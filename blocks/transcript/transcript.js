/**
 * transcript — founder-chats speaker-turn ledger (reconstructive tier).
 *
 * The 142 captured dialogue paragraphs hang on ONE hairline spine; a turn
 * begins at every paragraph whose leading <strong>Speaker:</strong> prefix is
 * preserved verbatim from the capture, and unprefixed paragraphs attach to the
 * PRECEDING speaker's turn (the captured grouping — 142 paragraphs → 128
 * turns on founder-chats/natalie-nagele). Turn dots: first distinct speaker =
 * ink (.turn-a), second = periwinkle (.turn-b) — content-derived, so any
 * episode's speaker pair maps without block edits. NO data-anim.
 *
 * ENCODE/DECODE contract (#93):
 *   ../baremetrics/stardust/eds-schema/founder-chats-natalie-nagele.json
 *   (transcript section, DIV.turn ×128).
 *
 * Authoring (decode notes #62/#79 — text read by CELL): ONE ROW PER PARAGRAPH,
 * one cell each, the paragraph HTML byte-verbatim (extracted programmatically,
 * never hand-copied). One-paragraph rows survive DA transport best: each row
 * is an independent table row, so DA cannot merge or resegment the dialogue,
 * and the decode needs no delimiter heuristics — the speaker prefixes ARE the
 * turn boundaries.
 *
 * The block also gives the Wave-A toc block's "More Articles" rail group its
 * captured anchor id (#more-articles) once it decorates — the toc block (not
 * editable by Wave B) renders the nav without an addressable id. Report line
 * filed for the main loop to merge id-setting into toc.js.
 */

const el = (tag, cls) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
};

/* a speaker prefix: a leading <strong> whose text is "Name:" */
function speakerOf(p) {
  const strong = p.querySelector('strong');
  if (!strong) return null;
  const t = (strong.textContent || '').trim();
  const m = /^([^:]{1,40}):$/.exec(t);
  if (!m) return null;
  const lead = (p.textContent || '').trim();
  return lead.startsWith(t) ? m[1].trim().toLowerCase() : null;
}

export default async function decorate(block) {
  const paras = [];
  [...block.children].forEach((row) => {
    if (row.tagName !== 'DIV') return;
    let cells = [...row.children].filter((c) => c.tagName === 'DIV');
    if (!cells.length) cells = [row];
    cells.forEach((cell) => {
      if (cell.querySelector('p')) paras.push(...cell.querySelectorAll('p'));
      else if ((cell.textContent || '').trim()) {
        const p = el('p');
        p.append(...cell.childNodes);
        paras.push(p);
      }
    });
  });

  paras.forEach((p) => p.remove());
  block.textContent = '';

  const speakers = [];
  let turn = null;
  paras.forEach((p) => {
    const speaker = speakerOf(p);
    if (speaker || !turn) {
      const name = speaker || 'speaker';
      if (!speakers.includes(name)) speakers.push(name);
      turn = el('div', `turn ${speakers.indexOf(name) % 2 ? 'turn-b' : 'turn-a'}`);
      turn.dataset.speaker = name;
      block.append(turn);
    }
    turn.append(p);
  });

  /* #93: the captured TOC entry targets #more-articles; the toc block renders
     the rail group without the id. Blocks in a section load in parallel, so
     wait for the rail, then patch the anchor in. */
  let tries = 0;
  const anchorMoreArticles = () => {
    const nav = document.querySelector('.toc .more-articles');
    if (nav) {
      if (!nav.id) nav.id = 'more-articles';
      return;
    }
    tries += 1;
    if (tries < 300) requestAnimationFrame(anchorMoreArticles);
  };
  anchorMoreArticles();
}
