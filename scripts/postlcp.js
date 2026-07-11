import { getConfig } from './ak.js';

// Language of the current page from its path prefix (DE is the default tree).
function currentLang() {
  const seg = window.location.pathname.split('/')[1];
  return (seg === 'fr' || seg === 'en') ? seg : 'de';
}

async function loadStaticFragment(name) {
  const el = document.querySelector(name);
  if (!el) return;
  const { codeBase } = getConfig();
  // Language-prefixed nav: /fr/… and /en/… pages load their own fragment;
  // everything else uses the default (DE). Fall back to default if absent.
  const lang = currentLang();
  const prefix = lang === 'de' ? '' : `${lang}/`;
  let resp = await fetch(`${codeBase}/fragments/${prefix}${name}.html`);
  if (!resp.ok && prefix) resp = await fetch(`${codeBase}/fragments/${name}.html`);
  if (!resp.ok) return;
  const html = await resp.text();
  el.className = name; // so header.header / footer.footer selectors match
  el.innerHTML = html;
}

/* ---------------------------------------------------------------- *
 * Language switcher
 * ---------------------------------------------------------------- */

// Per-language landing the switcher uses when no migrated equivalent of the
// current page exists in the target language.
const LANG_HOME = { de: '/', fr: '/fr/corporate/home', en: '/en/corporate/home' };

// Repoint the header language switcher so each language link goes to the SAME
// page in that language (when it has been migrated), falling back to that
// language's home otherwise. Paths are fully localized across DE/FR/EN, so the
// equivalence comes from /translations.json (built from source hreflang groups).
async function decorateLangSwitcher() {
  const links = document.querySelectorAll('header .lang a');
  if (!links.length) return;
  const { codeBase } = getConfig();

  const here = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  let group;
  try {
    const resp = await fetch(`${codeBase}/translations.json`);
    if (resp.ok) group = (await resp.json())[here];
  } catch { /* no map → every link uses its language home */ }

  links.forEach((a) => {
    const lang = a.textContent.trim().toLowerCase();
    if (!['de', 'fr', 'en'].includes(lang)) return;
    if (a.getAttribute('aria-current') === 'true') return; // current language: leave as-is
    const target = (group && group[lang]) || LANG_HOME[lang];
    if (target) a.href = target;
  });
}

/* ---------------------------------------------------------------- *
 * Header search (site-wide, client-side over the per-language index)
 * ---------------------------------------------------------------- */

const SEARCH_INDEX = {
  de: '/de/search-index.json',
  fr: '/fr/search-index.json',
  en: '/en/search-index.json',
};

const SEARCH_UI = {
  de: { hint: 'Mindestens 2 Zeichen eingeben', none: 'Keine Ergebnisse für' },
  fr: { hint: 'Saisissez au moins 2 caractères', none: 'Aucun résultat pour' },
  en: { hint: 'Type at least 2 characters', none: 'No results for' },
};

