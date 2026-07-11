/**
 * calculator — the ltv-calc inert instrument ("The Ledger" design system).
 *
 * Template-slotted bespoke block (#95): the block JS owns the prototype
 * section DOM verbatim (document sheet, import row, inert switches, the
 * Metric × Jan–Aug readonly table in a keyboard-reachable scroll region,
 * formula ledger row, results trio, blank ruled Revenue Distribution panel,
 * ONE sr-note) and slots the authored values/labels by role.
 *
 * ENCODE/DECODE contract (#93):
 *   ../baremetrics/stardust/eds-schema/ltv-calc.json (calculator-sheet)
 *
 * Authored rows (classified by CONTENT, never hard indexes — #48/#62; the
 * only ordering requirement is that the table HEADER row precedes its metric
 * rows, mirroring how a table reads):
 *   - 1 cell with h2 (+ p)        → sheet head (h2 + sub)
 *   - 1 cell with h3 + p          → metrics-input intro
 *   - 1 cell with h3 only         → Revenue Distribution head
 *   - 1 cell with 2 paragraphs    → Import Spreadsheet row (label + note)
 *   - 1 cell short text           → an inert switch label (one row per switch)
 *   - 9 cells, no digits          → table header (Metric + month columns)
 *   - 9 cells, digits             → a metric row (label + 8 monthly values)
 *   - 2 cells                     → formula ledger row (label + formula)
 *   - 3 cells                     → a result (label + figure + empty-state cap)
 *
 * Everything is INERT: switches are role=switch aria-checked=false
 * aria-readonly=true; inputs are readonly; the ONE sr-note ("calculator
 * computation active at launch") is template-owned and wired via
 * aria-describedby to the sheet and every switch.
 */

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

/* cell-cascade collector (#62/#68/#71) */
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

function buildSwitch(label, describedBy) {
  const btn = el('button', 'toggle-switch', label);
  btn.type = 'button';
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', 'false');
  btn.setAttribute('aria-readonly', 'true');
  btn.setAttribute('aria-describedby', describedBy);
  const track = el('span', 'toggle-track');
  track.setAttribute('aria-hidden', 'true');
  track.append(el('span', 'toggle-knob'));
  btn.append(track);
  return btn;
}

