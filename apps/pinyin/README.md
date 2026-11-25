# 心奇学拼音 · 应用说明文档（README）

> **文档版本号：v1.0** —— 这是**本说明文档自身**的版本号。
> **文档更新日期：2026-08-26** —— 即文件名中的 `(20260826)`，表示本文档的更新日期。
>
> 本文档描述的是应用 **「心奇学拼音」**。其最新构建文件为 `心奇学拼音.html`（应用内部基于 **v1.5** 功能集；按既定设计规范，应用主标题始终只显示「心奇学拼音」，不显示版本号，版本信息仅体现在文件名与教程备注中）。
>
> 本文档的目标：让任何其他 WorkBuddy 用户在获得本目录后，**无需额外沟通即可复现该应用、理解其实现，并继续完善修改**。

---

## 目录

1. [目的需求](#一目的需求)
2. [设计思路](#二设计思路)
3. [系统结构与组件](#三系统结构与组件)
4. [用户界面与操作说明](#四用户界面与操作说明)
5. [数据与接口规范](#五数据与接口规范)
6. [遗留问题与规避](#六遗留问题与规避)
7. [部署与配置](#七部署与配置)
8. [维护指南](#八维护指南)
9. [版本日志](#九版本日志)
10. [附录](#十附录)

---

## 一、目的需求

### 1.1 背景
为 Sophia 与 George 两位儿童开发的**拼音练习小程序**，用于在日常（iPhone / Windows PC）中反复练习汉语拼音的认读与发音。

### 1.2 功能需求（已落地）
- **答题练习**：系统按错误率智能抽取 10 张拼音卡片，儿童翻卡认读后自行或自动判题，结束后给出成绩与鼓励语。
- **拼音题库**：1580 条经清洗的合法拼音音节，记录出现次数、错误次数、错误率、权重，按错误率颜色分级，并提供错误率分布可视化。
- **练习记录**：按时间倒序保存历史成绩，追踪学习进度。
- **设置**：可自定义鼓励语、各错误率区间的抽题权重、语音判题相似度阈值、宝宝名字。
- **判题模式**：支持「人工判题」与「自动判题」。自动模式下儿童点录音读出拼音，程序自动比对发音并判定对错。
- **发音列**：题库每行可🔊播放该拼音（含声调）的标准读音（Web Speech API，zh-CN）。
- **中英文切换**：全界面 i18n 同步切换，偏好持久化保存。
- **使用教程**：图文介绍六个核心功能（署名 Peppa's Daddy，日期 2026.8.5）。
- **学习档案**：支持导出/导入/清除本地学习数据（JSON 备份）。

### 1.3 非目标（明确不做）
- 不接入后端服务器、不做账号体系、不做云端同步（纯前端 + 浏览器本地存储）。
- 不做真正的声纹/说话人生物识别（见[第六节](#六遗留问题与规避)）。
- 不做多用户、不采集任何隐私上传。

---

## 二、设计思路

| 维度 | 取舍与理由 |
|---|---|
| **形态** | 纯前端**单文件 HTML**（CSS+JS 全部内联），双击即开、零安装、零构建，最适合儿童在家长手机/电脑上直接使用，也最便于备份与分发。 |
| **存储** | 浏览器 `localStorage`，无需服务器；数据随设备/浏览器，符合儿童应用"不外传"的隐私预期。 |
| **题库生成** | 用代码 `buildPinyinBank()` 按声母×韵母×声调**规则化生成**并去重，而非硬编码一长串列表；保证音节合法（依据《新华字典》拼音规则），且后续改题库只改生成规则。 |
| **抽题策略** | **加权随机**：错误率越高的拼音权重越大、越容易被抽中，实现"哪里不会练哪里"。 |
| **发音判题** | 纯前端无 ML/云服务，采用**声调轮廓相似度**近似代替真实声纹比对：分帧自相关基频检测 → 归一化 → 与标准声调轮廓比较，得 0–100 相似度，按阈值判对错。 |
| **i18n** | 所有界面文案集中在 `I18N` 对象，DOM 用 `data-i18n` 标记；切换语言只换字典并刷新文本，不重建结构。 |
| **版本号规范** | 按需求，版本号仅体现在**文件名末尾**与**教程备注**中（如"版本：1.5"）；应用主标题始终为"心奇学拼音"，不显示任何版本号或数字，保持界面纯净。 |

---

## 三、系统结构与组件

### 3.1 文件结构（本备份目录）
```
心奇学拼音\
├── 心奇学拼音.html                          # 最新完整版（单文件应用，含全部功能，已部署）
└── 心奇学拼音v1.0(20260826)_readme.md        # 本文档
```
> 说明：历史上还存在 `心奇学拼音2.html`（v2.1 题库纠错版）、初版 `心奇学拼音.html`，但本目录仅保留最新可用构建。

### 3.2 页面骨架（DOM 分区）
- `header`：应用标题 + 副标题 + 概览条（累计答题 / 正确率 / 上次得分）。
- `backup-bar`：顶部功能栏（教程📖 / 判题模式 / 导出💾 / 导入📥 / 清除🗑️ / 语言🇨🇳）。
- `main`：四个 `tab-content` 区（答题练习 / 题库 / 记录 / 设置），通过 `switchTab()` 切换。
- `bottom-nav`：底部四导航（📝答题 / 📚题库 / 📊记录 / ⚙️设置）。
- 若干 `modal-overlay`：成绩弹窗、确认弹窗、教程弹窗、录音弹窗、判题动画弹窗。

### 3.3 核心 JS 模块（函数索引）
| 模块 | 关键函数 | 职责 |
|---|---|---|
| 国际化 | `I18N`、`t()`、`applyI18n()`、`toggleLanguage()` | 双语字典、文本刷新、语言切换 |
| 题库 | `TONE_MAP`、`applyTone()`、`makeEntries()`、`buildPinyinBank()` | 拼音生成与声调标注 |
| 状态/存储 | `loadData()`、`saveData()`、`LS_PREFIX` | localStorage 读写 |
| 概览 | `updateOverview()` | 顶部统计 |
| 抽题 | `getWeight()`、`weightedRandomSelect()`、`startQuiz()` | 加权随机抽 10 题 |
| 答题 | `flipCard()`、`judgeAnswer()`、`showResult()`、`renderCards()` | 翻卡/判题/成绩 |
| 退出 | `requestExitQuiz()`、`exitQuizNoRecord()` | 退出不记录（快照回滚） |
| 发音/录音/判题 | `playPronunciation()`、`startRecording()`、`comparePronunciation()`、`getTargetContour()` | 发音播放、录音、声调比对 |
| 题库页 | `renderBank()` | 表格 + 分布堆叠条 |
| 记录页 | `renderRecords()` | 历史成绩卡片 |
| 设置页 | `loadSettingsToForm()`、`saveSettings()`、`resetSettings()` | 设置读写 |
| 档案 | `exportData()`、`importData()`、`clearAllData()` | 备份/恢复/清除 |
| 教程 | `renderTutorialContent()`、`showTutorial()` | 图文教程 |
| 引导 | `init()` | 启动、预载语音、首次填充示例数据 |

### 3.4 状态对象
```js
let currentLang = 'zh';                 // 'zh' | 'en'
let pinyinBankStats = {};               // { [entryId]: { totalCount, errorCount } }
let quizRecords = [];                   // [{ date, time, score, totalQuestions }]
let settings = {};                      // { encouragements, weights, babyName, similarityThreshold }
let currentQuiz = null;                 // { questions[10], answers[10], startTime }
let judgeMode = 'manual';               // 'manual' | 'auto'
let simThreshold = 80;                  // 60~100, step 10
```

---

## 四、用户界面与操作说明

### 4.1 顶部概览条
实时显示**累计答题**次数、**正确率**、**上次得分**。

### 4.2 功能栏（backup-bar）
| 按钮 | 作用 |
|---|---|
| 📖 使用教程 | 打开图文教程弹窗（六个功能介绍）。 |
| 🙋 人工判题 / 🤖 自动判题 | 切换判题模式；**答题进行中禁用**。 |
| 💾 导出备份 | 下载当前学习数据 JSON 文件。 |
| 📥 导入恢复 | 选择 JSON 文件恢复数据。 |
| 🗑️ 清除数据 | 清空全部数据（需二次确认）。 |
| 🇨🇳 中文 / En English | 中英界面切换。 |

### 4.3 四个标签页
1. **答题练习**
   - 点「🚀 开始答题」→ 系统抽 10 张卡。
   - 点卡片翻面看拼音 → 人工模式点 ✓/✗；自动模式点「🎤 录音」读出拼音后自动判题。
   - 答满 10 题弹出成绩、星级与鼓励语；可「🔄 再来一次」或「退出答题」。
   - 「已答 N / 10」右侧有「🚪 退出答题」：确认后**回滚本次统计且不记录成绩**。
2. **拼音题库**
   - 表格列出全部拼音 + 出现次数 + 错误次数 + 错误率 + 权重；颜色越深错误率越高。
   - 每行🔊播放标准读音。
   - 右上角**横向堆积条**按错误率 6 档分色，**悬停显示该档拼音个数**。
3. **练习记录**
   - 倒序展示最近 20 条成绩（满分绿、优秀橙、良好黄等配色）。
4. **设置**
   - 👶 宝宝名字（默认 `Sophia & George`，**不随语言切换变化**；导出文件名加 `(姓名)` 前缀，导入时自动回填）。
   - 鼓励语（5 档分数各一句）。
   - 权重系数（6 档错误率区间，数值越大越易被抽中）。
   - 语音判题相似度阈值（60%–100%，步进 10%，默认 80%）。

### 4.4 教程弹窗
署名 **Peppa's Daddy**，日期 **2026.8.5**，版本 **1.5**，介绍：① 答题练习 ② 拼音题库 ③ 练习记录 ④ 设置 ⑤ 判题模式 ⑥ 学习档案。

---

## 五、数据与接口规范

### 5.1 本地存储（localStorage）
前缀常量 `LS_PREFIX = 'wb_pinyin_'`。

| Key | 类型 | 说明 |
|---|---|---|
| `wb_pinyin_lang` | `'zh' \| 'en'` | 界面语言偏好 |
| `wb_pinyin_bankStats` | `{ [entryId]: { totalCount:int, errorCount:int } }` | 每音节答题统计 |
| `wb_pinyin_records` | `Array<{ date:'YYYY-MM-DD', time:'HH:MM', score:int, totalQuestions:int }>` | 成绩记录（最多保留 200 条） |
| `wb_pinyin_settings` | `{ encouragements, weights, babyName, similarityThreshold }` | 设置 |
| `wb_pinyin_judgeMode` | `'manual' \| 'auto'` | 判题模式 |
| `wb_pinyin_simThreshold` | `int` | 兼容遗留字段；新版本以 `settings.similarityThreshold` 为准 |

### 5.2 题库条目结构（内存）
`buildPinyinBank()` 产出数组，单条：
```js
{ id: "b_a_1",          // 唯一键 = 声母+韵母+下划线+声调
  pinyin: "bā",         // 带声调 HTML 实体的显示串
  raw: "ba",            // 原始拼音（无声调）
  tone: 1 }             // 1..4
```
总计 **1580** 条。生成规则要点：
- `TONE_MAP`：元音 `a/e/i/o/u/v` → 四个声调的 HTML 实体。
- `applyTone()`：声调标注优先级 —— 含 a/e 标 a/e；`ou` 标 o；`iu` 标末位 u；`ui` 标末位 i；否则标最后元音。
- `makeEntries()` 的 ü 书写规则：**n/l 后保留两点（ü）**；**j/q/x/y/零声母后写作 u（去两点）**。
- 整体认读音节（`zhi/chi/shi/ri/zi/ci/si/yi/wu/yu/ye/yue/yin/yun/yuan/ying`）单独枚举，最后按 `id` 去重。

### 5.3 备份文件（导出 JSON）规范
`exportData()` 生成结构：
```json
{
  "version": 1.5,
  "exportedAt": "ISO8601 时间戳",
  "babyName": "Sophia & George",
  "bankStats": { "b_a_1": { "totalCount": 3, "errorCount": 1 } },
  "records": [ { "date":"2026-08-05", "time":"10:30", "score":7, "totalQuestions":10 } ],
  "settings": { "encouragements": {...}, "weights": {...}, "babyName":"...", "similarityThreshold":80 }
}
```
- 文件名：`(宝宝名字)xinqi-pinyin-backup-YYYY-MM-DD.json`（名字中非法字符被替换为 `_`）。
- `importData()` 读取后恢复 `bankStats / records / settings`，并据此回填 `babyName`；与默认字典做合并，避免缺字段。

### 5.4 发音与判题"接口"（浏览器原生 API）
- 播放：`window.speechSynthesis` + `SpeechSynthesisUtterance`（lang=`zh-CN`，rate=0.85），前 0.1s 静音引导。
- 录音：`navigator.mediaDevices.getUserMedia({audio:true})` → `AudioContext` + `ScriptProcessorNode(4096,1,1)` 采集 PCM（Float32）。
- 判题：`comparePronunciation(samples, sampleRate, targetTone)`：
  - 分帧（40ms）自相关检测基频 `detectPitch()`；
  - 取有效帧归一化为 5 点声调轮廓 `userContour`；
  - 与标准轮廓 `getTargetContour(tone)`（见下）逐点求差 → 相似度 `sim = round(100*(1-平均差))`；
  - `ok = sim >= simThreshold`。
  - 标准声调轮廓 `shapes`（相对高度 0~1）：
    - 1 声：`[0.75,0.78,0.76,0.77,0.75]`（平）
    - 2 声：`[0.20,0.35,0.52,0.68,0.82]`（升）
    - 3 声：`[0.55,0.28,0.34,0.60,0.82]`（降升）
    - 4 声：`[0.85,0.66,0.46,0.30,0.18]`（降）

---

## 六、遗留问题与规避

| 问题 | 说明 | 规避 / 现状 |
|---|---|---|
| **"声纹比对"非真正生物识别** | 实为**声调轮廓相似度**近似，受环境噪声、儿童音高、麦克风质量影响，可能误判。 | 提供可调**相似度阈值**；告知家长其为辅助练习而非严格评测。如需更严格可接入云端语音识别（ASR）。 |
| **`createScriptProcessor` 已废弃** | 录音用 `ScriptProcessorNode`，部分新浏览器标记为废弃。 | 当前仍可用；后续可迁移到 `AudioWorklet`。不影响现有功能。 |
| **iOS Safari 语音播报限制** | `speechSynthesis` 需用户手势触发，voices 异步加载，rate/pitch 表现略有差异。 | `init()` 中预取 voices 并监听 `onvoiceschanged`；播放前 `cancel()` 避免排队。 |
| **麦克风授权被拒** | 自动判题依赖麦克风；拒绝后功能不可用。 | 捕获异常 → toast 提示「需要麦克风权限才能使用自动判题」；自动降级，不影响人工模式。 |
| **本地存储容量** | `localStorage` 约 5MB 上限；成绩记录上限 200 条。 | 记录 `slice(0,200)` 再存；统计仅存计数不存音频，体积极小。 |
| **题库为编译期静态** | 改题库需改 `buildPinyinBank()` 源码并重新部署。 | 已在[维护指南](#八维护指南)给出修改点。 |
| **单文件无版本号显示** | 应用主标题不含版本号（设计约定）。 | 版本信息在文件名与教程备注中；本文档独立标注文档版本。 |

---

## 七、部署与配置

### 7.1 部署形态
- 单文件静态站点：把 `心奇学拼音.html` 作为 `index.html` 部署到任意静态托管（本项目用 **CloudStudio** 沙箱）。
- **麦克风/录音必须 HTTPS 或 localhost**：`getUserMedia` 在非安全上下文不可用，部署务必启用 HTTPS。

### 7.2 线上访问
- 分享链接：`https://5dde2588021144d4b480f506cbd6e191.gz1.agentos-app.net`
- 应用管理：在 WorkBuddy 中「设置 - 数据管理 - 我发布的应用」可删除/管理已发布应用。
- Sophia 与 George 在 iPhone Safari 或 Windows PC 浏览器打开链接即可使用。

### 7.3 本地打开
- 直接双击 `心奇学拼音.html` 即可在浏览器使用（发音可用；**自动判题录音在 `file://` 下受浏览器安全策略限制可能不可用，需通过 http/https 访问**）。

---

## 八、维护指南

> 目标：让后续维护者能快速改功能、改题库、改文案、重新部署。

### 8.1 修改拼音题库
编辑 `buildPinyinBank()`（约第 1173 行起）：
- 增删声母行：`bank.push(...makeEntries('b',[...韵母...],[1,2,3,4]))`。
- 调整零声母表 `ZERO_INITIAL` 或整体认读表 `overall`。
- 改声调标注规则：`applyTone()`。
- 改 ü 书写规则：`makeEntries()` 内的 n/l 与 j/q/x/y 分支。
- 改完在浏览器打开验证；如需核验合法性，可复用历史校验脚本逐音节比对《新华字典》。

### 8.2 修改默认设置
- 鼓励语默认：`getDefaultEncouragements(lang)`。
- 权重默认：`DEFAULT_WEIGHTS`（high/medium/low/veryLow/perfect/never）。
- 相似度阈值默认：`simThreshold` 初值（80）与设置页 `input#setSim` 的 `value`。

### 8.3 增加界面语言或文案
- 新增/修改 `I18N.zh` 与 `I18N.en` 的键值。
- 在 DOM 元素加 `data-i18n="key"`（静态文本）或直接用 `t('key')`（JS 动态文本）。
- 教程文案在 `I18N.*.tutorialSectionXxx`。

### 8.4 新增一个标签页
1. 在 `main` 内加 `<section class="tab-content" id="tabXxx">`；
2. 在 `bottom-nav` 加对应 `nav-item`；
3. `switchTab()` 的 `tabMap` / `navMap` 增加映射；
4. 若需渲染，加 `renderXxx()` 并在 `switchTab` 与 `applyI18n` 中调用。

### 8.5 调整发音判题灵敏度
- 标准轮廓：`getTargetContour()` 的 `shapes`。
- 判定阈值：设置页 `setSim`（默认 80，范围 60–100）。
- 基频检测范围：`detectPitch()` 的 `minF=70, maxF=400`。

### 8.6 重新部署
1. 将修改后的 `心奇学拼音.html` 复制到部署目录（如 `dist/index.html`）。
2. 通过 CloudStudio 静态部署（同一沙箱链接覆盖更新），确保 HTTPS。
3. 验证：发音、答题、导出/导入、自动判题（需授权麦克风）均正常。

### 8.7 二次开发建议
- 将题库/设置改为可由 JSON 配置注入，降低改源码成本。
- 用 `AudioWorklet` 替换 `ScriptProcessorNode`。
- 可选接入云端 ASR 提升自动判题严谨度。
- 增加"错词本""复习计划"等儿童学习增强功能。

---

## 九、版本日志

| 版本 | 日期 | 关键内容 |
|---|---|---|
| 初版（心奇学拼音） | 2026-08-05 | 标题替换、中英文切换、使用教程弹窗 |
| v2 | 2026-08 | 判题模式（人工/自动）、题库发音列、自动判题录音+声纹比对、语音相似度阈值、教程扩充 |
| v2.1 | 2026-08 | 题库拼音纠错（ü 去/留两点、声调位置修正、移除非法音节、去重、补回有效音节），保留 1580 条 |
| **v1.5（应用当前构建）** | 2026-08 | 8 项优化：版本号管理、固定按钮尺寸、彩色 emoji 图标、退出答题不记录、弹窗配色+判题徽章、题库分布堆叠条、宝宝名字、输入框对齐 |
| **文档 v1.0（本文档）** | **2026-08-26** | 首次形成完整可复现说明文档，涵盖目的需求/设计思路/系统结构/界面操作/数据接口/遗留问题/部署配置/维护指南/版本日志/附录 |

> 注：应用版本号仅用于文件名与教程备注（如"版本：1.5"），主界面标题始终为"心奇学拼音"。本文档版本号 v1.0 与文件名 `(20260826)` 仅标识**说明文档**自身，与应用内部版本无关。

---

## 十、附录

### A. 本目录文件清单
| 文件 | 说明 |
|---|---|
| `心奇学拼音.html` | 最新完整版（含全部功能，已部署） |
| `心奇学拼音v1.0(20260826)_readme.md` | 本文档 |

### B. i18n 关键字段类别（节选）
- 导航/按钮：`tabQuiz/tabBank/tabRecords/tabSettings`、`btnTutorial/btnExport/btnImport/btnClear`、`startQuiz/exitQuiz/tryAgain`
- 题库：`bankTitle/thPinyin/thAppeared/thErrors/thErrorRate/thWeight`、`legendHigh…legendNever`、`distTotal/distUnit`
- 设置：`encTitle/weightTitle/simTitle2`、`enc10…enc0`、`wHigh…wNever`、`saveSettings/resetDefaults`
- 判题/语音：`judgeManual/judgeAuto`、`recordBtn/recordingTitle/recordingDesc`、`autoCorrect/autoWrong/autoNoSpeech`、`toastNeedMic/toastMicFail/toastQuizActive`
- 教程：`tutorialTitle/tutorialAuthor/tutorialDate/tutorialVersion`、`tutorialSection1Title…tutorialSection6Text`

### C. 关键常量速查
- `LS_PREFIX = 'wb_pinyin_'`
- 每局题数：固定 **10**（`startQuiz` 中 `weightedRandomSelect(...,10)`）
- 相似度阈值：默认 **80**，范围 **60–100**，步进 **10**
- 题库条目数：**1580**
- 记录上限：**200** 条
- 声调轮廓采样点：**5**

### D. 复现最小步骤
1. 取得本目录的 `心奇学拼音.html`。
2. 双击打开即运行（发音可用；自动判题录音建议经 http/https 访问）。
3. 如需分发：按[第七节](#七部署与配置)部署为静态站点并启用 HTTPS。
4. 如需改功能：按[第八节](#八维护指南)定位对应函数修改后重新部署。

---
*文档版本 v1.0 · 更新日期 2026-08-26 · 应用：心奇学拼音（构建基于 v1.5）*
