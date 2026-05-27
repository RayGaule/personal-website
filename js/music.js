/* ============================================================
   music.js — Music page: infinite carousel + album grid
   ============================================================ */

/* ── Preview mode (?preview=1) ───────────────────────────── */
if (new URLSearchParams(window.location.search).get('preview') === '1') {
  const s = document.createElement('style');
  s.textContent = `
    .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
    .carousel-track { animation-play-state: paused !important; }
  `;
  document.head.appendChild(s);
}

document.addEventListener('DOMContentLoaded', async () => {
  const albums = await fetch('data/albums.json').then(r => r.json());
  renderCarousel(albums);
  renderGrid(albums);
  initNav();
});

/* ── Infinite Carousel ────────────────────────────────────── */
function renderCarousel(albums) {
  const track = document.getElementById('carouselTrack');
  if (!track) return;

  /* Build one set of cards */
  function makeCards(set) {
    return albums.map((a, i) => `
      <div class="carousel-card" data-id="${a.id}" data-set="${set}" role="button" tabindex="0"
           aria-label="${a.album} — ${a.artist}">
        <img class="carousel-card__img"
             src="${a.image}"
             alt="${a.album}"
             loading="${set === 0 ? 'eager' : 'lazy'}"
             onerror="this.style.background='var(--bg-secondary)';this.style.opacity='0'">
        <div class="carousel-card__overlay">
          <div class="carousel-card__album">${a.album}</div>
          <div class="carousel-card__artist">${a.artist}</div>
          <div class="carousel-card__comment">${a.comment}</div>
        </div>
        <button class="carousel-card__play" title="播放" tabindex="-1">
          <svg viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="white"/></svg>
        </button>
      </div>
    `).join('');
  }

  /* Duplicate for seamless loop (set 0 + set 1) */
  track.innerHTML = makeCards(0) + makeCards(1);

  /* Precisely calculate scroll distance after layout paint */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const cards = track.querySelectorAll('.carousel-card');
    if (cards.length >= albums.length * 2) {
      // Distance from first card of set 0 to first card of set 1
      const dist = cards[albums.length].offsetLeft - cards[0].offsetLeft;
      track.style.setProperty('--scroll-dist', `-${dist}px`);
    }
  }));

  /* Click / keyboard to play */
  track.querySelectorAll('.carousel-card').forEach(card => {
    const play = () => {
      const albumId = parseInt(card.dataset.id);
      if (window.__player) window.__player.playAlbum(albumId);
    };

    card.addEventListener('click', play);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') play(); });

    /* Play button stops propagation so it doesn't fire twice */
    card.querySelector('.carousel-card__play')?.addEventListener('click', (e) => {
      e.stopPropagation();
      play();
    });
  });
}

/* ── Album Grid ───────────────────────────────────────────── */
function renderGrid(albums) {
  const grid = document.getElementById('albumGrid');
  if (!grid) return;

  grid.innerHTML = albums.map(a => `
    <div class="album-tile reveal" data-id="${a.id}" role="button" tabindex="0">
      <div class="album-tile__cover">
        <img src="${a.image}" alt="${a.album}" loading="lazy"
             onerror="this.style.opacity='0'">
      </div>
      <div class="album-tile__album">${a.album}</div>
      <div class="album-tile__artist">${a.artist}</div>
      <div class="album-tile__comment">${a.comment}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.album-tile').forEach(tile => {
    const play = () => {
      const id = parseInt(tile.dataset.id);
      if (window.__player) window.__player.playAlbum(id);
    };
    tile.addEventListener('click', play);
    tile.addEventListener('keydown', e => { if (e.key === 'Enter') play(); });
  });

  /* Scroll reveal */
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const siblings = [...entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')];
      const delay    = Math.min(siblings.indexOf(entry.target) * 55, 440);
      setTimeout(() => entry.target.classList.add('visible'), delay);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

  grid.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

/* ── Nav scroll ───────────────────────────────────────────── */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const fn = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', fn, { passive: true });
  fn();
}