// Path → human category, by language. First match wins; no match → no chip.
const SEARCH_CATS = [
  [/\/(aerzte|doctors)\//, { de: 'Arzt', fr: 'Médecin', en: 'Doctor' }],
  [/\/(behandlungen|traitements|treatments)\//, { de: 'Behandlung', fr: 'Traitement', en: 'Treatment' }],
  [/\/(fachgebiete|specialites-medicales|specialities)\//, { de: 'Fachgebiet', fr: 'Spécialité', en: 'Speciality' }],
  [/\/(krankheitsbilder|description-pathologies|disease-patterns)\//, { de: 'Krankheitsbild', fr: 'Maladie', en: 'Disease' }],
  [/(medien-und-news|news-media|media-news)/, { de: 'News', fr: 'Actualité', en: 'News' }],
  [/\/(kurse-veranstaltungen|cours-et-evenements|courses-events)\//, { de: 'Veranstaltung', fr: 'Événement', en: 'Event' }],
  [/\/home$/, { de: 'Klinik', fr: 'Clinique', en: 'Hospital' }],
];

const MIN_QUERY = 2;
const MAX_RESULTS = 8;
const FETCH_LIMIT = 1000;

const normalize = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function categoryOf(path, lang) {
  const hit = SEARCH_CATS.find(([re]) => re.test(path));
  return hit ? hit[1][lang] : '';
}

async function fetchSearchIndex(lang) {
  const rows = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetch(`${SEARCH_INDEX[lang]}?limit=${FETCH_LIMIT}&offset=${offset}`);
    if (!resp.ok) break;
    // eslint-disable-next-line no-await-in-loop
    const json = await resp.json();
    rows.push(...(json.data || []));
    total = json.total ?? rows.length;
    offset += FETCH_LIMIT;
    if (!json.data || !json.data.length) break;
  }
  return rows
    .filter((r) => r.title)
    .map((r) => ({ ...r, nt: normalize(r.title), nd: normalize(r.description) }));
}

// Rank: title prefix < title substring < description substring; tie-break shorter title.
function searchRows(rows, query) {
  const nq = normalize(query);
  const scored = [];
  for (const r of rows) {
    const ti = r.nt.indexOf(nq);
    let score = -1;
    if (ti === 0) score = 0;
    else if (ti > 0) score = 1;
    else if (r.nd.includes(nq)) score = 2;
    if (score >= 0) scored.push({ r, score });
  }
  scored.sort((a, b) => a.score - b.score || a.r.title.length - b.r.title.length);
  return scored.slice(0, MAX_RESULTS).map((s) => s.r);
}

function decorateHeaderSearch() {
  const toggle = document.querySelector('header .icon-search');
  const panel = document.querySelector('header #header-search');
  if (!toggle || !panel) return;
  const form = panel.querySelector('.header-search-form');
  const input = panel.querySelector('input[type="search"]');
  const results = panel.querySelector('.header-search-results');
  const lang = currentLang();
  const ui = SEARCH_UI[lang];

  let index;
  let active = -1;

  const status = (msg) => { results.innerHTML = `<p class="header-search-status">${msg}</p>`; };

  const open = () => {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();
    if (!index) fetchSearchIndex(lang).then((rows) => { index = rows; });
  };
  const close = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    active = -1;
  };

  const setActive = (next) => {
    const items = [...results.querySelectorAll('a')];
    if (!items.length) return;
    active = (next + items.length) % items.length;
    items.forEach((a, i) => a.classList.toggle('is-active', i === active));
    items[active].scrollIntoView({ block: 'nearest' });
  };

  const render = (rows, query) => {
    active = -1;
    if (!rows.length) { status(`${ui.none} „${query}“`); return; }
    results.innerHTML = '';
    rows.forEach((r) => {
      const a = document.createElement('a');
      a.href = r.path;
      a.setAttribute('role', 'option');
      const cat = categoryOf(r.path, lang);
      a.innerHTML = `<span class="hsr-title">${r.title}</span>${cat ? `<span class="hsr-cat">${cat}</span>` : ''}`;
      results.append(a);
    });
  };

  const run = () => {
    const q = input.value.trim();
    if (q.length < MIN_QUERY) { status(ui.hint); return; }
    if (!index) { fetchSearchIndex(lang).then((rows) => { index = rows; run(); }); return; }
    render(searchRows(index, q), q);
  };

  toggle.addEventListener('click', () => (panel.hidden ? open() : close()));

  let debounce;
  input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(run, 140); });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Escape') { close(); toggle.focus(); }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const items = [...results.querySelectorAll('a')];
    const target = items[active] || items[0];
    if (target) window.location.assign(target.href);
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !toggle.contains(e.target)) close();
  });
}

export default async function loadPostLCP() {
  await Promise.all([
    loadStaticFragment('header'),
    loadStaticFragment('footer'),
  ]);
  await decorateLangSwitcher();
  decorateHeaderSearch();
}
