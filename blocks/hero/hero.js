/**
 * hero — home statement hero ("The Ledger" design system, template-slotted #95).
 *
 * The prototype hero section's inner DOM is held here as a template; authored
 * values are SLOTTED into it by role:
 *   row with h1        → the statement h1 (a <br> is restored before the final
 *                        integration word, mirroring the prototype line break)
 *   row with ul/ol     → the integration-name carousel rotation list; the FIRST
 *                        name renders as the static/visually-hidden + initial
 *                        carousel text ("+ Chargebee")
 *   first plain row    → .hero-lede
 *   second plain row   → .hero-facts
 *   row with links     → .hero-ctas (<strong><a>/<em><a> — ak.js button classes
 *                        are preserved; the em/secondary renders as a ds-link)
 *
 * TEMPLATE-OWNED (fixed brand assets, never authored): the dotlottie dashboard
 * animation and its window-chromed SVG dashboard-card fallback (MRR sheet).
 *
 * Motion contract (audit P1, cloned from the prototype):
 *   - carousel rotates only under (prefers-reduced-motion: no-preference);
 *     reduced motion / no JS shows the static first name;
 *   - the dotlottie web-component module (~2.2MB incl. WASM) is injected ONLY
 *     when (prefers-reduced-motion: no-preference) AND (min-width: 768px) AND
 *     !navigator.connection.saveData;
 *   - the SVG fallback ALWAYS renders first; the Lottie is revealed only when
 *     the player reports loaded (dl.isLoaded === true || dl.totalFrames > 0);
 *     a CSP/network failure leaves the fallback in place, zero errors thrown.
 *
 * ENCODE/DECODE contract (#93): ../baremetrics/stardust/eds-schema/home-B.json
 * (hero). No module-scope imports (block-roundtrip inlines this file).
 */

const LOTTIE_SRC = 'https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.20/dist/dotlottie-wc.js';
const LOTTIE_JSON = 'https://baremetrics.com/hubfs/Baremetrics_July2023/JSON/homepage_animation.json';

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

function el(tag, cls, txt) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (txt !== undefined) node.textContent = txt;
  return node;
}

function winBar() {
  const bar = el('div', 'win-bar');
  bar.setAttribute('aria-hidden', 'true');
  bar.append(el('span'), el('span'), el('span'));
  return bar;
}

/* the window-chromed SVG dashboard card — the always-first fallback visual */
function dashFallback() {
  const fig = document.createElement('figure');
  fig.className = 'hero-dash win';
  fig.setAttribute('role', 'img');
  fig.setAttribute('aria-label', 'Baremetrics dashboard preview: monthly recurring revenue of $365,271, trending upward');
  fig.append(winBar());
  const body = el('div', 'hero-dash-body');
  const head = el('div', 'dash-head');
  head.append(el('span', 'dash-chip', 'MRR'), el('span', 'dash-label', 'Monthly Recurring Revenue'));
  body.append(head, el('p', 'dash-value', '$365,271'));
  body.insertAdjacentHTML('beforeend', `
    <svg class="dash-svg" viewBox="0 0 560 220" width="560" height="220" aria-hidden="true" focusable="false">
      <line class="dash-grid-line" x1="8" y1="40" x2="552" y2="40"></line>
      <line class="dash-grid-line" x1="8" y1="90" x2="552" y2="90"></line>
      <line class="dash-grid-line" x1="8" y1="140" x2="552" y2="140"></line>
      <line class="dash-grid-line" x1="8" y1="190" x2="552" y2="190"></line>
      <path class="dash-area" d="M12 186 C70 176 104 170 140 160 C182 148 216 148 254 136 C296 122 324 118 360 106 C398 92 428 84 462 66 C486 54 506 44 524 34 L524 206 L12 206 Z"></path>
      <path class="dash-line" d="M12 186 C70 176 104 170 140 160 C182 148 216 148 254 136 C296 122 324 118 360 106 C398 92 428 84 462 66 C486 54 506 44 524 34"></path>
      <circle class="dash-dot-halo" cx="524" cy="34" r="10"></circle>
      <circle class="dash-dot" cx="524" cy="34" r="5"></circle>
    </svg>`);
  fig.append(body);
  return fig;
}

