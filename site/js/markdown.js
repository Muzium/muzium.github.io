// 轻量 Markdown 渲染器
// 只覆盖仓库文档实际用到的语法，避免为几篇 md 引入整个解析库。
import { esc } from './util.js';

// 把转义后的 <font color="...">...</font> 还原为真实标签（白名单，仅放行 font+color，
// 颜色值限制为 [0-9a-fA-F#] 及单词，避免 XSS；其它 HTML 仍保持转义状态）。
// 这样 eula 里给歌手名上色的 <font> 标记能正确着色，而不会被当成纯文本暴露。
const restoreFont = (s) =>
  s.replace(/&lt;font\s+color=&quot;([#0-9a-zA-Z]+)&quot;&gt;([\s\S]*?)&lt;\/font&gt;/g,
    (_, color, inner) => {
      // 颜色值若未带 #（如 markdown 里写的 FFB600），CSS 不识别，需补上
      const c = /^#/.test(color) ? color : `#${color}`;
      return `<span style="color:${c}">${inner}</span>`;
    });

const inline = (s) =>
  restoreFont(
    esc(s)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, a, u) => `<img src="${u}" alt="${a}" loading="lazy">`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, t, u) => {
        const ext = /^https?:/i.test(u);
        return `<a href="${u}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  );

export function renderMarkdown(src = '') {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let list = null;      // 'ul' | 'ol'
  let para = [];
  let quote = [];
  let table = null;

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const flushQuote = () => {
    if (quote.length) { out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`); quote = []; }
  };
  const flushTable = () => {
    if (!table) return;
    const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const [head, ...body] = table;
    out.push('<table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') +
      '</tr></thead><tbody>' +
      body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
      '</tbody></table>');
    table = null;
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\s*$/.test(line)) { flushAll(); continue; }

    // 表格
    if (/^\|.*\|$/.test(line.trim())) {
      flushPara(); flushList(); flushQuote();
      if (/^\|[\s:|-]+\|$/.test(line.trim())) continue;  // 分隔行
      (table ||= []).push(line.trim());
      continue;
    }
    flushTable();

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flushAll(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }

    const q = /^>\s?(.*)$/.exec(line);
    if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }
    flushQuote();

    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const want = ul ? 'ul' : 'ol';
      if (list !== want) { flushList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    flushList();

    para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}
