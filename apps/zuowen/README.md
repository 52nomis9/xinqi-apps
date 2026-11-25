# 心奇学作文 v1.0（2026-08-27）· 应用说明文档

> 本文档面向**后续接手本应用的 WorkBuddy 用户**。读完即可理解应用全貌，并照「维护指南」一节独立复现、修改与重新部署本应用。
> 配套单文件应用：`心奇学作文.html`（自包含，双击即可在浏览器打开，无需联网、无需后端）。

---

## 1. 目的与需求

**目标用户**：小学生（及家长/老师），按**统编版小学语文教材**的单元习作要求做辅导。

**要解决的核心问题**：孩子写作文"不知道写什么、不知道怎么写、范文不会学"。本应用把每一篇习作拆成可操作的五步引导，让孩子从"看清要求"一步步走到"写出自己的作文"。

**功能需求（v1.0 已实现）**：
- 覆盖**小学一年级到六年级共 12 个学期**的单元习作（共 **79 篇**）。
- 每篇提供「分类与写法 → 分层思维导图 → 作文草稿 → 范文展示 → 类似作文」五步引导。
- 两种浏览方式：**学期排列**（按年级/学期看教材单元要求）、**类型排列**（按写人/记事/写景等 12 类汇总，便于对比练习）。
- 范文按**真实年级梯度**区分长度与口吻（低年级儿童口吻、高年级成熟口吻、男女主角交替）。
- 实用工具：字体缩放、打印、把当前习作**导出为独立 HTML**、点「类似作文」在各年级同类习作间**跨学期跳转**。
- 单文件、零依赖、可离线、可一键部署到云端分享链接。

---

## 2. 设计思路

| 设计原则 | 具体做法 |
|---|---|
| **儿童友好** | 温暖橙色调（主色 `#e8643a`）、大字号、圆角卡片、清晰层级；文案口语化、鼓励式（"加油🌟"）。 |
| **五步脚手架** | 每篇固定 5 个板块，把"写作文"拆成"看清要求→想大纲→打草稿→读范文→找同类"，降低畏难。 |
| **分层思维导图** | 4 级递进：题目→段落→要点→逐句填空（虚线可点击填写），把"列提纲"游戏化。 |
| **年级真梯度** | 范文长度与用词严格按年级递增（见 §5 字数梯度表），不把高年级写成三年级水平。 |
| **单文件优先** | 所有 HTML/CSS/JS/数据内联在一个 `.html` 文件，便于分发、导出、部署。 |
| **可程序化生成** | 79 篇数据由脚本从模板 + 范文批量生成（见 §8），便于规模化修订，避免手工改 79 处。 |

---

## 3. 系统结构与组件

### 3.1 页面布局（DOM 结构）
```
<div class="app">
  <aside class="side" id="side">            ← 左侧栏
      <div class="side-title" id="appTitle">📝 心奇学作文</div>   ← 点击弹出应用说明
      <button id="collapseBtn">⟨ 收起</button>
      <button class="mode-btn" id="modeBtn">📚 学期排列</button>  ← 学期/类型 排列切换
      <div class="side-select" id="selRow"></div>                ← 年级/学期 或 类型 下拉
      <div class="toc" id="toc"></div>                          ← 当前目录列表
  </aside>
  <button class="expand-fab" id="expandBtn">» 展开侧栏</button>  ← 收起后浮出
  <main class="main" id="main">
      <div class="main-inner" id="mainInner"></div>             ← 右侧内容（5 板块渲染区）
  </main>
  <div class="modal-mask" id="modalMask"> … 应用说明弹窗 … </div>
</div>
```

### 3.2 五大内容板块（board1–board5）
| 板块 | 函数 | 内容 |
|---|---|---|
| 1 习作要求与写法 | `board1` | 分类徽标、年级单元、教材要求 `req`、写法步骤 `how`（含公式） |
| 2 分层思维导图·作文大纲 | `board2`→`mindHTML` | 4 级思维导图（题目/段落/要点/填空） |
| 3 怎么打作文草稿 | `board3`→`outlineHTML` | 草稿卡片（开头/中间/结尾）+ 小秘诀 |
| 4 范文展示 | `board4`→`essayHTML` | 范文段落 + **动态字数标注**（"约 N 字"） |
| 5 类似作文 | `board5`→`similarHTML` | 同类型、相邻年级的其他习作，可点击跳转 |

