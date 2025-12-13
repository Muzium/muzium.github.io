# 藏声馆 (Muzium) - 虚拟歌手展示官网

这是一个为虚拟歌手原创角色打造的展示官网，使用纯HTML、CSS和JavaScript实现，可直接部署在GitHub Pages上。

## 功能特性

### 已实现功能
1. ✅ **角色文字设定展示** - 每个角色有专属的详情页面，展示其基本设定
2. ✅ **角色立绘展示与下载** - 支持多张立绘切换，带EULA确认的下载功能
3. ✅ **各引擎声库信息展示** - 分引擎展示声库的详细参数信息
4. ✅ **清唱片段试听** - 预留了清唱样本的波形可视化区域
5. ✅ **试听曲播放器** - 全局音乐播放器，支持播放与下载
6. ✅ **使用规范展示** - 独立的EULA页面
7. ✅ **工具展示与下载** - 工具列表页面
8. ✅ **外部链接跳转** - 支持跳转至哔哩哔哩和GitHub

### 技术特点
- 🎨 **自适应响应式设计** - 支持桌面端和移动端
- 🎵 **像素化频谱可视化** - 100个频点的像素化音频频谱
- 🎭 **动态角色色彩系统** - 每个角色有独立的主题色
- 📱 **固定导航栏** - 滚动时始终可见的顶部导航
- 🔝 **返回顶部按钮** - 智能显示/隐藏
- 🌐 **多语言支持准备** - i18n数据结构已就绪

## 目录结构

```
muzium.github.io/
├── index.html              # 主页 - 角色展示区
├── character/              # 角色详情页
│   ├── fuyao.html         # 浮曜详情页
│   ├── fuyi.html          # 浮亦详情页
│   └── wanzhi.html        # 宛沚详情页
├── eula/
│   └── index.html         # 使用规约页面
├── tools/
│   └── index.html         # 工具列表页面
├── css/
│   ├── main.css           # 全局样式
│   ├── character.css      # 角色页面样式
│   └── page.css           # 内容页面样式
├── js/
│   ├── main.js            # 全局功能
│   └── character.js       # 角色页面功能
├── data/
│   ├── characters.json    # 角色数据
│   └── i18n.json          # 国际化翻译
└── images/                # 图片资源
```

## 角色信息

### 浮曜 (Fuyao)
- 性别：男
- 身高：178cm
- 年龄：20岁
- 代表色：#FFB600
- 支持引擎：UTAU, DeepVocal, DiffSinger

### 浮亦 (Fuyi)
- 性别：男
- 身高：185cm
- 年龄：24岁
- 代表色：#98453F
- 支持引擎：UTAU, VocalSharp

### 宛沚 (Wanzhi)
- 性别：女
- 身高：164cm
- 代表色：#545F8D, #88ADA6
- 支持引擎：ACE Studio, 歌叽歌叽

## 部署说明

本网站是纯静态网站，可以直接部署到GitHub Pages：

1. 将代码推送到GitHub仓库
2. 在仓库设置中启用GitHub Pages
3. 选择主分支作为发布源
4. 访问 `https://[username].github.io/` 即可查看网站

## 字体使用

全局使用小米MiSans字体，通过CDN引入：
```
https://cdn-font.hyperos.mi.com/font/css?family=MiSans_VF:VF:Chinese_Simplify,Latin&display=swap
```

## 音乐播放器

位于页面左下角的全局音乐播放器支持：
- 播放/暂停控制
- 进度条拖动
- 像素化频谱可视化（0-20kHz分100个频点）
- 音频文件下载
- 折叠/展开功能

## 开发说明

### 添加新角色
1. 在 `data/characters.json` 中添加角色数据
2. 创建角色立绘并放入 `images/` 目录
3. 在 `character/` 目录创建新的角色页面HTML
4. 在主页 `index.html` 添加角色展示区块

### 添加音频资源
1. 将音频文件放入适当的目录（建议创建 `audio/` 目录）
2. 在角色页面的引擎区域添加音频播放控件
3. 使用 `loadTrack(url, name)` 函数加载到全局播放器

### 自定义样式
所有主要颜色在 `:root` 中定义为CSS变量：
- `--primary-color`: 主题色
- `--background-dark`: 深色背景
- `--background-light`: 浅色背景
- `--text-color`: 主要文本色
- `--text-secondary`: 次要文本色

## 浏览器兼容性

- Chrome/Edge (推荐)
- Firefox
- Safari
- 移动端浏览器

## 版权信息

© 2025 Muzium. All rights reserved.

字体：MiSans - 小米字体

## 联系方式

- 哔哩哔哩：https://space.bilibili.com/2099148349
- GitHub：https://github.com/Muzium
