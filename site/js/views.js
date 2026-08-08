// 页面视图渲染
import { esc, asset, el, ICON, applyAccent, LANG_SVG } from './util.js';
import { player } from './player.js';
import { renderMarkdown } from './markdown.js';

/**
 * 干声试听：独立本地播放，不接入全局播放器。
 * 每条样本用自己的 <audio> 实例；进度以「与该行同大小的矩形」作背景填充，
 * 从左向右随时间推进，填充色为歌手首要代表色（var(--accent)）50% 透明度。
 * 播放中按钮切换为暂停图标；同页一次只放一条。
 */
function bindSampleRows(scope) {
  const rows = [...scope.querySelectorAll('.sample-row')];
  if (!rows.length) return;
  const players = new Map();  // row -> Audio

  const stop = (n) => {
    const a = players.get(n);
    if (a && !a.paused) a.pause();
  };
  const setIcon = (n, playing) => {
    const el = n.querySelector('.sample-play');
    if (el) el.innerHTML = playing ? ICON.pause : ICON.play;
    n.classList.toggle('playing', playing);
  };

  // 用 rAF 逐帧推进进度，避免 timeupdate(默认~250ms) 造成填充跳跃/卡顿
  const tick = (n, a) => {
    const p = a.duration ? (a.currentTime / a.duration) * 100 : 0;
    n.style.setProperty('--progress', p + '%');
    if (!a.paused) n._raf = requestAnimationFrame(() => tick(n, a));
  };

  rows.forEach((n) => {
    const a = new Audio(asset(n.dataset.url));
    a.preload = 'none';
    players.set(n, a);

    a.addEventListener('ended', () => {
      if (n._raf) cancelAnimationFrame(n._raf);
      setIcon(n, false);
      n.style.setProperty('--progress', '0%');
    });
    a.addEventListener('play', () => {
      // 暂停其它正在播放的干声，保持单声道体验
      players.forEach((_other, on) => { if (on !== n) stop(on); });
      setIcon(n, true);
      if (n._raf) cancelAnimationFrame(n._raf);
      n._raf = requestAnimationFrame(() => tick(n, a));
    });
    a.addEventListener('pause', () => {
      if (n._raf) cancelAnimationFrame(n._raf);
      setIcon(n, false);
    });

    n.onclick = () => {
      if (a.paused) a.play().catch(() => {});
      else a.pause();
    };
  });
}

function bindTrackRows(scope, songs) {
  scope.querySelectorAll('.track').forEach((n) => {
    n.onclick = (e) => {
      // 点击歌手索引链接时只跳转，不触发整行播放
      if (e.target.closest('.artist-link')) return;
      player.play(songs, +n.dataset.i);
    };
  });
}

/** 高亮当前播放项 */
export function syncPlayingUI(song) {
  const url = song ? song.url : null;
  document.querySelectorAll('.track').forEach((n) => {
    n.classList.toggle('playing', !!url && n.dataset.url === url);
  });
  document.querySelectorAll('.sample-row').forEach((n) => {
    n.classList.toggle('playing', !!url && n.dataset.url === url);
  });
}

/** 歌手名 → 角色 slug。只有存在详情页的歌手才可跳转（如「澄琮」暂无角色条目）。 */
function slugMap(characters) {
  return new Map((characters || []).map((c) => [c.name, c.slug]));
}

/** 渲染歌手名：有详情页的渲染为链接，否则为普通文本 */
function artistCell(artists, slugs) {
  return (artists || []).map((name) => {
    const slug = slugs?.get(name);
    return slug
      ? `<a class="artist-link" href="#/c/${esc(slug)}"
          title="查看 ${esc(name)} 的详情">${esc(name)}</a>`
      : `<span class="artist-plain">${esc(name)}</span>`;
  }).join('<span class="artist-sep"> / </span>');
}

/**
 * @param s      歌曲
 * @param i      在播放队列中的下标（点击播放用）
 * @param no     显示的序号，缺省时用 i+1。角色页需要本地序号而非全局序号。
 * @param slugs  歌手名→slug 映射，用于歌手索引跳转
 */