### 3.3 核心脚本组件（`<script>` 内）
- **数据层**：`var COMPOSITIONS = {...}`（第 347 行起，至"渲染逻辑"注释前结束）。
- **常量**：`GRADES`（一年级…六年级）、`TERMS`（[{k:"s",name:"上册"},{k:"x",name:"下册"}]）、`CATS`（12 类标签+配色）。
- **状态**：`mode`（term/cat）、`gradeIdx`、`termIdx`、`catSel`、`curViewKey`、`curViewIdx`、`fontScale`。
- **渲染函数**：`renderSelRow / renderSide / getList / selectFirst / showItem / highlight / toolbarHTML / howHTML / mindHTML / outlineHTML / essayHTML / similarHTML / jumpTo / board1~5 / footerHTML`。
- **交互函数**：`toggleSide`（折叠侧栏）、`changeFont/applyFont`（字体缩放）、`window.print()`（打印）、`exportHTML()`（导出独立 HTML）、模式切换、`modalMask` 弹窗。
- **初始化**：脚本末尾依次调用 `renderSelRow(); renderSide(); selectFirst();`，默认进入三年级上册第 1 篇。

---

## 4. 用户界面与操作说明

| 操作 | 位置 / 方式 | 说明 |
|---|---|---|
| 看应用说明 | 点击左上角 **📝 心奇学作文** 标题 | 弹窗显示应用说明、版本 v1.0、更新日期、作者；点「我知道啦」或弹窗空白处关闭。 |
| 切换学期/类型排列 | 左侧 **📚 学期排列** 按钮 | 在"按年级学期"与"按作文类型"两种目录间切换。 |
| 选年级/学期 | 左侧下拉（学期模式下） | 选年级 + 学期，目录与内容联动刷新。 |
| 选作文类型 | 左侧下拉（类型模式下） | 选 12 类之一，列出全部学期同类习作。 |
| 打开某篇习作 | 点击左侧目录项 | 右侧渲染该篇五步引导；当前项高亮。 |
| 收起/展开侧栏 | 左侧 **⟨ 收起** / 浮出的 **» 展开侧栏** | 窄屏或专注阅读时使用。 |
| 缩放字体 | 内容区右上 **A− / A+** | 范围 70%–160%，步进 15%，标签实时显示百分比。 |
| 打印 | 内容区右上 **🖨️ 打印** | 调用浏览器打印（建议先缩放合适字号）。 |
| 导出 HTML | 内容区右上 **⬇️ 导出 HTML** | 把**当前这一篇**导出为独立 `.html` 文件（含五板块、去掉侧栏/工具栏，自动可滚动），文件名"<习作名>（心奇学作文）.html"。 |
| 跳到类似作文 | 板块 5「类似作文」中的条目 | 点击后跨年级/学期跳转到同类型其他习作，左侧目录与下拉同步切换。 |

> 注：导出的是**单篇**习作页，不是整站；整站分享用 §7 的部署链接。

---

## 5. 数据与接口规范

### 5.1 数据总结构
```javascript
var COMPOSITIONS = {
  "1s": [ /* 一年级上册 4 篇 */ ],
  "1x": [ /* 一年级下册 5 篇 */ ],
  ...
  "6x": [ /* 六年级下册 6 篇 */ ]
};
```
键 = 学期代码：`1s,1x,2s,2x,3s,3x,4s,4x,5s,5x,6s,6x`（数字=年级，`s`=上册，`x`=下册）。每个键是数组，顺序即目录顺序。

