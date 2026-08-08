// ============================================================
// 全局播放器
// 单例 <audio> 挂在 document 上，路由切换只重绘视图、不重建音频，
// 因此站内跳转不会中断播放。
// ============================================================
import { esc, asset, fmtTime, clamp, ICON } from './util.js';

const LS_KEY = 'muzium.player.v1';

class Player {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.queue = [];          // 当前播放队列
    this.index = -1;
    this.shuffle = false;
    this.repeat = 'off';      // off | all | one（默认不自动连播）
    this.lyrics = null;       // { lines: [...] }
    this.lyricToken = 0;      // 防止异步歌词错配
    this.activeLine = -1;
    this.userScrolling = 0;
    this._built = false;
    this._restore();
  }

  // ---------- 生命周期 ----------
  mount(root) {
    if (this._built) return;
    this._built = true;
    this._build(root);
    this._bindAudio();
    this._bindUI();
    this._volIcon();
    this._render();
  }

  _restore() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      this.volume = typeof s.volume === 'number' ? s.volume : 0.85;
      this.shuffle = !!s.shuffle;
      this.repeat = s.repeat || 'off';
    } catch {
      this.volume = 0.85;
    }
    this.audio.volume = this.volume;
  }

  _save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        volume: this.volume, shuffle: this.shuffle, repeat: this.repeat,
      }));
    } catch { /* 隐私模式下忽略 */ }
  }

  // ---------- DOM ----------
  _build(root) {
    root.innerHTML = `
      <div class="player" id="dock" hidden>
        <div class="p-progress" id="pProg" role="slider" aria-label="播放进度"
             tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="p-progress-buf" id="pBuf"></div>
          <div class="p-progress-fill" id="pFill"></div>
          <div class="p-progress-knob" id="pKnob"></div>
        </div>
        <div class="p-main">
          <div class="p-disc" id="pDisc">
            <img id="pCover" alt="">
            <button class="p-disc-btn" id="pDiscBtn" aria-label="播放 / 暂停">${ICON.play}</button>
          </div>
          <div class="p-meta">
            <div class="p-title" id="pTitle">未在播放</div>
            <div class="p-artist" id="pArtist"></div>
            <div class="p-time"><span id="pCur">0:00</span> / <span id="pDur">0:00</span></div>
          </div>
          <div class="p-ctrls">
            <button class="p-btn" id="pPrev" aria-label="上一首">${ICON.prev}</button>
            <button class="p-btn" id="pPlay" aria-label="播放 / 暂停">${ICON.play}</button>
            <button class="p-btn" id="pNext" aria-label="下一首">${ICON.next}</button>
            <button class="p-btn" id="pQueueBtn" aria-label="播放列表" aria-expanded="false">${ICON.list}</button>
            <button class="p-btn" id="pMax" aria-label="最大化">${ICON.expand}</button>
            <div class="p-vol p-vol-dock">
              <button class="p-btn" id="pMute" aria-label="静音">${ICON.vol}</button>
              <div class="p-vol-pop">
                <input type="range" id="pVol" min="0" max="1" step="0.01" aria-label="音量">
              </div>
            </div>
          </div>
        </div>
        <div class="p-queue" id="pQueue">
          <div class="p-queue-inner">
            <div class="p-queue-head"><span>播放列表</span><span id="pQCount"></span></div>
            <div id="pQList"></div>
          </div>
        </div>
      </div>

      <div class="pmax" id="pmax" role="dialog" aria-modal="true" aria-label="播放器">
        <div class="pmax-bg"><img id="mxBg" alt=""></div>
        <div class="pmax-top">
          <span class="eyebrow">正在播放</span>
          <button class="p-btn" id="mxClose" aria-label="收起">${ICON.collapse}</button>
        </div>
        <div class="pmax-body">
          <div class="pmax-art" id="mxArt"><img id="mxCover" alt=""></div>
          <div class="pmax-info">
            <h2 class="pmax-title" id="mxTitle"></h2>
            <div class="pmax-artist" id="mxArtist"></div>
            <div class="pmax-tags" id="mxTags"></div>
            <div class="lyrics" id="mxLyrics"></div>
          </div>
        </div>
        <div class="pmax-foot">
          <div class="pmax-credit">歌词格式参考 Apple Music Like Lyric</div>
          <div class="pmax-bar">
            <span class="t" id="mxCur">0:00</span>
            <div class="pmax-seek" id="mxSeek" role="slider" aria-label="播放进度"
                 tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="pmax-seek-fill" id="mxFill"></div>
            </div>
            <span class="t" id="mxDur">0:00</span>
          </div>
          <div class="pmax-ctrls">
            <button class="p-btn" id="mxShuffle" aria-label="随机播放">${ICON.shuffle}</button>
            <button class="p-btn" id="mxPrev" aria-label="上一首">${ICON.prev}</button>
            <button class="p-btn pmax-play" id="mxPlay" aria-label="播放 / 暂停">${ICON.play}</button>
            <button class="p-btn" id="mxNext" aria-label="下一首">${ICON.next}</button>
            <button class="p-btn" id="mxRepeat" aria-label="循环模式">${ICON.repeat}</button>
            <button class="p-btn" id="mxQueueBtn" aria-label="播放列表" aria-expanded="false">${ICON.list}</button>
            <div class="p-vol">
              <button class="p-btn" id="mxMute" aria-label="静音">${ICON.vol}</button>
              <input type="range" id="mxVol" min="0" max="1" step="0.01" aria-label="音量">
            </div>
          </div>
        </div>
        <div class="pmax-queue" id="mxQueue">
          <div class="p-queue-inner">
            <div class="p-queue-head"><span>播放列表</span><span id="mxQCount"></span></div>
            <div id="mxQList"></div>
          </div>
        </div>
      </div>`;

    const $ = (id) => root.querySelector('#' + id);
    this.$ = {
      dock: $('dock'), prog: $('pProg'), buf: $('pBuf'), fill: $('pFill'), knob: $('pKnob'),
      disc: $('pDisc'), cover: $('pCover'), discBtn: $('pDiscBtn'),
      title: $('pTitle'), artist: $('pArtist'), cur: $('pCur'), dur: $('pDur'),
      prev: $('pPrev'), play: $('pPlay'), next: $('pNext'),
      queueBtn: $('pQueueBtn'), queue: $('pQueue'), qList: $('pQList'), qCount: $('pQCount'),
      max: $('pMax'),
      mute: $('pMute'), vol: $('pVol'),
      pmax: $('pmax'), mxBg: $('mxBg'), mxArt: $('mxArt'), mxCover: $('mxCover'),
      mxTitle: $('mxTitle'), mxArtist: $('mxArtist'), mxTags: $('mxTags'), mxLyrics: $('mxLyrics'),
      mxCur: $('mxCur'), mxDur: $('mxDur'), mxSeek: $('mxSeek'), mxFill: $('mxFill'),
      mxPrev: $('mxPrev'), mxPlay: $('mxPlay'), mxNext: $('mxNext'), mxClose: $('mxClose'),
      mxShuffle: $('mxShuffle'), mxRepeat: $('mxRepeat'), mxMute: $('mxMute'), mxVol: $('mxVol'),
      mxQueue: $('mxQueue'), mxQueueBtn: $('mxQueueBtn'), mxQList: $('mxQList'), mxQCount: $('mxQCount'),
    };
    this.$.mxVol.value = this.volume;
  }

  _bindAudio() {
    const a = this.audio;
    a.addEventListener('timeupdate', () => { this._tick(); });
    a.addEventListener('progress', () => this._buffered());
    a.addEventListener('durationchange', () => {
      this.$.dur.textContent = fmtTime(a.duration);
      this.$.mxDur.textContent = fmtTime(a.duration);
    });
    a.addEventListener('play', () => this._playState(true));
    a.addEventListener('pause', () => this._playState(false));
    a.addEventListener('ended', () => this._onEnded());
    a.addEventListener('error', () => {
      if (!this.current) return;
      this.$.title.textContent = '无法播放：' + (this.current.title || '');
    });
  }

  _bindUI() {
    const S = this.$;
    const toggle = () => this.toggle();
    S.play.onclick = toggle;
    S.discBtn.onclick = toggle;
    S.mxPlay.onclick = toggle;
    S.prev.onclick = S.mxPrev.onclick = () => this.prev();
    S.next.onclick = S.mxNext.onclick = () => this.next();

    S.queueBtn.onclick = () => {
      const open = S.queue.classList.toggle('open');
      S.queueBtn.setAttribute('aria-expanded', String(open));
      S.queueBtn.classList.toggle('on', open);
    };
    S.max.onclick = () => this.maximize(true);
    S.mxClose.onclick = () => this.maximize(false);

    // 小窗音量：与全屏音量共用同一 this.volume，实时同步
    S.vol.value = this.volume;
    S.vol.oninput = () => {
      this.volume = parseFloat(S.vol.value);
      this.audio.volume = this.volume;
      this.audio.muted = false;
      this._volIcon();
      this._save();
    };
    S.mute.onclick = () => {
      this.audio.muted = !this.audio.muted;
      this._volIcon();
    };
    // 小窗音量：用 JS 控制展开状态（而非 CSS :hover），避免滑块展开后鼠标脱离图标导致反复闪烁。
    // 离开后延迟收起（增大容差），移回容器则取消；移入弹出层本身不算离开。
    const dockVol = document.querySelector('.p-vol-dock');
    if (dockVol) {
      let volTimer = null;
      const openVol = () => {
        if (volTimer) { clearTimeout(volTimer); volTimer = null; }
        dockVol.classList.add('open');
      };
      const closeVol = (e) => {
        const to = e && e.relatedTarget;
        if (to && dockVol.contains(to)) return;  // 移到子元素（音量条/桥接区）上，保持展开
        if (volTimer) clearTimeout(volTimer);
        volTimer = setTimeout(() => dockVol.classList.remove('open'), 160);
      };
      dockVol.addEventListener('mouseenter', openVol);
      dockVol.addEventListener('mouseleave', closeVol);
      dockVol.addEventListener('focusin', openVol);
      dockVol.addEventListener('focusout', closeVol);
    }

    this._seekable(S.prog, S.knob);
    this._seekable(S.mxSeek);

    S.mxShuffle.onclick = () => {
      this.shuffle = !this.shuffle;
      S.mxShuffle.classList.toggle('on', this.shuffle);
      this._save();
    };
    S.mxRepeat.onclick = () => {
      this.repeat = this.repeat === 'all' ? 'one' : this.repeat === 'one' ? 'off' : 'all';
      this._repeatUI();
      this._save();
    };
    S.mxShuffle.classList.toggle('on', this.shuffle);
    this._repeatUI();

    S.mxVol.oninput = () => {
      this.volume = parseFloat(S.mxVol.value);
      this.audio.volume = this.volume;
      this.audio.muted = false;
      this._volIcon();
      this._save();
    };
    S.mxMute.onclick = () => {
      this.audio.muted = !this.audio.muted;
      this._volIcon();
    };

    // 全屏播放列表
    S.mxQueueBtn.onclick = () => {
      const open = S.mxQueue.classList.toggle('open');
      S.mxQueueBtn.setAttribute('aria-expanded', String(open));
      S.mxQueueBtn.classList.toggle('on', open);
    };

    // 歌词区手动滚动时，暂停自动跟随
    S.mxLyrics.addEventListener('scroll', () => {
      if (this._autoScrolling) return;
      this.userScrolling = Date.now();
    }, { passive: true });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === 'Escape' && S.pmax.classList.contains('open')) { this.maximize(false); return; }
      if (!this.current) return;
      if (e.code === 'Space') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'ArrowRight' && e.shiftKey) this.next();
      else if (e.key === 'ArrowLeft' && e.shiftKey) this.prev();
      else if (e.key === 'ArrowRight') this.audio.currentTime += 5;
      else if (e.key === 'ArrowLeft') this.audio.currentTime -= 5;
    });
  }

  /** 让进度条支持点击 + 拖拽 + 键盘 */
  _seekable(node, knob) {
    const pct = (e) => {
      const r = node.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      return clamp(x / r.width, 0, 1);
    };
    const seek = (e) => {
      if (!this.audio.duration) return;
      const p = pct(e);
      this.audio.currentTime = p * this.audio.duration;
      if (knob) knob.style.left = p * 100 + '%';
    };
    let dragging = false;
    node.addEventListener('pointerdown', (e) => {
      dragging = true; node.setPointerCapture?.(e.pointerId); seek(e);
    });
    node.addEventListener('pointermove', (e) => {
      if (knob && !dragging) knob.style.left = pct(e) * 100 + '%';
      if (dragging) seek(e);
    });
    node.addEventListener('pointerup', () => { dragging = false; });
    node.addEventListener('pointercancel', () => { dragging = false; });
    node.addEventListener('keydown', (e) => {
      if (!this.audio.duration) return;
      if (e.key === 'ArrowRight') { this.audio.currentTime += 5; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { this.audio.currentTime -= 5; e.preventDefault(); }
    });
  }

  // ---------- 播放控制 ----------
  get current() { return this.queue[this.index] || null; }

  /**
   * 播放一个队列。
   * 若目标曲目已在播放，则仅切换暂停/继续，避免重复加载。
   */
  play(queue, index = 0, { autoplay = true } = {}) {
    const next = queue[index];
    if (!next) return;
    const same = this.current && this.current.url === next.url;
    this.queue = queue;
    this.index = index;
    if (same) {
      this._render();
      if (autoplay) this.audio.paused ? this.audio.play().catch(() => {}) : this.audio.pause();
      return;
    }
    this.audio.src = asset(next.url);
    this.audio.currentTime = 0;
    if (autoplay) this.audio.play().catch(() => {});
    this._render();
    this._loadLyrics(next);
  }

  toggle() {
    if (!this.current) {
      if (this.queue.length) this.play(this.queue, 0);
      return;
    }
    this.audio.paused ? this.audio.play().catch(() => {}) : this.audio.pause();
  }

  next(auto = false) {
    if (!this.queue.length) return;
    // 自动连播（一曲结束触发）且未开启循环时，停止，不跳下一首
    if (auto && this.repeat === 'off') { this.audio.pause(); return; }
    if (this.shuffle) {
      let i = this.index;
      if (this.queue.length > 1) while (i === this.index) i = Math.floor(Math.random() * this.queue.length);
      return this.play(this.queue, i);
    }
    const last = this.index >= this.queue.length - 1;
    if (last && this.repeat === 'off') { this.audio.pause(); return; }
    this.play(this.queue, last ? 0 : this.index + 1);
  }

  prev() {
    if (!this.queue.length) return;
    if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    this.play(this.queue, this.index <= 0 ? this.queue.length - 1 : this.index - 1);
  }

  _onEnded() {
    if (this.repeat === 'one') {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
      return;
    }
    this.next(true);
  }

  maximize(on) {
    this.$.pmax.classList.toggle('open', on);
    this.$.dock.classList.toggle('hidden-dock', on);
    document.body.classList.toggle('is-locked', on);
    if (on) {
      this.activeLine = -1;
      this.userScrolling = 0;
      requestAnimationFrame(() => this._tick(true));
      this._raf();
    } else {
      this._stopRaf();
    }
  }

  // ---------- 渲染 ----------
  _render() {
    const s = this.current;
    const S = this.$;
    S.dock.hidden = !s;
    if (!s) return;

    const cover = asset(s.cover || '');
    const artist = Array.isArray(s.artist) ? s.artist.join(' / ') : (s.artist || '');
    const timbre = Array.isArray(s.timbre) ? s.timbre : (s.timbre ? [s.timbre] : []);

    S.cover.src = cover; S.cover.alt = s.title || '';
    S.title.textContent = s.title || '';
    S.artist.textContent = artist;
    S.mxCover.src = cover; S.mxCover.alt = s.title || '';
    S.mxBg.src = cover;
    S.mxTitle.textContent = s.title || '';
    S.mxArtist.textContent = artist;
    S.mxTags.innerHTML = [
      ...timbre.map((t) => `<span class="tag">${esc(t)}</span>`),
      s.engine ? `<span class="tag tag-accent">${esc(s.engine)}</span>` : '',
    ].join('');

    S.qCount.textContent = `${this.index + 1} / ${this.queue.length}`;
    S.mxQCount.textContent = `${this.index + 1} / ${this.queue.length}`;
    const qHtml = this.queue.map((t, i) => `
      <div class="p-q-item${i === this.index ? ' on' : ''}" data-i="${i}">
        <span class="p-q-idx">${i === this.index ? '▶' : i + 1}</span>
        <div class="p-q-body">
          <div class="p-q-title">${esc(t.title)}</div>
          <div class="p-q-artist">${esc(Array.isArray(t.artist) ? t.artist.join(' / ') : t.artist || '')}</div>
        </div>
      </div>`).join('');
    S.qList.innerHTML = qHtml;
    if (S.mxQList) S.mxQList.innerHTML = qHtml;
    S.qList.querySelectorAll('.p-q-item').forEach((n) => {
      n.onclick = () => this.play(this.queue, +n.dataset.i);
    });
    if (S.mxQList) S.mxQList.querySelectorAll('.p-q-item').forEach((n) => {
      n.onclick = () => this.play(this.queue, +n.dataset.i);
    });

    document.dispatchEvent(new CustomEvent('player:change', { detail: { song: s, index: this.index } }));
    this._mediaSession(s, artist, cover);
  }

  _playState(playing) {
    // rAF 全程保持：暂停时也需要滚动定位到当前行。
    // 播放时再启动一次（_raf 内部有 self-check 不会重复注册）。
    this._raf();
    const icon = playing ? ICON.pause : ICON.play;
    this.$.play.innerHTML = icon;
    this.$.discBtn.innerHTML = icon;
    this.$.mxPlay.innerHTML = icon;
    this.$.disc.classList.toggle('spinning', playing);
    this.$.mxArt.classList.toggle('spinning', playing);
    document.dispatchEvent(new CustomEvent('player:state', {
      detail: { playing, song: this.current },
    }));
  }

  _repeatUI() {
    const b = this.$.mxRepeat;
    b.classList.toggle('on', this.repeat !== 'off');
    b.title = { all: '列表循环', one: '单曲循环', off: '不循环' }[this.repeat];
    b.style.position = 'relative';
    b.innerHTML = ICON.repeat + (this.repeat === 'one'
      ? '<span style="position:absolute;right:5px;bottom:4px;font-size:9px;font-weight:700">1</span>'
      : '');
  }

  _volIcon() {
    const off = this.audio.muted || this.volume === 0;
    this.$.mxMute.innerHTML = off ? ICON.mute : ICON.vol;
    this.$.mute.innerHTML = off ? ICON.mute : ICON.vol;
  }

  _buffered() {
    const a = this.audio;
    if (!a.duration || !a.buffered.length) return;
    this.$.buf.style.width = (a.buffered.end(a.buffered.length - 1) / a.duration) * 100 + '%';
  }

  _tick(force = false) {
    const a = this.audio;
    const p = a.duration ? (a.currentTime / a.duration) * 100 : 0;
    this.$.fill.style.width = p + '%';
    this.$.mxFill.style.width = p + '%';
    this.$.cur.textContent = fmtTime(a.currentTime);
    this.$.mxCur.textContent = fmtTime(a.currentTime);
    this.$.prog.setAttribute('aria-valuenow', Math.round(p));
    this.$.mxSeek.setAttribute('aria-valuenow', Math.round(p));
    if (this.$.pmax.classList.contains('open')) this._syncLyrics(a.currentTime * 1000, force);
  }

  _mediaSession(s, artist, cover) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.title || '', artist, album: 'MUZIUM',
        artwork: cover ? [{ src: new URL(cover, location.href).href, sizes: '512x512', type: 'image/png' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => this.audio.play());
      navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
    } catch { /* 部分浏览器不支持 */ }
  }

  // ---------- 歌词 ----------
  async _loadLyrics(song) {
    const token = ++this.lyricToken;
    this.lyrics = null;
    this.activeLine = -1;
    const S = this.$;
    if (!song.lyricData) {
      S.mxLyrics.innerHTML = '<div class="lyrics-empty">暂无歌词</div>';
      return;
    }
    S.mxLyrics.innerHTML = '<div class="lyrics-empty">歌词加载中…</div>';
    try {
      const r = await fetch(song.lyricData);
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      if (token !== this.lyricToken) return;   // 已切歌
      this.lyrics = data;
      this._renderLyrics(data);
      // 歌词就位后立刻按当前播放时间定位到对应行并居中，
      // 否则用户打开最大化时看到的是「第 0 行在顶部」。
      if (this.$.pmax.classList.contains('open')) {
        this.activeLine = -1;     // 强制 _syncLyrics 走一次居中分支
        this._syncLyrics(this.audio.currentTime * 1000, true);
      }
    } catch {
      if (token === this.lyricToken) S.mxLyrics.innerHTML = '<div class="lyrics-empty">歌词加载失败</div>';
    }
  }

  _renderLyrics(data) {
    const lines = data.lines || [];
    if (!lines.length) {
      this.$.mxLyrics.innerHTML = '<div class="lyrics-empty">暂无歌词</div>';
      return;
    }
    const html = ['<div class="lyrics-pad"></div>'];
    lines.forEach((ln, i) => {
      const syl = (ln.syllables || [])
        .map((s, j) => `<span class="syl" data-l="${i}" data-j="${j}"
              style="background-position:100% 0">${esc(s.t)}</span>`)
        .join('');
      html.push(
        `<div class="lyric-line${ln.background ? ' bg' : ''}" data-i="${i}" data-s="${ln.start}">` +
        (syl || esc(ln.text || '')) +
        (ln.translation ? `<span class="lyric-trans">${esc(ln.translation)}</span>` : '') +
        `</div>`
      );
    });
    html.push('<div class="lyrics-pad"></div>');
    this.$.mxLyrics.innerHTML = html.join('');

    this._lineNodes = [...this.$.mxLyrics.querySelectorAll('.lyric-line')];
    this._sylNodes = this._lineNodes.map((n) => [...n.querySelectorAll('.syl')]);

    // 点击歌词跳转
    this._lineNodes.forEach((n) => {
      n.onclick = () => {
        const t = parseFloat(n.dataset.s) / 1000;
        if (isFinite(t)) {
          this.audio.currentTime = t;
          this.userScrolling = 0;
          if (this.audio.paused) this.audio.play().catch(() => {});
        }
      };
    });
  }

  /** 按当前时间推进「行高亮」与「逐字填充」 */
  _syncLyrics(ms, force = false) {
    const data = this.lyrics;
    if (!data || !this._lineNodes) return;
    const lines = data.lines;

    let idx = -1;
    // 不能用 `else break`：背景/装饰行常常没有 start（默认 0），
    // 会让首个未命中的行把循环卡住，后续真正正在唱的行永远滚不到正中。
    for (let i = 0; i < lines.length; i++) {
      if (ms >= lines[i].start - 60) idx = i;
    }

    if (idx !== this.activeLine || force) {
      const prev = this.activeLine;
      this._lineNodes.forEach((n, i) => {
        n.classList.toggle('active', i === idx);
        n.classList.toggle('done', i < idx);
      });
      // 离开的行整体点亮/复位，避免残留中间态
      if (prev >= 0 && prev !== idx) this._fillLine(prev, prev < idx ? 1 : 0);
      // 向前跳转（拖动进度条 / 点歌词）：把后面所有行复位为未唱
      if (idx < prev) for (let i = idx + 1; i < this._lineNodes.length; i++) this._fillLine(i, 0);
      this.activeLine = idx;
      if (idx >= 0 && Date.now() - this.userScrolling > 4000) this._scrollTo(this._lineNodes[idx]);
    }

    // 逐字填充：只算当前行，开销恒定
    if (idx < 0) return;
    const syls = lines[idx].syllables || [];
    const nodes = this._sylNodes[idx] || [];
    for (let j = 0; j < nodes.length; j++) {
      const s = syls[j];
      if (!s) continue;
      const dur = Math.max(1, s.e - s.s);
      const p = clamp((ms - s.s) / dur, 0, 1);
      // background-position 从 100%(未唱) 走到 0%(唱完)
      nodes[j].style.backgroundPosition = `${(1 - p) * 100}% 0`;
      nodes[j].classList.toggle('up', p > 0 && p < 1);
    }
  }

  /** 把整行的逐字进度一次性设为 0（未唱）或 1（唱完） */
  _fillLine(i, p) {
    (this._sylNodes[i] || []).forEach((n) => {
      n.style.backgroundPosition = `${(1 - p) * 100}% 0`;
      n.classList.remove('up');
    });
  }

  /** timeupdate 只有 ~4Hz，逐字填充需要 rAF 才够顺滑。
   *  暂停时也要循环：用户常会「暂停后看歌词定位」，需要保持当前行居中。 */
  _raf() {
    if (this._rafId) return;
    const loop = () => {
      this._rafId = 0;
      if (!this.$.pmax.classList.contains('open')) return;
      // 取消暂停判断：rAF 始终按当前 currentTime 推进，
      // 暂停时也能把当前行滚到正中、已唱行填充完整。
      this._syncLyrics(this.audio.currentTime * 1000);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _stopRaf() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  _scrollTo(node) {
    // 下一帧再测量：刚切布局（flex 撑高）时首帧 clientHeight 可能未稳定，
    // 否则会算错居中位置、退化成"停在顶端"。
    requestAnimationFrame(() => {
      if (!node.isConnected) return;
      const box = this.$.mxLyrics;
      // 用 getBoundingClientRect 相对 .lyrics 容器自身计算，
      // 完全不依赖 offsetParent，避免基准错乱导致永远停在顶端。
      const bRect = box.getBoundingClientRect();
      const nRect = node.getBoundingClientRect();
      const delta = (nRect.top + nRect.height / 2) - (bRect.top + bRect.height / 2);
      const max = box.scrollHeight - box.clientHeight;
      const top = Math.max(0, Math.min(max, box.scrollTop + delta));
      this._autoScrolling = true;
      box.scrollTo({ top, behavior: 'smooth' });
      clearTimeout(this._asTimer);
      this._asTimer = setTimeout(() => { this._autoScrolling = false; }, 700);
    });
  }
}

export const player = new Player();