const trackRow = (s, i, no, slugs) => `
  <div class="track" data-i="${i}" data-url="${esc(s.url)}">
    <span class="track-idx">
      <span class="n">${String(Array.isArray(no) ? i + 1 : (no ?? i + 1)).padStart(2, '0')}</span>
      <span class="track-eq" hidden><i></i><i></i><i></i></span>
    </span>
    <span class="track-title">${esc(s.title)}</span>
    <span class="track-artist">${artistCell(s.artist, slugs)}</span>
    <span class="track-timbre">${esc((s.timbre || []).join(' / '))}</span>
    <span class="track-engine"><span class="tag">${esc(s.engine || '')}</span></span>
  </div>`;

// ============================================================
// 首页
// ============================================================
export function viewHome({ characters, playlist }) {
  applyAccent(null, null);
  const slugs = slugMap(characters);
  const vbCount = characters.reduce((n, c) => n + c.voicebanks.length, 0);
  const engines = new Set(characters.flatMap((c) => c.voicebanks.map((v) => v.engine)));

  const node = el(`<div>
    <section class="hero">
      <p class="eyebrow reveal">Muzium · Virtual Singer Archive</p>
      <h1 class="hero-title reveal">Muzium<br>藏声馆</h1>
      <p class="hero-sub reveal">收录原创虚拟角色的设定资料、歌声数据库与成品作品。
        在这里了解每一位歌手的来历，试听各引擎下的音色表现，并聆听由他们演绎的歌曲。</p>
      <div class="hero-actions reveal">
        <a class="btn btn-primary" href="#/gallery">进入展厅</a>
        <a class="btn" href="#characters">浏览角色</a>
      </div>
      <div class="hero-stats reveal">
        <div class="stat"><div class="n">${characters.length}</div><div class="l">CHARACTERS</div></div>
        <div class="stat"><div class="n">${vbCount}</div><div class="l">VOICEBANKS</div></div>
        <div class="stat"><div class="n">${engines.size}</div><div class="l">ENGINES</div></div>
        <div class="stat"><div class="n">${playlist.length}</div><div class="l">TRACKS</div></div>
      </div>
    </section>

    <section class="section" id="characters">
      <div class="section-title reveal">
        <h2>歌手一览</h2><span class="count">${characters.length} CHARACTERS</span>
      </div>
      <div class="char-grid reveal">
        ${characters.map((c) => {
          const cover = c.illusts[0]?.illust || c.album;
          return `<a class="char-card" href="#/c/${c.slug}" style="--c:${esc(c.colors.primary || '#c9a227')}">
            <span class="char-card-bar"></span>
            <img src="${asset(cover)}" alt="${esc(c.name)}" loading="lazy">
            <span class="char-card-body">
              <span class="char-card-name">${esc(c.name)}</span>
              <span class="char-card-tag">${esc(c.tagline)}</span>
            </span>
          </a>`;
        }).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-title reveal">
        <h2>作品展厅</h2><span class="count">${playlist.length} TRACKS</span>
      </div>
      <div class="tracks reveal">${playlist.map((s) => trackRow(s, playlist.indexOf(s), undefined, slugs)).join('')}</div>
    </section>
  </div>`);

  bindTrackRows(node, playlist);
  return node;
}

// ============================================================
// 展厅（完整歌单）
// ============================================================
export function viewGallery({ playlist, characters }) {
  applyAccent(null, null);
  const slugs = slugMap(characters);

  const node = el(`<div>
    <section class="section">
      <p class="eyebrow reveal">Gallery</p>
      <div class="section-title reveal" style="margin-top:14px">
        <h2>作品展厅</h2><span class="count">${playlist.length} TRACKS</span>
      </div>
      <div class="tracks reveal">${playlist.map((s) => trackRow(s, playlist.indexOf(s), undefined, slugs)).join('')}</div>
    </section>
  </div>`);

  bindTrackRows(node, playlist);
  return node;
}

