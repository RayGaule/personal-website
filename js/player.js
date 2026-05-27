/* ============================================================
   player.js — Mini Music Player v2
   Disc + ScalesMixer visualizer + track slide transitions
   Shuffle / loop / keyboard shortcuts / Web Audio analyser
   ============================================================ */

class MiniPlayer {
  constructor() {
    this.albums    = [];
    this.index     = 0;
    this.expanded  = false;
    this.shuffle   = false;
    this.loopMode  = 'off';   // 'off' | 'all' | 'one'
    this._dragging = false;
    this._dir      = 'next';  // last navigation direction

    this.audio = new Audio();
    this.audio.volume = 1;

    /* Web Audio */
    this._audioCtx = null;
    this._analyser  = null;
    this._vizData   = null;   // frequency data buffer
    this._vizRaf    = null;

    /* Canvas dimensions */
    this._VIZ_W = 300;
    this._VIZ_H = 64;

    this._buildDOM();
    this._bindAudio();
    this._bindKeyboard();
    this._loadData();
    this._saveOnLeave();
    this._startVizLoop();
  }

  /* ── Load data + restore state ────────────────────────── */
  async _loadData() {
    try {
      this.albums = await fetch('data/albums.json').then(r => r.json());
      const saved = this._restoreState();
      if (saved) {
        this.index = Math.min(saved.index, this.albums.length - 1);
        this._renderTrack(null, true); // silent render (no anim)
        this.audio.volume = saved.volume ?? 1;
        this._syncVolSlider(this.audio.volume);

        /* Offset saved time by page-load duration so playback feels seamless */
        const pageLoadSec = (saved.savedAt && saved.playing)
          ? (Date.now() - saved.savedAt) / 1000
          : 0;
        const target = (saved.time || 0) + pageLoadSec;

        this.audio.addEventListener('canplay', () => {
          if (target > 0.5) {
            this.audio.currentTime = target;
            /* Wait for seek to finish before playing — avoids brief playback from t=0 */
            if (saved.playing) {
              this.audio.addEventListener('seeked', () => {
                this.audio.play().catch(() => {});
              }, { once: true });
            }
          } else {
            if (saved.playing) this.audio.play().catch(() => {});
          }
        }, { once: true });
      } else {
        this._renderTrack(null, true);
      }
    } catch (e) {
      console.warn('[Player] Could not load albums.json', e);
    }
  }

