# MUZIUM 站点

虚拟原创角色的资料公开、声库试听与作品展厅。纯静态、零运行时依赖，
可直接部署到 GitHub Pages。

## 目录结构

```
site/
├── index.html          入口
├── css/
│   ├── font.css        源云明朝 @font-face（由脚本生成，勿手改）
│   ├── main.css        设计系统与页面样式
│   └── player.css      播放器与歌词样式
├── js/
│   ├── app.js          数据加载 + hash 路由 + 顶栏
│   ├── player.js       全局播放器（单例 audio，跨页不中断）
│   ├── views.js        首页 / 展厅 / 角色页 / 文档页
│   ├── markdown.js     轻量 Markdown 渲染
│   └── util.js         工具与图标
├── data/               ← 由 tools/build_data.py 生成
│   ├── characters.json
│   ├── playlist.json
│   ├── pages.json
│   └── lyrics/*.json
├── fonts/              ← 由 tools/build_font.py 生成（woff2 分片）
│   └── SIL_Open_Font_License_1.1.txt  字体授权文本（OFL 1.1，必附）
└── tools/
    ├── build_data.py
    └── build_font.py
```

## 字体授权（重要）

本站 Web 字体「源云明朝 / GenWanMin」由
[ButTaiwan/genwan-font](https://github.com/ButTaiwan/genwan-font) 生成，
其原始字体基于 Adobe Source Han 系列，均发布于 **SIL Open Font License 1.1（OFL 1.1）**。

- ✅ 允许免费商用、再分发、改造、网页 `@font-face` 嵌入（含转制 woff2）。
- ⚠️ 再分发**必须附带授权文本**——`site/fonts/SIL_Open_Font_License_1.1.txt`
  已随字体一并提交，**请勿删除**。
- 字体版权：`GenWanMin © ButTaiwan`；页脚亦标注 `Font: GenWanMin © ButTaiwan, SIL OFL 1.1`。

数据源保持在仓库原位（`markdown/`、`data/playlist.json`、`assets/`），
`site/data/` 只是它们的派生产物 —— **改内容请改源文件，然后重跑脚本**。

## 本地预览

必须通过 HTTP 访问（ES module 与 fetch 受同源策略限制，直接双击 html 无法运行）：

```bash
python -m http.server 8099
# 打开 http://localhost:8099/site/
```

## 一键构建（更新素材后）

新增歌曲、修改角色 md、添加 `.alp` 歌词、改 `playlist.json` 等任何内容变更后，
**只需跑这一个脚本**即可无 bug 重建整站静态产物：

```bash
python build.py            # 重建数据；字体已生成则跳过
python build.py --fonts    # 强制重新生成字体（需联网，下载上游 OTF）
```

字体 woff2 分片一旦生成便极少变动，`build.py` 默认会跳过 `build_font.py`
（避免每次联网下载约 22MB 的 OTF）；只有首次构建或显式 `--fonts` 才会重建。

## 分步构建

### 重新生成数据

```bash
python site/tools/build_data.py
```

脚本会：
- 解析 `markdown/*.md`，把角色档案结构化为 `characters.json`
  （立绘、引擎、音色、试听、下载链接、语言等）；
- 其余 md 作为文档页写入 `pages.json`，自动出现在顶栏右侧；
- 把 `.alp`（本质是 zip）内的 `data.json` 抽成独立歌词文件。
  `.alp` 里内嵌了整首 mp3（14MB 中约 13.9MB 是音频），抽取后仅约 75KB，
  避免同一首歌被下载两次。

## 重新生成字体

上游 [ButTaiwan/genwan-font](https://github.com/ButTaiwan/genwan-font) 只提供
约 22MB 的 OTF，无法直接用于网页，jsDelivr 也因仓库体积超限而拒绝代理。
因此脚本会下载 OTF 并按 Unicode 区段切成 woff2 分片，
配合 `unicode-range` 让浏览器按需加载（常见页面实际只下载 1~2MB）：

```bash
pip install "fonttools[woff]" brotli
python site/tools/build_font.py --weights R SB
```

产物已提交到仓库，通常无需重跑。

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/pages.yml`，推送到 `main` 即自动部署。
在仓库 **Settings → Pages → Build and deployment → Source** 选择
**GitHub Actions** 即可。

站点以**仓库根目录**为发布根（因为 `site/` 内通过 `../assets/` 引用素材），
根目录的 `index.html` 会自动跳转到 `./site/`。

路由使用 hash（`#/c/Fuyi`），因此不需要任何服务端重写规则，
刷新与直接分享链接都不会 404。

## 功能要点

- **播放不中断**：`<audio>` 为模块级单例，路由切换只替换 `#view`，音频对象不重建。
- **左下角播放栏**：旋转专辑封面（播放键叠在封面上）、进度条、播放列表、最大化。
- **最大化视图**：封面模糊铺底，Apple Music 风格逐字歌词
  （`background-clip:text` 渐变推进 + 行居中自动滚动 + 点击行跳转；
  手动滚动后 4 秒内不抢滚动条）。
- **角色页**：点击头像切换立绘；各引擎子版块 `position:sticky` 吸顶，
  吸附时通过 `IntersectionObserver` 加 `.stuck` 阴影。
- **配色跟随角色**：进入角色页时用其代表色覆盖 `--accent`，
  并按亮度自动选择对比前景色。
- **直角设计**：全局无圆角，仅唱片本身为圆形。
- 支持键盘操作（空格播放/暂停、方向键快进、`Esc` 收起）与系统媒体键
  （Media Session API）。