// ============================================================
// 角色详情
// ============================================================
export function viewCharacter(char, { playlist, characters }) {
  applyAccent(char.colors.primary, char.colors.secondary);
  // 当前角色自身不再生成跳转链接（已在本页），其余合作歌手可跳转
  const slugs = slugMap(characters);
  slugs.delete(char.name);

  const illusts = char.illusts.length ? char.illusts : [{
    title: char.name, illust: char.album, icon: char.album, design: '', paint: '',
  }];

  const songs = playlist.filter((s) => (s.artist || []).includes(char.name));
  const vbs = char.voicebanks;
  const engId = (i) => `vb-${char.slug}-${i}`;

  const node = el(`<div>
    <section class="char-hero">
      <div class="char-layout">
        <div>
          <div class="illust-stage" id="stage">
            ${illusts.map((v, i) => `<img src="${asset(v.illust)}" alt="${esc(v.title)}"
              class="${i === 0 ? 'on' : ''}" data-i="${i}" ${i === 0 ? '' : 'loading="lazy"'}>`).join('')}
          </div>
          <div class="illust-picker" id="picker" role="tablist" aria-label="立绘切换">
            ${illusts.map((v, i) => `
              <button class="illust-thumb${i === 0 ? ' on' : ''}" data-i="${i}"
                      role="tab" aria-selected="${i === 0}" title="${esc(v.title)}">
                <img src="${asset(v.icon || v.illust)}" alt="${esc(v.title)}" loading="lazy">
              </button>`).join('')}
          </div>
          <div class="illust-meta" id="illustMeta"></div>
        </div>

        <div>
          <p class="eyebrow">${esc(char.slug)}</p>
          <h1 class="char-name">${esc(char.name)}</h1>
          <p class="char-tagline">${esc(char.tagline)}</p>
          ${char.subtitle ? `<p class="char-subtitle">${esc(char.subtitle)}</p>` : ''}
          <dl class="profile-list">
            ${Object.entries(char.profile).map(([k, v]) => `
              <div class="profile-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
          </dl>
          ${(char.colors.primary || char.colors.secondary) ? `<div class="swatches">
            ${char.colors.primary ? `<span class="swatch"><i style="background:${esc(char.colors.primary)}"></i>${esc(char.colors.primary)}</span>` : ''}
            ${char.colors.secondary ? `<span class="swatch"><i style="background:${esc(char.colors.secondary)}"></i>${esc(char.colors.secondary)}</span>` : ''}
          </div>` : ''}
        </div>
      </div>
    </section>

    <section class="engines">
      <div class="section-title reveal">
        <h2>声库展示与下载</h2><span class="count">${vbs.length} VOICEBANKS</span>
      </div>
      <div class="engines-layout">
        <div class="engines-main">
          ${vbs.map((vb, i) => engineBlock(vb, char, engId(i))).join('')}
        </div>
        ${vbs.length > 1 ? `<nav class="engine-rail" id="engineRail" aria-label="引擎导航">
          <div class="engine-rail-title">ENGINES</div>
          ${vbs.map((vb, i) => `<a href="#${engId(i)}" data-target="${engId(i)}"
            >${esc(vb.engine)}</a>`).join('')}
        </nav>` : ''}
      </div>
    </section>

    ${songs.length ? `<section class="section works">
      <div class="section-title reveal"><h2>参与作品</h2><span class="count">${songs.length} TRACKS</span></div>
      <div class="tracks reveal">${
        // 序号按本角色内部排序，不沿用全局歌单序号
        songs.map((s, n) => trackRow(s, playlist.indexOf(s), n + 1, slugs)).join('')
      }</div>
    </section>` : ''}
  </div>`);

  bindEngineRail(node);

  // 立绘切换
  const stage = node.querySelector('#stage');
  const picker = node.querySelector('#picker');
  const meta = node.querySelector('#illustMeta');
  const showIllust = (i) => {
    stage.querySelectorAll('img').forEach((n) => n.classList.toggle('on', +n.dataset.i === i));
    picker?.querySelectorAll('.illust-thumb').forEach((n) => {
      const on = +n.dataset.i === i;
      n.classList.toggle('on', on);
      n.setAttribute('aria-selected', String(on));
    });
    const v = illusts[i];
    meta.innerHTML = [
      `<strong>${esc(v.title)}</strong>`,
      v.design ? `设计 ${esc(v.design)}` : '',
      v.paint ? `绘制 ${esc(v.paint)}` : '',
    ].filter(Boolean).join(' ・ ');
  };
  picker?.querySelectorAll('.illust-thumb').forEach((n) => {
    n.onclick = () => showIllust(+n.dataset.i);
  });
  showIllust(0);

  bindTrackRows(node, playlist);
  bindSampleRows(node);
  return node;
}

/**
 * 右侧吸附跳转条：点击滚动到对应引擎（顶部栏下方即为该章节起点），
 * 滚动时高亮当前所在章节。
 */
function bindEngineRail(scope) {
  const rail = scope.querySelector('#engineRail');
  if (!rail) return;

  // 此时节点尚未插入文档，等挂载后再计算位置并接管滚动
  if (!document.contains(rail)) {
    requestAnimationFrame(() => bindEngineRail(scope));
    return;
  }

  const links = [...rail.querySelectorAll('a')];
  const blocks = links.map((a) => scope.querySelector(`#${CSS.escape(a.dataset.target)}`));

  const topbar = () => (document.getElementById('topbar')?.offsetHeight || 64);
  const setActive = (i) => links.forEach((a, k) => a.classList.toggle('on', k === i));

  // 点击后短暂锁定高亮，避免平滑滚动途中被中间章节抢走
  let lock = 0;

  links.forEach((a, i) => {
    a.onclick = (e) => {
      e.preventDefault();               // 不写入 location.hash，避免干扰路由
      const target = blocks[i];
      if (!target) return;
      // 让该章节顶部正好落在顶栏下沿
      const y = target.getBoundingClientRect().top + window.scrollY - topbar();
      window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: 'smooth' });
      setActive(i);
      lock = Date.now() + 700;
    };
  });

  // 以「顶栏下沿」为判定线，找出当前所在的章节
  const onScroll = () => {
    if (Date.now() < lock) return;
    const line = topbar() + 8;
    let cur = 0;
    blocks.forEach((b, i) => { if (b && b.getBoundingClientRect().top <= line) cur = i; });
    setActive(cur);
  };

  let ticking = false;
  const handler = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onScroll(); });
  };

  window.addEventListener('scroll', handler, { passive: true });
  // 视图被替换后自动解绑，避免旧页面的监听器堆积
  new MutationObserver((_, ob) => {
    if (!document.contains(rail)) { window.removeEventListener('scroll', handler); ob.disconnect(); }
  }).observe(document.getElementById('view'), { childList: true });

  onScroll();
}