### 5.2 单篇对象字段
```javascript
{
  u:    "单元名（如 '第一单元'）",
  t:    "习作标题（如 '猜猜他是谁'；含 ____ 的标题在范文中填空）",
  cat:  "分类键（见 §5.4 的 12 类）",
  req:  "教材要求原文（展示用，来自统编版教材）",
  how:  { steps:[ {t, ico, d} ], formula:"写法公式" },
  mind: { root:"标题", branches:[ {title, points:[ {label, sent} ]} ] },
  outline: { cards:[ {dt, dd, ex} ], tip:"小秘诀" },
  essay: { title:"范文标题", paras:[ {seg:"开头", text:"…"} ] }
}
```
- `how.steps[].d` 是**字符串**（已按年级选好那档难度的话术），不是数组。
- `outline.cards[].dd` 是**字符串**（已按年级选好的草稿提示），不是数组。
- `essay.paras[].text` 是范文正文；`seg` 是段落小标签（开头/中间1/…/结尾）。
- **字数统计**只数中文字符，正则 `/[一-鿿]/g`，不含标点、不含 `seg` 标签。`essayHTML` 在渲染时实时统计并显示"约 N 字"。

### 5.3 年级字数梯度（范文目标区间，中文字）
| 学期 | lo–hi | 档位 | 学期 | lo–hi | 档位 |
|---|---|---|---|---|---|
| 1s | 40–70 | BAND1 | 4s | 340–400 | BAND2 |
| 1x | 50–80 | BAND1 | 4x | 350–415 | BAND2 |
| 2s | 100–150 | BAND1 | 5s | 410–470 | BAND3 |
| 2x | 120–165 | BAND1 | 5x | 425–485 | BAND3 |
| 3s | 260–320 | BAND2 | 6s | 470–530 | BAND3 |
| 3x | 270–330 | BAND2 | 6x | 485–545 | BAND3 |

> 例外：4x「轻叩诗歌大门·写诗」写 8–14 行儿童诗 + 2–3 句小记，目标 300–400 字。
> **BAND 分组**：BAND1=1–2 年级（儿童口吻、浅词、无成语）；BAND2=3–4 年级（小学生口吻、有细节、少量成语）；BAND3=5–6 年级（成熟、可用修辞、保持小学生真诚感、男女视角交替）。

### 5.4 分类键 `cat` 与配色（CATS）
| 键 | 标签 | 颜色 | 键 | 标签 | 颜色 |
|---|---|---|---|---|---|
| renwu | 写人 | #e85d75 | riji | 日记 | #37a2a2 |
| jishi | 记事 | #4aa3d8 | duhougan | 读后感 | #d46fb0 |
| xiejing | 写景 | #5cb85c | shuxin | 书信 | #5b8c5a |
| zhuangwu | 状物·说明 | #8a6fd4 | yingyong | 应用文 | #8d7b6f |
| xiangxiang | 想象作文 | #f2a03b | kantu | 看图写话 | #e8862f |
| kouyu | 口语交际 | #4d9bd4 | yilun | 议论·看法 | #c65d3b |

### 5.5 对外"接口"（函数级）
- `showItem(key, idx)`：渲染指定学期(key)第 idx 篇到主区；其它函数均内部调用，无需外部传参。
- `jumpTo(key, idx)`：跨学期跳转（类似作文链接用）。
- `exportHTML()`：导出当前篇为独立 HTML（无参数，读全局 `curViewKey/curViewIdx`）。
- `changeFont(d)`：`d=-1/1` 缩/放字体。
- 修改数据只需改 `COMPOSITIONS`（见 §8），无需改动渲染函数。

---

## 6. 遗留问题与规避

| 问题 | 说明 / 规避 |
|---|---|
| **导出为"单篇"非"整站"** | `exportHTML()` 只导出当前习作页。若需整站离线包，直接把 `心奇学作文.html` 整文件拷贝即可（本身已自包含）。 |
| **思维导图填空为前端临时交互** | 虚线 `contenteditable` 填写内容刷新页面或切换篇目后会丢失（未持久化）。属于"想大纲"辅助，非必填；如需保存，引导用户用导出/打印固化。 |
| **`req` 教材要求为人工整理** | 来自统编版教材公开要求，非机器校验；修订时以 `cur_data.json` 中 `req` 为准，避免改写教案原文。 |
| **内容均需人工审阅** | 79 篇范文由 AI 按年级梯度生成并经字数自测，但教学准确性/价值观需人工抽检；低风险，但发布前建议通读一遍高年级篇目。 |
| **大模型生成依赖脚本** | 直接手改 `COMPOSITIONS` 易破坏结构；规模化修订务必走 §8 的 `gen2.js` 管线，让脚本保证字段完整。 |
| **Node 版本** | 生成脚本仅用 Node 内置 `fs`/`require`，**无需 npm 安装任何依赖**；任意 Node ≥ 14 即可运行（本环境用 22.22.2）。 |