/* h1 carousel — the prototype's 0.5s translateY slot roll, ~3s dwell */
function startCarousel(carousel, names) {
  if (names.length < 2) return;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    carousel.style.transition = 'transform 0.5s ease-in-out';
    setInterval(() => {
      carousel.style.transform = 'translateY(-110%)';
      setTimeout(() => {
        i = (i + 1) % names.length;
        carousel.style.transition = 'none';
        carousel.textContent = names[i];
        carousel.style.transform = 'translateY(110%)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          carousel.style.transition = 'transform 0.5s ease-in-out';
          carousel.style.transform = 'translateY(0)';
        }));
      }, 500);
    }, 3000);
  } catch { /* static first name remains */ }
}

/* gated dotlottie loader — fallback-first, swap only on a LOADED player */
function loadLottie(block, wc) {
  try {
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    if (navigator.connection && navigator.connection.saveData) return;
    if (!window.customElements) return;
    if (!document.querySelector(`script[src="${LOTTIE_SRC}"]`)) {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = LOTTIE_SRC;
      s.onerror = () => {}; /* CSP/network failure: the fallback stays */
      document.body.append(s);
    }
    let tries = 0;
    const poll = setInterval(() => {
      try {
        const dl = wc.dotLottie;
        const loaded = dl && (dl.isLoaded === true || dl.totalFrames > 0);
        if (loaded) {
          block.classList.add('lottie-ready');
          clearInterval(poll);
        } else if ((tries += 1) > 100) clearInterval(poll); /* ~20s, give up quietly */
      } catch { clearInterval(poll); }
    }, 200);
  } catch { /* fallback stays */ }
}

export default async function decorate(block) {
  /* ── read authored rows by role ── */
  const model = {
    h1: '', names: [], paras: [], ctas: [],
  };
  [...block.children].forEach((row) => {
    const heading = row.querySelector('h1, h2, h3');
    const list = row.querySelector('ul, ol');
    const links = row.querySelectorAll('a');
    if (heading) model.h1 = text(heading);
    else if (list) model.names = [...list.querySelectorAll('li')].map(text).filter(Boolean);
    else if (links.length) model.ctas.push(...links);
    else if (text(row)) model.paras.push(text(row));
  });
  const [lede, facts] = model.paras;
  const first = model.names[0] || '';

  model.ctas.forEach((a) => a.remove());
  block.textContent = '';

  /* ── slot into the template ── */
  const wrap = el('div', 'hero-wrap');

  const rulings = el('div', 'hero-rulings');
  rulings.setAttribute('aria-hidden', 'true');
  rulings.append(el('i'), el('i'), el('i'));
  wrap.append(rulings);

  const h1 = document.createElement('h1');
  const words = model.h1.split(' ');
  if (words.length > 1) {
    const last = words.pop();
    h1.append(document.createTextNode(`${words.join(' ')} `), document.createElement('br'), document.createTextNode(last));
  } else h1.textContent = model.h1;
  let carousel = null;
  if (first) {
    h1.append(el('span', 'visually-hidden', ` ${first}`));
    const cWrap = el('span', 'hero-carousel-wrapper');
    cWrap.setAttribute('aria-hidden', 'true');
    carousel = el('span', 'hero-carousel', first);
    cWrap.append(carousel);
    h1.append(cWrap);
  }
  wrap.append(h1);

  const row = el('div', 'hero-row');
  const copy = el('div', 'hero-copy');
  if (lede) copy.append(el('p', 'hero-lede', lede));
  if (facts) copy.append(el('p', 'hero-facts', facts));
  if (model.ctas.length) {
    const ctas = el('div', 'hero-ctas');
    ctas.append(...model.ctas);
    copy.append(ctas);
  }
  row.append(copy);

  const media = el('div', 'hero-media');
  const right = el('div', 'carousel-right');
  const win = el('div', 'win');
  win.append(winBar());
  const wc = document.createElement('dotlottie-wc');
  wc.setAttribute('src', LOTTIE_JSON);
  wc.setAttribute('speed', '1');
  wc.setAttribute('mode', 'forward');
  wc.setAttribute('loop', '');
  wc.setAttribute('autoplay', '');
  wc.className = 'lottie-animation';
  wc.setAttribute('aria-label', 'Animated Baremetrics dashboard preview');
  win.append(wc);
  right.append(win);
  media.append(right, dashFallback()); /* fallback ALWAYS renders */
  row.append(media);
  wrap.append(row);

  block.append(wrap);

  if (carousel) startCarousel(carousel, model.names);
  loadLottie(block, wc);
}