function engineBlock(vb, char, id) {
  const langs = vb.languages.map((l) => {
    // 语言图标直接内联全局 SVG 资源（LANG_SVG 已用 currentColor 填充，
    // 跟随 .lang-ico 的 color：亮=黑、暗=白），无需 fetch 外部文件。
    const icon = l.code && LANG_SVG[l.code] ? LANG_SVG[l.code] : '';
    return `<span class="lang-chip">${icon
      ? `<span class="lang-ico">${icon}</span>`
      : ''}${esc(l.label)}</span>`;
  }).join('');

  const timbres = vb.timbres.map((t) => `
    <div class="timbre-card">
      <div class="timbre-head"><span class="timbre-name">${esc(t.name)}</span></div>
      ${t.intro ? `<p class="timbre-intro">${esc(t.intro)}</p>` : ''}
      <div class="timbre-specs">
        ${t.range ? `<span>推荐音域 <b>${esc(t.range)}</b></span>` : ''}
        ${t.tempo ? `<span>推荐曲速 <b>${esc(t.tempo)}</b></span>` : ''}
      </div>
    </div>`).join('');

  const samples = vb.samples.map((s) => `
    <div class="sample-row" data-url="${esc(s.url)}" data-title="${esc(s.label)}"
         data-artist="${esc(char.name)}" data-timbre="${esc(s.timbre)}"
         data-engine="${esc(vb.engine)}" data-cover="${esc(char.album)}">
      <span class="sample-play">${ICON.play}</span>
      <span class="sample-label">${esc(s.label)}</span>
    </div>`).join('');

  // 制作人员信息（角色配音／原音标定／声库制作等）需要提级展示，
  // 与「获取与下载」类条目（声库下载／编辑器下载／声库申请）区分开。
  // 固定排序：编辑器下载(引擎) 在前，声库下载 在后，声库申请 再次，其余标签垫底，
  // 避免 md 书写顺序导致「声库下载」跑到「编辑器下载」前面（如宛沚 DiffSinger）。
  const DL_ORDER = { '编辑器下载': 0, '声库下载': 1, '声库申请': 2 };
  const dlOrder = (label) => (label in DL_ORDER ? DL_ORDER[label] : 3);
  const DL_LABELS = ['声库下载', '编辑器下载', '声库申请'];
  const staff = vb.credits.filter((c) => !DL_LABELS.includes(c.label));
  // 无链接的下载条目（值形如「已下架」「404 Not Found」）渲染为禁用按钮
  const deadLinks = vb.credits.filter((c) => DL_LABELS.includes(c.label));

  const staffList = staff.length ? `<dl class="credits">
    ${staff.map((c) => `<div><dt>${esc(c.label)}</dt><dd>${esc(c.value)}</dd></div>`).join('')}
  </dl>` : '';

  // 可用下载按钮 + 不可用（禁用）按钮，统一并入同一个按钮组，并按固定顺序排序
  const dlItems = [
    ...vb.links.flatMap((g) => g.items.map((it) => ({
      order: dlOrder(g.label),
      html: `<a class="btn btn-sm" href="${esc(it.url)}"
        target="_blank" rel="noopener noreferrer">${esc(g.label)}：${esc(it.text)}</a>`,
    }))),
    ...deadLinks.map((c) => ({
      order: dlOrder(c.label),
      html: `<span class="btn btn-sm is-disabled"
        aria-disabled="true" tabindex="0">${esc(c.label)}：${esc(c.value)}</span>`,
    })),
  ];
  dlItems.sort((a, b) => a.order - b.order);
  const dlButtons = dlItems.map((d) => d.html).join('');

  const links = dlButtons ? `<div class="dl-list">${dlButtons}</div>` : '';

  return `
  <div class="engine-block reveal" id="${esc(id)}">
    <div class="engine-sticky">
      <span class="engine-name">${esc(vb.engine)}</span>
      ${vb.version ? `<span class="tag">${esc(vb.version)}</span>` : ''}
      <span class="engine-badges">
        ${vb.timbreNames.map((t) => `<span class="tag tag-accent">${esc(t)}</span>`).join('')}
      </span>
    </div>
    <div class="engine-body">
      ${vb.engineIntro ? `<p class="engine-intro">${linkify(vb.engineIntro)}</p>` : ''}
      ${vb.engineSite ? `<p class="engine-intro"><a href="${esc(vb.engineSite)}"
        target="_blank" rel="noopener noreferrer">${esc(vb.engineSite)}</a></p>` : ''}
      ${vb.notices.map((n) => `<div class="notice">${esc(n)}</div>`).join('')}

      ${staffList ? `<div class="engine-staff"><div class="spec-title">制作人员</div>
        ${staffList}</div>` : ''}

      <div class="engine-grid">
        ${vb.languages.length ? `<div><div class="spec-title">支持语言</div>
          <div class="lang-list">${langs}</div></div>` : ''}
        ${samples ? `<div><div class="spec-title">干声试听</div>
          <div class="sample-list">${samples}</div></div>` : ''}
      </div>

      ${timbres ? `<div style="margin-top:24px"><div class="spec-title">音色</div>${timbres}</div>` : ''}

      ${links ? `<div class="engine-download">
        <div class="spec-title">获取与下载</div>${links}
      </div>` : ''}
    </div>
  </div>`;
}

/** 只把 md 链接转成 a，其余文本转义 */
function linkify(text) {
  return esc(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
}

// ============================================================
// 文档页
// ============================================================
export function viewDoc(page) {
  applyAccent(null, null);
  return el(`<article class="doc">${renderMarkdown(page.body)}</article>`);
}

export function viewNotFound() {
  applyAccent(null, null);
  return el(`<div class="center-note">
    <h1>404</h1>
    <p>页面不存在。</p>
    <p style="margin-top:24px"><a class="btn" href="#/">返回首页</a></p>
  </div>`);
}
