/* ============================================================
   main.js — Homepage logic
   ============================================================ */

/* ── Preview mode (?preview=1) ───────────────────────────── */
if (new URLSearchParams(window.location.search).get('preview') === '1') {
  const s = document.createElement('style');
  s.textContent = `
    .hero { min-height: auto !important; padding: 140px 0 100px !important; }
    .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
  `;
  document.head.appendChild(s);
}

document.addEventListener('DOMContentLoaded', async () => {

  const [profile, projects, albums] = await Promise.all([
    fetch('data/profile.json').then(r => r.json()),
    fetch('data/projects.json').then(r => r.json()),
    fetch('data/albums.json').then(r => r.json()),
  ]);

  renderHero(profile);
  renderAbout(profile);   // includes skills
  renderProjects(projects);
  renderMusicEntry(albums);
  renderContact(profile);
  initEmailCopy(profile.contact.email);
  initNav();
  initScrollReveal();
  initWeChatModal(profile);
});

/* ── Hero ─────────────────────────────────────────────────── */
function renderHero(p) {
  setEl('heroNameEn', p.name.english);
  setEl('heroNameZh', p.name.chinese);
  setEl('heroTagline', p.tagline);

  document.title = `${p.name.english} — ${p.name.chinese}`;

  /* Avatar */
  const avatar   = document.getElementById('heroAvatar');
  const initials = document.getElementById('heroInitials');
  if (avatar) {
    avatar.src = p.avatar;
    avatar.alt = p.name.english;
    avatar.onerror = () => {
      avatar.style.display = 'none';
      if (initials) initials.style.display = 'flex';
    };
  }

  /* CTA links */
  const gh = document.getElementById('heroGithub');
  if (gh) { gh.href = p.contact.github; }
}

/* ── About (includes Skills) ─────────────────────────────── */
function renderAbout(p) {
  /* Text paragraphs */
  const textEl = document.getElementById('aboutText');
  if (textEl) {
    textEl.innerHTML = p.about.map(para => `<p>${para}</p>`).join('');
  }

  /* Education */
  setEl('aboutEdu', p.education);

  /* Skills inside about section */
  const list = document.getElementById('skillsList');
  if (list) {
    list.innerHTML = p.skills.map(s =>
      `<span class="tag">${s.name}</span>`
    ).join('');
  }
}

/* ── Projects ─────────────────────────────────────────────── */
function renderProjects(data) {
  const featured = document.getElementById('projectsFeatured');
  if (featured) {
    featured.innerHTML = data.featured.map(p => `
      <article class="project-card reveal">
        <div class="project-card__image">
          ${p.image
            ? `<img src="${p.image}" alt="${p.title}"
                    onerror="this.parentElement.innerHTML='<div class=\\'project-card__image-placeholder\\'>📂</div>'">`
            : `<div class="project-card__image-placeholder">📂</div>`}
        </div>
        <div class="project-card__body">
          <div class="project-card__year">${p.year}</div>
          <h3 class="project-card__title">${p.title}</h3>
          <p class="project-card__desc">${p.description}</p>
          <div class="project-card__tags">
            ${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
          <div class="project-card__links">
            ${p.github !== '#'
              ? `<a href="${p.github}" class="btn btn--ghost" target="_blank" rel="noopener">
                   <svg class="icon" viewBox="0 0 24 24"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                   GitHub
                 </a>`
              : `<span class="btn btn--ghost" style="opacity:.4;cursor:default">GitHub 待补充</span>`}
            ${p.demo ? `<a href="${p.demo}" class="btn btn--primary" target="_blank">Demo →</a>` : ''}
          </div>
        </div>
      </article>
    `).join('');
  }

  const others = document.getElementById('projectsOthers');
  if (others) {
    others.innerHTML = data.others.map(p => `
      <a href="${p.github}" class="project-item reveal" target="_blank" rel="noopener">
        <span class="project-item__year">${p.year}</span>
        <span class="project-item__title">${p.title}</span>
        <span class="project-item__desc">${p.description}</span>
        <span class="project-item__tags">
          ${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </span>
        <span class="project-item__arrow">→</span>
      </a>
    `).join('');
  }
}

/* ── Music Entry ──────────────────────────────────────────── */
function renderMusicEntry(albums) {
  const thumbs = document.getElementById('musicThumbs');
  if (!thumbs) return;
  thumbs.innerHTML = albums.slice(0, 3).map(a => `
    <div class="album-preview-thumb">
      <img src="${a.image}" alt="${a.album}"
           onerror="this.parentElement.style.background='var(--bg-secondary)'">
    </div>
  `).join('');
}

/* ── Contact ──────────────────────────────────────────────── */
function renderContact(p) {
  const gh = document.getElementById('contactGithub');
  if (gh) { gh.href = p.contact.github; gh.target = '_blank'; gh.rel = 'noopener'; }
}

/* ── Email copy (hover tooltip + click to copy) ───────────── */
function initEmailCopy(email) {
  const btns = document.querySelectorAll('.email-copy-btn');
  btns.forEach(btn => {
    /* Set email for tooltip via data attribute */
    btn.setAttribute('data-email', email);
    btn.title = email;

    btn.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(email).then(() => {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 2200);
        }).catch(() => fallbackCopy(email));
      } else {
        fallbackCopy(email);
      }
    });
  });
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