  /* ── Build DOM ────────────────────────────────────────── */
  _buildDOM() {
    const root = document.getElementById('player');
    if (!root) return;
    this.root = root;

    root.innerHTML = `
      <!-- ── Expanded panel ── -->
      <div class="player__panel" id="playerPanel" hidden>

        <!-- Dark disc section -->
        <div class="player__disc-section">
          <button class="player__close" id="playerClose" title="收起">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                 stroke="white" stroke-width="2" stroke-linecap="round">
              <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
            </svg>
          </button>

          <!-- Spinning vinyl disc -->
          <div class="player__disc" id="playerDisc">
            <div class="player__disc-inner" id="playerDiscInner">
              <div class="player__disc-cover">
                <img id="playerArtImg" src="" alt="album art">
              </div>
              <div class="player__disc-grooves"></div>
              <div class="player__disc-hole"></div>
            </div>
          </div>

          <!-- ScalesMixer canvas visualizer -->
          <canvas class="player__viz-canvas" id="playerViz"></canvas>
        </div>

        <!-- Track info (slide-animated on change) -->
        <div class="player__info" id="playerInfo">
          <div class="player__song"   id="playerSong">—</div>
          <div class="player__artist" id="playerArtist">—</div>
        </div>

        <!-- Progress -->
        <div class="player__progress-wrap">
          <input class="player__progress" id="playerProgress"
                 type="range" min="0" max="100" value="0" step=".1">
        </div>
        <div class="player__time">
          <span id="playerCurrent">0:00</span>
          <span id="playerDuration">0:00</span>
        </div>

        <!-- Controls: shuffle prev play next loop -->
        <div class="player__controls">

          <button class="player__btn" id="playerShuffle" title="随机 (S)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
          </button>

          <button class="player__btn" id="playerPrev" title="上一首 (Shift+←)">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19,20 9,12 19,4"/>
              <rect x="5" y="4" width="2.5" height="16" rx="1.2"/>
            </svg>
          </button>

          <button class="player__btn player__btn--play" id="playerPlay" title="播放/暂停 (Space)">
            <svg id="playerPlayIcon" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          </button>

          <button class="player__btn" id="playerNext" title="下一首 (Shift+→)">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,4 15,12 5,20"/>
              <rect x="16.5" y="4" width="2.5" height="16" rx="1.2"/>
            </svg>
          </button>

          <button class="player__btn" id="playerLoop" title="循环 (L)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            <span class="player__loop-badge" id="playerLoopBadge" hidden></span>
          </button>

        </div>

        <!-- Volume -->
        <div class="player__volume-wrap">
          <button class="player__vol-btn" id="playerMute" title="静音">
            <svg id="volIcon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <path id="volWaves" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
                    fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
            </svg>
          </button>
          <input class="player__volume" id="playerVolume"
                 type="range" min="0" max="1" step="0.01" value="1">
        </div>

      </div>

      <!-- ── Collapsed pill ── -->
      <div class="player__pill" id="playerPill">
        <div class="player__pill-disc" id="pillDisc">
          <img id="pillDiscImg" src="" alt="">
        </div>
        <div class="player__pill-eq">
          <div class="player__pill-eq-bar"></div>
          <div class="player__pill-eq-bar"></div>
          <div class="player__pill-eq-bar"></div>
          <div class="player__pill-eq-bar"></div>
        </div>
        <div class="player__pill-track" id="pillTrack">Music</div>
      </div>
    `;

    /* Cache refs */
    this.panel        = root.querySelector('#playerPanel');
    this.pill         = root.querySelector('#playerPill');
    this.artImg       = root.querySelector('#playerArtImg');
    this.pillImg      = root.querySelector('#pillDiscImg');
    this.songEl       = root.querySelector('#playerSong');
    this.artistEl     = root.querySelector('#playerArtist');
    this.infoEl       = root.querySelector('#playerInfo');
    this.progress     = root.querySelector('#playerProgress');
    this.currentEl    = root.querySelector('#playerCurrent');
    this.durationEl   = root.querySelector('#playerDuration');
    this.playIcon     = root.querySelector('#playerPlayIcon');
    this.pillTrack    = root.querySelector('#pillTrack');
    this.volumeSlider = root.querySelector('#playerVolume');
    this.volWaves     = root.querySelector('#volWaves');

    /* Setup canvas */
    this._setupCanvas();

    /* Pill → expand */
    this.pill.addEventListener('click', () => this.expand());

    /* Close button */
    root.querySelector('#playerClose').addEventListener('click', e => {
      e.stopPropagation();
      this.collapse();
    });

    /* Playback controls */
    root.querySelector('#playerPlay').addEventListener('click', () => this.togglePlay());
    root.querySelector('#playerPrev').addEventListener('click', () => this.prev());
    root.querySelector('#playerNext').addEventListener('click', () => this.next());

    /* Shuffle / loop */
    root.querySelector('#playerShuffle').addEventListener('click', () => this._toggleShuffle());
    root.querySelector('#playerLoop').addEventListener('click', () => this._cycleLoop());

    /* Progress seek */
    this.progress.addEventListener('mousedown',  () => { this._dragging = true; });
    this.progress.addEventListener('touchstart', () => { this._dragging = true; });
    window.addEventListener('mouseup',  () => { this._dragging = false; });
    window.addEventListener('touchend', () => { this._dragging = false; });
    this.progress.addEventListener('input', () => this._seek());

    /* Volume */
    this.volumeSlider.addEventListener('input', () => {
      const v = parseFloat(this.volumeSlider.value);
      this.audio.volume = v;
      this.audio.muted  = v === 0;
      this._syncVolSlider(v);
    });

    root.querySelector('#playerMute').addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      const v = this.audio.muted ? 0 : this.audio.volume;
      this.volumeSlider.value = v;
      this._syncVolSlider(v);
    });

    /* Disc click — toggle zoom */
    root.querySelector('#playerDisc').addEventListener('click', () => {
      root.querySelector('#playerDisc').classList.toggle('zoomed');
    });

    /* Outside click collapses */
    document.addEventListener('click', e => {
      if (this.expanded && !root.contains(e.target)) this.collapse();
    });
  }

  /* ── Canvas visualizer setup ──────────────────────────── */
  _setupCanvas() {
    const canvas = this.root?.querySelector('#playerViz');
    if (!canvas) return;
    this._vizCanvas = canvas;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = this._VIZ_W * dpr;
    canvas.height = this._VIZ_H * dpr;
    canvas.style.width  = '100%';
    canvas.style.height = this._VIZ_H + 'px';
    this._vizCtx = canvas.getContext('2d');
    this._vizCtx.scale(dpr, dpr);
  }

  /* ── Web Audio init (called on first user interaction) ── */
  _initAudioCtx() {
    if (this._audioCtx) return;
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this._audioCtx.createMediaElementSource(this.audio);
      this._analyser = this._audioCtx.createAnalyser();
      this._analyser.fftSize = 512;                // 256 freq bins — good wave resolution
      this._analyser.smoothingTimeConstant = 0.80;
      src.connect(this._analyser);
      this._analyser.connect(this._audioCtx.destination);
      this._vizData = new Uint8Array(this._analyser.frequencyBinCount); // 256
    } catch (e) {
      console.warn('[Player] AudioContext unavailable:', e);
      this._audioCtx = null;
    }
  }

  /* ── ScalesMixer draw loop ────────────────────────────── */
  _startVizLoop() {
    const draw = () => {
      this._drawViz();
      this._vizRaf = requestAnimationFrame(draw);
    };
    this._vizRaf = requestAnimationFrame(draw);
  }

  _drawViz() {
    const ctx = this._vizCtx;
    if (!ctx) return;

    const W  = this._VIZ_W;
    const H  = this._VIZ_H;
    const cy = H / 2;
    const t  = Date.now() / 1000;
    const N  = 64;   // render points along the wave

    ctx.clearRect(0, 0, W, H);

    /* ── Collect frequency data → N amplitude points (0–1) ── */
    const pts   = new Array(N);
    const active = this._analyser && !this.audio.paused;

    if (active) {
      this._analyser.getByteFrequencyData(this._vizData);
      /* Use lower 65% of spectrum (upper bins are usually near-silent for music) */
      const usable = Math.floor(this._vizData.length * 0.65);
      for (let i = 0; i < N; i++) {
        pts[i] = this._vizData[Math.floor(i * usable / N)] / 255;
      }
      /* Smooth 2 passes so the curve has no harsh kinks */
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < N - 1; i++) {
          pts[i] = pts[i - 1] * 0.25 + pts[i] * 0.5 + pts[i + 1] * 0.25;
        }
      }
    } else {
      /* Idle: slow gentle sine undulation */
      const amp = 0.07;
      for (let i = 0; i < N; i++) {
        pts[i] = amp * (0.5 + 0.5 * Math.sin(i / N * Math.PI * 2.5 + t * 1.4));
      }
    }

    /* ── Coordinate helpers ───────────────────────────────── */
    const maxAmp = H * 0.42;
    const xs     = Array.from({ length: N }, (_, i) => (i / (N - 1)) * W);
    const yTop   = i => cy - pts[i] * maxAmp;
    const yBot   = i => cy + pts[i] * maxAmp;

    /* ── Filled area between top and bottom curves ────────── */
    ctx.beginPath();
    ctx.moveTo(xs[0], yTop(0));
    for (let i = 1; i < N; i++) {
      const cpx = (xs[i - 1] + xs[i]) / 2;
      ctx.bezierCurveTo(cpx, yTop(i - 1), cpx, yTop(i), xs[i], yTop(i));
    }
    /* Trace bottom curve right→left to close the shape */
    for (let i = N - 1; i >= 0; i--) {
      if (i === N - 1) {
        ctx.lineTo(xs[i], yBot(i));
      } else {
        const cpx = (xs[i] + xs[i + 1]) / 2;
        ctx.bezierCurveTo(cpx, yBot(i + 1), cpx, yBot(i), xs[i], yBot(i));
      }
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   'rgba(200,168,126,0.22)');
    grad.addColorStop(0.5, 'rgba(200,168,126,0.03)');
    grad.addColorStop(1,   'rgba(200,168,126,0.22)');
    ctx.fillStyle = grad;
    ctx.fill();

    /* ── Top wave stroke ──────────────────────────────────── */
    ctx.lineWidth   = 1.6;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.strokeStyle = '#C8A87E';
    ctx.shadowColor = 'rgba(200,168,126,0.55)';
    ctx.shadowBlur  = 5;

    ctx.beginPath();
    ctx.moveTo(xs[0], yTop(0));
    for (let i = 1; i < N; i++) {
      const cpx = (xs[i - 1] + xs[i]) / 2;
      ctx.bezierCurveTo(cpx, yTop(i - 1), cpx, yTop(i), xs[i], yTop(i));
    }
    ctx.globalAlpha = 0.92;
    ctx.stroke();

    /* ── Bottom wave stroke (mirror) ──────────────────────── */
    ctx.beginPath();
    ctx.moveTo(xs[0], yBot(0));
    for (let i = 1; i < N; i++) {
      const cpx = (xs[i - 1] + xs[i]) / 2;
      ctx.bezierCurveTo(cpx, yBot(i - 1), cpx, yBot(i), xs[i], yBot(i));
    }
    ctx.globalAlpha = 0.70;
    ctx.stroke();

    /* ── Center hairline ──────────────────────────────────── */
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 0.13;
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  /* ── Audio events ─────────────────────────────────────── */
  _bindAudio() {
    this.audio.addEventListener('timeupdate',     () => this._updateProgress());
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.durationEl) this.durationEl.textContent = this._fmt(this.audio.duration);
    });
    this.audio.addEventListener('ended',  () => this.next(true));
    this.audio.addEventListener('play',   () => this._setPlayState(true));
    this.audio.addEventListener('pause',  () => this._setPlayState(false));
  }

  /* ── Keyboard shortcuts ───────────────────────────────── */
  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.shiftKey ? this.prev() : this._seekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.shiftKey ? this.next() : this._seekRelative(5);
          break;
        case 's': case 'S':
          this._toggleShuffle();
          break;
        case 'l': case 'L':
          this._cycleLoop();
          break;
      }
    });
  }

  /* ── Render track (with optional slide animation) ─────── */
  _renderTrack(direction, silent) {
    if (!this.albums.length) return;
    const a = this.albums[this.index];

    /* Update audio source */
    this.audio.src = a.audio;

    /* Disc cover fade-swap */
    if (this.artImg) {
      this.artImg.style.opacity = '0';
      this.artImg.onload = () => { this.artImg.style.opacity = '1'; };
      this.artImg.src = a.image;
      this.artImg.alt = a.album;
    }

    /* Pill art */
    if (this.pillImg) this.pillImg.src = a.image;

    /* Disc burst animation */
    const disc = this.root?.querySelector('#playerDisc');
    if (disc && !silent) {
      disc.classList.remove('burst');
      void disc.offsetWidth;   // force reflow to restart animation
      disc.classList.add('burst');
      disc.addEventListener('animationend', () => disc.classList.remove('burst'), { once: true });
    }

    /* Track info: animate or set directly */
    if (!silent && direction && this.infoEl) {
      this._animateTrackInfo(direction, () => {
        if (this.songEl)   this.songEl.textContent   = a.song_title || a.album;
        if (this.artistEl) this.artistEl.textContent = a.artist;
      });
    } else {
      if (this.songEl)   this.songEl.textContent   = a.song_title || a.album;
      if (this.artistEl) this.artistEl.textContent = a.artist;
    }

    /* Pill text */
    if (this.pillTrack) this.pillTrack.textContent = a.artist;

    /* Reset progress */
    if (this.progress) {
      this.progress.value = 0;
      this.progress.style.setProperty('--progress', '0%');
    }
    if (this.currentEl)  this.currentEl.textContent  = '0:00';
    if (this.durationEl) this.durationEl.textContent = '0:00';
  }

  /* Slide info out → update → slide in */
  _animateTrackInfo(direction, updateFn) {
    const el = this.infoEl;
    if (!el) { updateFn(); return; }

    const outCls = `ti-out-${direction}`;
    const inCls  = `ti-in-${direction}`;

    /* Remove any leftover animation classes */
    el.classList.remove('ti-out-next','ti-out-prev','ti-in-next','ti-in-prev');

    el.classList.add(outCls);
    el.addEventListener('animationend', () => {
      el.classList.remove(outCls);
      updateFn();
      el.classList.add(inCls);
      el.addEventListener('animationend', () => el.classList.remove(inCls), { once: true });
    }, { once: true });
  }

  /* ── Playback controls ────────────────────────────────── */
  togglePlay() {
    this._initAudioCtx();
    if (this._audioCtx && this._audioCtx.state === 'suspended') this._audioCtx.resume();
    this.audio.paused ? this.audio.play().catch(() => {}) : this.audio.pause();
  }

  prev() {
    const wasPlaying = !this.audio.paused;
    this._dir = 'prev';
    if (this.shuffle) {
      this._pickRandom();
    } else {
      this.index = (this.index - 1 + this.albums.length) % this.albums.length;
    }
    this._renderTrack('prev');
    if (wasPlaying) this.audio.play().catch(() => {});
  }

  /**
   * @param {boolean} fromEnd - true when called by 'ended' event
   */
  next(fromEnd) {
    if (fromEnd && this.loopMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
      return;
    }
    const wasPlaying = !this.audio.paused || fromEnd;
    this._dir = 'next';
    if (this.shuffle) {
      this._pickRandom();
    } else {
      this.index = (this.index + 1) % this.albums.length;
    }
    this._renderTrack('next');
    if (wasPlaying) this.audio.play().catch(() => {});
  }

  _pickRandom() {
    if (this.albums.length <= 1) return;
    let newIdx;
    do { newIdx = Math.floor(Math.random() * this.albums.length); }
    while (newIdx === this.index);
    this.index = newIdx;
  }

  /** Called from music.html album cards */
  playAlbum(albumId) {
    const idx = this.albums.findIndex(a => a.id === albumId);
    if (idx === -1) return;
    const dir = idx > this.index ? 'next' : 'prev';
    this.index = idx;
    this._renderTrack(dir);
    this._initAudioCtx();
    if (this._audioCtx && this._audioCtx.state === 'suspended') this._audioCtx.resume();
    this.audio.play().catch(() => {});
    if (!this.expanded) this.expand();
  }

  /* ── Expand / Collapse ────────────────────────────────── */
  expand() {
    this.panel.removeAttribute('hidden');
    this.panel.classList.remove('closing');
    this.expanded = true;
  }

  collapse() {
    this.panel.classList.add('closing');
    this.panel.addEventListener('animationend', () => {
      this.panel.setAttribute('hidden', '');
      this.panel.classList.remove('closing');
    }, { once: true });
    this.expanded = false;
  }

  /* ── Progress ─────────────────────────────────────────── */
  _updateProgress() {
    if (!this.audio.duration || this._dragging) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    if (this.progress) {
      this.progress.value = pct;
      this.progress.style.setProperty('--progress', pct + '%');
    }
    if (this.currentEl) this.currentEl.textContent = this._fmt(this.audio.currentTime);
  }

  _seek() {
    if (!this.audio.duration) return;
    this.audio.currentTime = (this.progress.value / 100) * this.audio.duration;
    this.progress.style.setProperty('--progress', this.progress.value + '%');
  }

  _seekRelative(delta) {
    if (!this.audio.duration) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + delta));
  }

  /* ── Shuffle / Loop ───────────────────────────────────── */
  _toggleShuffle() {
    this.shuffle = !this.shuffle;
    this.root?.querySelector('#playerShuffle')
      ?.classList.toggle('player__btn--active', this.shuffle);
  }

  _cycleLoop() {
    const modes = ['off', 'all', 'one'];
    this.loopMode = modes[(modes.indexOf(this.loopMode) + 1) % modes.length];
    this._updateLoopUI();
  }

  _updateLoopUI() {
    const btn   = this.root?.querySelector('#playerLoop');
    const badge = this.root?.querySelector('#playerLoopBadge');
    if (btn)   btn.classList.toggle('player__btn--active', this.loopMode !== 'off');
    if (badge) badge.hidden = (this.loopMode !== 'one');
  }

  /* ── Play state (icon + class + hero vinyl) ───────────── */
  _setPlayState(playing) {
    if (this.playIcon) {
      this.playIcon.innerHTML = playing
        ? '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'
        : '<polygon points="5,3 19,12 5,21"/>';
    }
    this.root?.classList.toggle('player--playing', playing);

    /* Sync hero vinyl spin */
    document.querySelectorAll('.vinyl__disc').forEach(d => {
      d.style.animationPlayState = playing ? 'running' : 'paused';
    });
  }

  /* ── Volume helpers ───────────────────────────────────── */
  _syncVolSlider(v) {
    if (this.volumeSlider) {
      this.volumeSlider.value = v;                                  // ← sync thumb position
      this.volumeSlider.style.setProperty('--vol', (v * 100) + '%'); // ← sync track fill
    }
    if (this.volWaves) {
      this.volWaves.style.opacity = (v < 0.01 || this.audio.muted) ? '0' : '1';
    }
  }

  /* ── Persistence (localStorage) ──────────────────────── */
  _saveOnLeave() {
    window.addEventListener('beforeunload', () => {
      if (!this.albums.length) return;
      localStorage.setItem('rg_player', JSON.stringify({
        index:   this.index,
        time:    this.audio.currentTime,
        savedAt: Date.now(),          // ← timestamp for page-load compensation
        playing: !this.audio.paused,
        volume:  this.audio.volume
      }));
    });
  }

  _restoreState() {
    try {
      const raw = localStorage.getItem('rg_player');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /* ── Util ─────────────────────────────────────────────── */
  _fmt(s) {
    if (isNaN(s) || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }
}

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  window.__player = new MiniPlayer();
});
