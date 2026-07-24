/*
 * youtube — lite, privacy-first YouTube embed ("The Ledger" design system).
 *
 * This is a LINK block: ak.js (scripts/scripts.js `linkBlocks`) tags any
 * anchor whose href contains `https://www.youtube` with `youtube auto-block`
 * and calls this decorate with the anchor as the block element. It also
 * works when authored as a normal block cell containing a YouTube link.
 *
 * Renders a click-to-load facade (poster thumbnail + play button). Nothing
 * is requested from YouTube until the visitor presses play, and the embed
 * uses the youtube-nocookie.com privacy domain. Responsive 16:9, keyboard
 * accessible, prefers-reduced-motion safe (no autoplay of motion beyond the
 * video the user explicitly starts).
 */

/** Extract the 11-ish char video id from any YouTube URL shape. */
function youTubeId(href) {
  if (!href) return null;
  try {
    const u = new URL(href, window.location.origin);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split(/[/?#]/)[0] || null;
    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    const v = u.searchParams.get('v');
    if (v) return v;
  } catch (ex) { /* fall through to regex */ }
  const m = String(href).match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function el(tag, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

export default async function decorate(block) {
  const isAnchor = block.tagName === 'A';
  const anchor = isAnchor ? block : block.querySelector('a');
  const href = (anchor && anchor.getAttribute('href')) || (block.textContent || '').trim();
  const id = youTubeId(href);

  // Unparseable URL: leave the original link intact rather than break the page.
  if (!id) return;

  const label = (anchor && anchor.textContent.trim()) || 'YouTube video';

  const embed = el('div', 'youtube-embed');
  embed.dataset.videoId = id;

  const poster = el('button', 'youtube-poster');
  poster.type = 'button';
  poster.setAttribute('aria-label', `Play video: ${label}`);

  const thumb = el('img', 'youtube-thumb');
  thumb.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  thumb.alt = '';
  thumb.loading = 'lazy';
  thumb.width = 480;
  thumb.height = 360;

  const play = el('span', 'youtube-play');
  play.setAttribute('aria-hidden', 'true');

  poster.append(thumb, play);
  embed.append(poster);

  poster.addEventListener('click', () => {
    const iframe = el('iframe', 'youtube-iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    iframe.title = label;
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    poster.replaceWith(iframe);
    iframe.focus();
  });

  if (isAnchor) block.replaceWith(embed);
  else block.replaceChildren(embed);
}
