// ============================================================
// 应用入口：数据加载 + hash 路由 + 顶栏
// 采用 hash 路由，GitHub Pages 无需任何重写规则即可直接部署。
// 视图切换只替换 #view 内容，播放器不受影响，播放不中断。
// ============================================================
import {
  esc, observeReveal, observeStuck, ICON,
  getTheme, setTheme, toggleTheme, inlineSVG,
} from './util.js';
import { player } from './player.js';
import {
  viewHome, viewGallery, viewCharacter, viewDoc, viewNotFound, syncPlayingUI,
} from './views.js';

const SITE = 'Muzium · 藏声馆';

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
const themeToggle = document.getElementById('themeToggle');

const DB = { characters: [], playlist: [], pages: [] };

async function loadJSON(p) {
  const r = await fetch(p);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return r.json();
}

async function boot() {
  initTheme();
  initLogos();

  try {
    const [characters, playlist, pages] = await Promise.all([
      loadJSON('data/characters.json'),
      loadJSON('data/playlist.json'),
      loadJSON('data/pages.json'),
    ]);
    Object.assign(DB, { characters, playlist, pages });
  } catch (err) {
    view.innerHTML = `<div class="center-note"><h1>!</h1>
      <p>数据加载失败：${esc(err.message)}</p>
      <p style="margin-top:12px;font-size:13px">
        若为本地预览，请通过 HTTP 服务访问（例如 <code>python -m http.server</code>），
        直接双击打开 index.html 会被浏览器的同源策略拦截。</p></div>`;
    return;
  }

  buildNav();
  player.mount(document.getElementById('player-root'));
  window.addEventListener('hashchange', route);
  route();
}

/** 主题：初值已由 index.html 的内联脚本写好，这里只负责按钮与跟随系统 */
function initTheme() {
  const paint = () => {
    const dark = getTheme() === 'dark';
    // 显示「将要切换到的模式」的图标
    themeToggle.innerHTML = dark ? ICON.sun : ICON.moon;
    themeToggle.title = dark ? '切换到亮色模式' : '切换到暗色模式';
    themeToggle.setAttribute('aria-label', themeToggle.title);
  };
  paint();
  themeToggle.onclick = () => toggleTheme();
  document.addEventListener('theme:change', paint);

  // 用户未手动选择过时，跟随系统
  let saved = null;
  try { saved = localStorage.getItem('muzium.theme'); } catch (e) { /* noop */ }
  if (!saved) {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      setTheme(e.matches ? 'light' : 'dark');
      try { localStorage.removeItem('muzium.theme'); } catch (err) { /* noop */ }
    });
  }
}

/** 顶栏 / 页脚的单色 LOGO：内联并改用 currentColor，随主题自动变色 */
function initLogos() {
  // 顶栏用字标 Icon_03，页脚同样用字标 Icon_03
  inlineSVG(document.getElementById('brandMark'), '/assets/icon/Icon_03.svg');
  inlineSVG(document.getElementById('footerMark'), '/assets/icon/Icon_03.svg');
}

function buildNav() {
  const links = [
    ...DB.characters.map((c) => ({ href: `#/c/${c.slug}`, text: c.name })),
    { sep: true },
    { href: '#/gallery', text: '展厅' },
    ...DB.pages.map((p) => ({ href: `#/page/${p.slug}`, text: p.navTitle || p.title })),
  ];
  nav.innerHTML = links
    .map((l) => (l.sep ? '<span class="nav-sep"></span>'
      : `<a href="${l.href}">${esc(l.text)}</a>`))
    .join('');

  navToggle.onclick = () => {
    const open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  };
  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function markActive(hash) {
  nav.querySelectorAll('a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });
}

function resolve(raw) {
  const parts = raw.split('/').filter(Boolean);

  if (parts.length === 0) return { node: viewHome(DB), title: SITE };

  if (parts[0] === 'gallery') return { node: viewGallery(DB), title: `作品展厅 · ${SITE}` };

  if (parts[0] === 'c' && parts[1]) {
    const c = DB.characters.find((x) => x.slug.toLowerCase() === parts[1].toLowerCase());
    if (c) return { node: viewCharacter(c, DB), title: `${c.name} · ${SITE}` };
  }

  if (parts[0] === 'page' && parts[1]) {
    const p = DB.pages.find((x) => x.slug.toLowerCase() === parts[1].toLowerCase());
    if (p) return { node: viewDoc(p), title: `${p.title} · ${SITE}` };
  }

  return { node: viewNotFound(), title: `404 · ${SITE}` };
}

let routing = false;

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';

  // 页内锚点（如 #characters）不参与路由，交给浏览器滚动
  if (raw && !raw.startsWith('/')) {
    document.getElementById(raw)?.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (routing) return;
  routing = true;

  const swap = () => {
    const { node, title } = resolve(raw);
    document.title = title;
    view.classList.remove('leaving');
    view.replaceChildren(node);
    markActive(location.hash);
    window.scrollTo({ top: 0, behavior: 'auto' });

    observeReveal(node);
    observeStuck(node);
    syncPlayingUI(player.current);
    routing = false;
  };

  // 首帧直接渲染，之后的切换加一个短暂的淡出，衔接更顺
  if (!view.firstChild || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    swap();
  } else {
    view.classList.add('leaving');
    setTimeout(swap, 170);
  }
}

// 播放状态变化时同步列表高亮（跨页面有效）
document.addEventListener('player:change', (e) => syncPlayingUI(e.detail.song));
document.addEventListener('player:state', (e) => {
  syncPlayingUI(e.detail.song);
  document.querySelectorAll('.track').forEach((n) => {
    const on = n.classList.contains('playing') && e.detail.playing;
    n.querySelector('.track-eq')?.toggleAttribute('hidden', !on);
    const num = n.querySelector('.track-idx .n');
    if (num) num.hidden = on;
  });
});

boot();