---

## 7. 部署与配置

本应用是纯前端单文件，**无需服务器配置**。两种分享方式：

1. **本地/私发**：直接把 `心奇学作文.html` 发给对方，双击用浏览器打开即用。
2. **云端分享链接（当前在用）**：
   - 将最新 `心奇学作文.html` 复制到 `deploy/index.html`。
   - 通过 WorkBuddy 内置 `workbuddy_cloudstudio_deploy` 工具，以 `action:"deploy", directory:"<工作区>/deploy"` 发布。
   - 同目录重部署会复用同一 sandbox，**分享链接保持不变**：
     **https://fdc61c56d7134237bf99416cc5dd1317.app.workbuddy.link**
   - 管理已发布应用（如删除）：「设置 - 数据管理 - 我发布的应用」。

---

## 8. 维护指南（复现 / 继续完善）

### 8.1 工作区文件清单
```
心奇学作文.html        ← 成品（单文件应用，最终交付物）
心奇学作文.bak.html    ← 修改前备份（每次 splice 前自动 cp 生成）
deploy/index.html      ← 部署副本（与成品同步后发布）
cur_data.json          ← 从 HTML 导出的全部 COMPOSITIONS（含准确 req，作生成源）
essays_12.js           ← 1–2 年级范文（BAND1）
essays_3.js            ← 3 年级范文（BAND2）
essays_4.js            ← 4 年级范文（BAND2）
essays_5.js            ← 5 年级范文（BAND3）
essays_6.js            ← 6 年级范文（BAND3）
essays.js              ← 合并上述 5 个文件
gen2.js                ← 生成脚本：CATCFG 模板 + guide() + 字数校验 + 输出 comp_block.js
comp_block.js          ← 由 gen2.js 生成的完整 var COMPOSITIONS 数据块
essay_spec.md          ← 范文重写规范（口吻/字数/格式，供写作子代理使用）
```

### 8.2 场景 A：只改某篇/某年级的范文文字
1. 编辑对应 `essays_X.js` 中那篇的 `p:[{s, x}]`（`x` 为段落正文）。
2. 改完运行：`node gen2.js` → 重新生成 `comp_block.js`，终端会打印"越界篇数"（应为 0；若 >0 说明字数不在 §5.3 区间，需增删文字）。
3. 把 `comp_block.js` 拼回 HTML（见 §8.4）。
4. 复制 `deploy/index.html` 并重新部署（§7）。

### 8.3 场景 B：改引导模板（写法话术/思维导图/草稿）
- 编辑 `gen2.js` 里的 `CATCFG[分类]`（`steps` 三档难度 `d`、`formula`、`bt/bp` 大纲、`ol` 草稿、`tip`）。
- 重跑 `node gen2.js` 即可对所有该分类习作统一生效。

### 8.4 把 comp_block.js 拼回 HTML（精确替换）
`COMPOSITIONS` 块位于 `心奇学作文.html` 第 **347** 行（`var COMPOSITIONS = {`）到"渲染逻辑"注释前的 `};`。替换步骤（Node 脚本示例）：
```javascript
const fs=require("fs");
const html=fs.readFileSync("心奇学作文.html","utf8").split("\n");
const block=fs.readFileSync("comp_block.js","utf8").replace(/\n$/,"").split("\n");
const start=346, end=html.findIndex((l,i)=>i>start && l==="};" && html[i+1].includes("渲染逻辑")); // 实际以注释定位
// 稳妥做法：start=346，end = 行号(11274 量级) 或 用 "/* === 渲染逻辑 ===" 之前那行
const out=html.slice(0,start).concat(block, html.slice(end+1)).join("\n");
fs.writeFileSync("心奇学作文.html", out);
```
> 实操建议：先用 `cp 心奇学作文.html 心奇学作文.bak.html` 备份；再 grep `var COMPOSITIONS` 与 `渲染逻辑` 定位起止行号后替换。

