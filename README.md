# 心奇学习应用集合 v1.1

以「心奇学习官网」为唯一入口的单页合集：启动打开官网首页，通过相对链接进入各子应用。
所有页面均为纯静态资源，无构建步骤、无外部 CDN 依赖，可直接双击 `index.html` 打开，也可部署到任意静态托管（GitHub Pages / Nginx / 对象存储）。

## 目录结构

```
.
├── index.html          # 主站 = 心奇学习官网（应用导航卡片）
├── avatar.png          # 官网头像
├── music.mp3           # 官网背景音乐
├── apps/               # 各子应用，彼此独立
│   ├── pinyin/         # 心奇学拼音
│   ├── zici/           # 心奇学字词（单文件，数据内联）
│   ├── guwen/          # 心奇学古文
│   ├── zuowen/         # 心奇学作文
│   ├── shuxue/         # 心奇学数学
│   ├── danci/          # 心奇学单词
│   └── xiangqi/        # 心奇学象棋（多文件：js / css / vendor）
├── shared/
│   └── back-home.js    # 子应用「返回主页」悬浮按钮（外挂脚本）
├── VERSION
└── CHANGELOG.md
```

## 本地运行

方式一：直接双击 `index.html`（`file://` 方式，全部相对路径，可正常使用）。

方式二（推荐，和线上环境一致）：

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080/
```

## 子应用独立升级

各子应用之间没有共享代码，升级其中一个不会影响其它应用与主站。

1. 用新版替换 `apps/<id>/index.html`（多文件应用则替换整个 `apps/<id>/` 目录）。
2. 确认该页面 `</body>` 前仍有这一行（替换单文件时会被覆盖掉，需要补回）：

   ```html
   <script src="../../shared/back-home.js" data-home="../../index.html" defer></script>
   ```

3. 若新增或下线应用，修改 `index.html` 内 `SITE_DATA.modules` 的卡片 `title` 与 `url`（相对路径，如 `apps/pinyin/index.html`）。
4. 更新 `VERSION` / `CHANGELOG.md`，提交即可。若使用 GitHub Pages，推送 `main` 后自动生效。

## 部署

推送到 GitHub 仓库后在 Settings → Pages 选择 `main` 分支根目录即可。
站内链接全部是相对路径，因此部署在 `https://<user>.github.io/<repo>/` 子路径下也能正常跳转。

## 版本

- v1.1.0：首次整合发布（官网主页 + 7 个子应用）