export default async function decorate(block) {
  const model = {
    head: null,
    sub: null,
    importLabel: null,
    importNote: null,
    inputsHead: null,
    inputsSub: null,
    switches: [],
    header: [], /* Metric + month column labels */
    metrics: [], /* { label, values[] } */
    formulaLabel: null,
    formula: null,
    results: [], /* { label, figure, caption } */
    revdist: null,
  };

  rowsOf(block).forEach(({ cells }) => {
    const texts = cells.map(text);
    if (cells.length >= 9) {
      if (!model.header.length && !/\d/.test(texts.slice(1).join(''))) {
        model.header = texts;
      } else {
        model.metrics.push({ label: texts[0], values: texts.slice(1) });
      }
      return;
    }
    if (cells.length === 3) {
      model.results.push({ label: texts[0], figure: texts[1], caption: texts[2] });
      return;
    }
    if (cells.length === 2) {
      [model.formulaLabel, model.formula] = texts;
      return;
    }
    /* single-cell rows */
    const cell = cells[0];
    const h2 = cell.querySelector('h2');
    const h3 = cell.querySelector('h3');
    if (h2) {
      model.head = h2;
      model.sub = [...cell.children].find((n) => n !== h2 && text(n)) || null;
      return;
    }
    if (h3) {
      const p = [...cell.children].find((n) => n !== h3 && text(n));
      if (p) {
        model.inputsHead = h3;
        model.inputsSub = p;
      } else {
        model.revdist = h3;
      }
      return;
    }
    const ps = [...cell.children].filter((n) => text(n));
    if (ps.length >= 2) {
      [model.importLabel, model.importNote] = ps;
      return;
    }
    if (texts[0]) model.switches.push(texts[0]);
  });

  /* detach retained live nodes BEFORE wiping the block */
  [model.head, model.sub, model.importLabel, model.importNote,
    model.inputsHead, model.inputsSub, model.revdist]
    .forEach((n) => n && n.remove());
  block.textContent = '';

  /* — the template: prototype calculator-sheet DOM, authored values slotted — */
  const wrap = el('div', 'calculator-wrap');
  block.append(wrap);

  const sheet = el('div', 'sheet calc-sheet');
  sheet.setAttribute('role', 'group');
  sheet.setAttribute('aria-labelledby', 'calc-title');
  sheet.setAttribute('aria-describedby', 'calc-note');
  wrap.append(sheet);

  /* the ONE sr-note — template-owned, aria-describedby target */
  const note = el('p', 'visually-hidden', 'calculator computation active at launch');
  note.id = 'calc-note';
  sheet.append(note);

  if (model.head) {
    const head = el('div', 'calc-head');
    model.head.id = 'calc-title';
    head.append(model.head);
    if (model.sub) {
      model.sub.className = 'calc-sub';
      head.append(model.sub);
    }
    sheet.append(head);
  }

  if (model.importLabel) {
    const imp = el('div', 'calc-import');
    model.importLabel.className = 'calc-import-label';
    imp.append(model.importLabel);
    if (model.importNote) {
      model.importNote.className = 'calc-import-note';
      imp.append(model.importNote);
    }
    sheet.append(imp);
  }

  const inputs = el('div', 'calc-inputs');
  sheet.append(inputs);
  if (model.inputsHead) inputs.append(model.inputsHead);
  if (model.inputsSub) {
    model.inputsSub.className = 'calc-inputs-sub';
    inputs.append(model.inputsSub);
  }

  if (model.switches.length) {
    const toggles = el('div', 'calc-toggles');
    toggles.setAttribute('role', 'group');
    toggles.setAttribute('aria-label', 'Calculator options');
    model.switches.forEach((s) => toggles.append(buildSwitch(s, 'calc-note')));
    inputs.append(toggles);
  }

  if (model.header.length && model.metrics.length) {
    const scroll = el('div', 'metrics-scroll');
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', model.inputsHead ? text(model.inputsHead) : 'Metrics input');
    scroll.setAttribute('tabindex', '0');
    const table = el('table', 'metrics');
    const thead = el('thead');
    const headRow = el('tr');
    model.header.forEach((h) => {
      const th = el('th', '', h);
      th.setAttribute('scope', 'col');
      headRow.append(th);
    });
    thead.append(headRow);
    table.append(thead);
    const tbody = el('tbody');
    const months = model.header.slice(1);
    model.metrics.forEach((m) => {
      const tr = el('tr');
      const th = el('th', '', m.label);
      th.setAttribute('scope', 'row');
      tr.append(th);
      m.values.forEach((v, i) => {
        const td = el('td');
        const label = el('label');
        label.append(el('span', 'visually-hidden', `${m.label}, ${months[i] || ''}`.trim()));
        const input = el('input', 'cell-input');
        input.type = 'text';
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('value', v);
        input.readOnly = true;
        input.setAttribute('aria-readonly', 'true');
        label.append(input);
        td.append(label);
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);
    scroll.append(table);
    inputs.append(scroll);
  }

  if (model.formula) {
    const row = el('div', 'formula-row');
    row.append(el('p', 'meta-label', model.formulaLabel || 'Formula'));
    const p = el('p');
    const data = el('data', 'figure formula-fig', model.formula);
    data.setAttribute('value', model.formula);
    p.append(data);
    row.append(p);
    sheet.append(row);
  }

  if (model.results.length) {
    const dl = el('dl', 'results');
    model.results.forEach((r, i) => {
      const div = el('div', i === model.results.length - 1 ? 'result result-pull' : 'result');
      div.append(el('dt', '', r.label));
      const fig = el('dd', 'result-fig');
      const data = el('data', 'figure', r.figure);
      data.setAttribute('value', r.figure.replace(/[^0-9.]/g, '') || r.figure);
      fig.append(data);
      div.append(fig);
      if (r.caption) div.append(el('dd', 'result-cap', r.caption));
      dl.append(div);
    });
    sheet.append(dl);
  }

  if (model.revdist) {
    const rev = el('div', 'revdist');
    rev.append(model.revdist);
    const panel = el('div', 'revdist-panel');
    panel.setAttribute('aria-hidden', 'true');
    rev.append(panel);
    sheet.append(rev);
  }
}