### 8.5 校验（每次修改后必做）
```javascript
// 1) 语法：提取 <script> 用 new Function 解析，应 0 错
// 2) 运行时：Proxy DOM 桩 + vm.runInNewContext 执行整段脚本，应 0 异常
//    并调用 selectFirst()/renderSide()/showItem("6x",0)/showItem("1s",0) 均 0 错
// 3) 形状：遍历每篇确认 u/t/cat/req、how.steps[].{t,ico,d}、mind.branches[].{title,points}、
//         outline.cards[].{dt,dd,ex}、essay.paras[].{seg,text} 齐全
// 4) 字数：gen2.js 末尾报告越界篇数应为 0
```

### 8.6 新增一篇习作
1. 在 `cur_data.json` 对应学期数组加一项 `{u,t,cat,req}`（保持顺序）。
2. 在对应 `essays_X.js` 同位置加一篇 `{t, p:[...]}`，`t` 与 `cur_data` 一致、字数符合 §5.3。
3. 重跑 `node gen2.js` → 校验 → 拼回 HTML → 部署。

---

## 9. 版本日志

| 版本 | 日期 | 关键变更 |
|---|---|---|
| v0.1 | 早期 | 「读后感写作小课堂」单页（三年级，四板块：方法/思维导图/草稿/范文）。 |
| v0.2 | 早期 | 改为多分页「写作小课堂」（顶部导航 4 个 tab：读后感/写事/写景/游记）。 |
| v0.3 | 早期 | 升级为「心奇学作文」，按统编版覆盖 1–6 年级 12 学期习作；加主标题弹窗、侧栏折叠、学期/类型双排列、完整 HTML 导出、跨学期"类似作文"联动。 |
| v0.4 | 早期 | 主标题弹窗信息完善（两种排列说明、打印/导出/链接功能、版本+更新日期、删除更新日志）；扩展覆盖完整 12 学期 79 篇教材要求。 |
| **v1.0** | **2026-08-27** | **年级差异化修订全部 79 篇引导与范文**：范文长度按真实年级梯度拉开（1上≈46 字 → 6下≈510 字），口吻分化（低年级儿童/高年级成熟、男女主角交替）；范文改为动态字数标注；生成管线脚本化（essays_*/gen2.js/comp_block.js）；语法/运行时/数据形状/字数四重校验通过；重新部署，链接不变。 |

---

## 10. 附录

### 10.1 渲染函数速查
`renderSelRow, renderSide, getList, selectFirst, showItem, highlight, toolbarHTML, changeFont, applyFont, howHTML, mindHTML, outlineHTML, essayHTML, similarHTML, jumpTo, board1~5, footerHTML, toggleSide, exportHTML`

### 10.2 关键 DOM id 速查
`appTitle, collapseBtn, modeBtn, selRow, toc, expandBtn, main, mainInner, modalMask, modalClose, gradeSel, termSel, catSel, fsLabel`

### 10.3 主题色（CSS 变量）
`--bg:#f6f3ee`（米白底）· `--brand:#e8643a`（主橙）· `--brand-dark:#c64f28` · `--ink:#3a3a3a` · 分类配色见 §5.4。字体：`PingFang SC / Microsoft YaHei / Hiragino Sans GB`，行高 1.75，整体大字号、圆角、暖色。

### 10.4 复现一句话总结
> 改 `essays_*.js`（范文）或 `gen2.js`（模板）→ `node gen2.js` 生成 `comp_block.js` → 拼回 `心奇学作文.html` → 四重校验 → 复制 `deploy/index.html` → 部署（链接不变）。

### 10.5 作者与许可
- 版本 v1.0 · 更新日期 2026-08-27 · 作者：**Peppa's Daddy**
- 本应用为教学辅助工具，范文由 AI 按年级梯度生成，使用时建议结合学校教材与教师指导。