/* ── WeChat Modal ─────────────────────────────────────────── */
function initWeChatModal(p) {
  const btn     = document.getElementById('contactWechat');
  const overlay = document.getElementById('wechatModal');
  const closeEl = document.getElementById('wechatClose');
  const qrImg   = document.getElementById('wechatQR');

  if (!btn || !overlay) return;

  if (qrImg) {
    qrImg.src = p.contact.wechat.qrcode;
    qrImg.onerror = () => {
      qrImg.parentElement.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;
                    width:100%;height:100%;color:var(--text-tertiary);
                    font-size:.8rem;text-align:center;padding:1rem;">
          二维码<br>待补充
        </div>`;
    };
  }

  /* Both hero button and contact section button open the same modal */
  [btn, document.getElementById('heroWechat')].forEach(el => {
    if (el) el.addEventListener('click', () => overlay.classList.add('open'));
  });

  [closeEl, overlay].forEach(el => {
    if (!el) return;
    el.addEventListener('click', e => {
      if (e.target === overlay || e.target === closeEl)
        overlay.classList.remove('open');
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') overlay.classList.remove('open');
  });
}

/* ── Nav scroll ───────────────────────────────────────────── */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Active section highlight */
  const sections = document.querySelectorAll('section[id]');
  const links    = document.querySelectorAll('.nav__link[href^="#"]');

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.toggle('active',
          l.getAttribute('href') === `#${e.target.id}`));
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => obs.observe(s));
}

/* ── Scroll reveal ────────────────────────────────────────── */
function initScrollReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const siblings = [...entry.target.parentElement
        .querySelectorAll('.reveal:not(.visible)')];
      const delay = siblings.indexOf(entry.target) * 80;
      setTimeout(() => entry.target.classList.add('visible'), delay);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

/* ── Util ─────────────────────────────────────────────────── */
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ── Hero Background: Organic Wave Canvas ─────────────────── */
function initHeroBg() {
  const canvas = document.querySelector('.hero__bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* Accent color components (warm brown #8B7355) */
  const R = 139, G = 115, B = 85;

  /* Three wave layers with distinct speeds, amplitudes, frequencies */
  const layers = [
    { speed: 0.00018, amp: 0.22, freq: 1.4,  phase: 0,    opacity: 0.07 },
    { speed: 0.00011, amp: 0.16, freq: 2.1,  phase: 2.1,  opacity: 0.05 },
    { speed: 0.00025, amp: 0.10, freq: 0.85, phase: 4.5,  opacity: 0.04 },
  ];

  let W, H, dpr;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* Draw one organic blob-wave layer */
  function drawLayer(t, layer, waveY) {
    const { speed, amp, freq, phase, opacity } = layer;
    const N = 80; /* control-point resolution */
    const time = t * speed;

    ctx.beginPath();

    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W;
      /* Compose two sine waves per layer for organic feel */
      const y = waveY
        + Math.sin(i / N * Math.PI * 2 * freq + time + phase) * H * amp
        + Math.sin(i / N * Math.PI * 2 * freq * 1.7 + time * 1.3 + phase + 1) * H * amp * 0.4;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    /* Close shape to bottom */
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();

    ctx.fillStyle = `rgba(${R},${G},${B},${opacity})`;
    ctx.fill();
  }

  /* Smoothed bezier version of the wave for a softer look */
  function drawLayerSmooth(t, layer, waveY) {
    const { speed, amp, freq, phase, opacity } = layer;
    const N = 12;
    const time = t * speed;

    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W;
      const y = waveY
        + Math.sin(i / N * Math.PI * 2 * freq + time + phase) * H * amp
        + Math.sin(i / N * Math.PI * 2 * freq * 1.61 + time * 1.4 + phase + 0.8) * H * amp * 0.45
        + Math.sin(i / N * Math.PI * 2 * freq * 0.5  + time * 0.7 + phase + 2.2) * H * amp * 0.3;
      pts.push({ x, y });
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const cpx = (pts[i].x + pts[i + 1].x) / 2;
      const cpy = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, cpx, cpy);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();

    ctx.fillStyle = `rgba(${R},${G},${B},${opacity})`;
    ctx.fill();
  }

  let raf;
  function tick(t) {
    ctx.clearRect(0, 0, W, H);

    /* Layer base Y positions: upper-mid, mid, lower */
    const yBases = [H * 0.52, H * 0.62, H * 0.72];
    layers.forEach((layer, i) => drawLayerSmooth(t, layer, yBases[i]));

    raf = requestAnimationFrame(tick);
  }

  /* Pause when hero is not visible (performance) */
  const hero = document.querySelector('.hero');
  if (hero) {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
        raf = null;
      }
    });
    io.observe(hero);
  } else {
    raf = requestAnimationFrame(tick);
  }
}

/* Auto-init when DOM ready (called after DOMContentLoaded too, but safe to call standalone) */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroBg);
} else {
  initHeroBg();
}
