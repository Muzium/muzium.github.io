# 部署指南 / Deployment Guide

## GitHub Pages 部署

### 方法一：直接部署主分支

1. 进入仓库的 Settings
2. 找到 Pages 设置
3. Source 选择 `Deploy from a branch`
4. Branch 选择包含新网站的分支（如 `copilot/create-virtual-singer-website`）
5. 目录选择 `/ (root)`
6. 点击 Save

网站将在几分钟内部署到 `https://muzium.github.io`

### 方法二：合并到主分支后部署

```bash
# 切换到主分支
git checkout main

# 合并新网站代码
git merge copilot/create-virtual-singer-website

# 推送到远程
git push origin main
```

然后在 Settings > Pages 中选择 main 分支部署。

## 自定义域名（可选）

如果要使用自定义域名：

1. 在域名提供商处添加 DNS 记录：
   - 类型: CNAME
   - 名称: www（或其他子域名）
   - 值: muzium.github.io

2. 在仓库根目录创建 `CNAME` 文件，内容为你的域名：
   ```
   www.yourdomain.com
   ```

3. 在 GitHub Pages 设置中输入自定义域名

## 添加音频/视频资源

### 音频文件

1. 创建 `audio` 目录：
   ```bash
   mkdir -p audio
   ```

2. 将音频文件放入该目录，推荐格式：
   - 试听曲: MP3 格式
   - 清唱样本: WAV 格式

3. 在角色页面添加音频：
   ```html
   <div class="voice-sample">
       <div class="voice-name">标准音色</div>
       <div class="voice-controls">
           <button onclick="playVoiceSample(this, '/audio/sample.wav')">播放</button>
       </div>
   </div>
   ```

### 视频文件

推荐使用外部视频平台（如哔哩哔哩）：

```html
<iframe src="//player.bilibili.com/player.html?bvid=BV1..." 
        width="100%" 
        height="500" 
        frameborder="0" 
        allowfullscreen></iframe>
```

## Bilibili 数据刷新（待实现）

要实现自动刷新 Bilibili 数据，需要：

1. 创建一个简单的后端 API（或使用 GitHub Actions）
2. 定期调用 Bilibili API 获取数据
3. 更新页面上的数据展示

示例 GitHub Actions 工作流：

```yaml
name: Update Bilibili Stats
on:
  schedule:
    - cron: '0 */6 * * *'  # 每6小时运行一次
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Fetch Bilibili Data
        run: |
          # 调用 Bilibili API
          # 更新数据文件
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .
          git commit -m "Update Bilibili stats" || echo "No changes"
          git push
```

## 性能优化建议

1. **图片优化**：
   - 使用 WebP 格式
   - 压缩图片大小
   - 添加懒加载

2. **CDN 加速**：
   - 图片使用 CDN
   - 字体使用 CDN（已实现）

3. **代码优化**：
   - 压缩 CSS/JS
   - 启用浏览器缓存

## 维护更新

### 添加新角色

1. 在 `data/characters.json` 添加角色数据
2. 准备角色立绘，放入 `images/` 目录
3. 复制现有角色页面模板
4. 更新主页添加新角色展示区

### 更新内容

- **修改文本**：直接编辑 HTML 文件
- **修改样式**：编辑 `css/*.css` 文件
- **添加功能**：编辑 `js/*.js` 文件

## 常见问题

### 音乐播放器无声音
- 检查音频文件路径是否正确
- 确认浏览器支持音频格式
- 检查浏览器控制台是否有错误

### 图片不显示
- 检查图片路径（使用相对路径 `/images/xxx.png`）
- 确认图片文件存在
- 检查文件名大小写

### 移动端显示异常
- 检查 viewport meta 标签
- 测试不同屏幕尺寸
- 使用浏览器开发者工具的响应式模式

## 联系与支持

如有问题，请通过以下方式联系：
- GitHub Issues: https://github.com/Muzium/muzium.github.io/issues
- 哔哩哔哩: https://space.bilibili.com/2099148349
