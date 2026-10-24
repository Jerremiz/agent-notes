# 迁移计划：agent-notes 全部改由 notes-theme 生成

新对话从这里开始：先读本文件，再读两个仓库的 AGENTS.md。完成一步就在这里勾掉，并补上结论。

## 现状（2026-10-21）

- `E:\repo\notes-theme`：主题 + 生成器，1 个提交，没有 remote 和 tag，**第一版还没写完，迁移期间不发布**。
- `E:\repo\agent-notes`：在未推送的 `md-pilot` 分支，比 `main` 多 1 个提交。依赖 `"notes-theme": "file:../notes-theme"`（node_modules 里是指向主题目录的 junction）。
  - 第三部分已迁成 `content/part3/*.md`。
  - 首页、第一部分、第二部分还在 `legacy/`，构建时原样复制，靠 `legacy/assets/guide.css`、`guide.js`；四页共用生成的 `assets/book.js`（旧页面的目录数据来自 `notes.config.mjs` 的 `legacyChapters`）。
- 剩余量：part2 7 章约 650 行（演示：会话树、钩子）；part1 9 章约 1300 行（演示：Agent Loop 模拟器、上下文预算、prompt 拼装、edit 匹配、五个槽位图）；首页约 145 行（本质地图）。旧页面用到的结构主题里都已有组件；演示的样式已在 `assets/agent.css`，脚本还在 `legacy/assets/guide.js` 169–490 行（演示）、525–605 行（首页地图）。

## 已定的原则

- 迁移期间不发布 notes-theme，继续 `file:` 本地联调；第一版定下来再发布 `v0.1.0`。
- 不换 VitePress / Docusaurus 等框架，继续轻量自研。
- 每个交互演示：HTML 放 `widgets/名字.html`（`::: widget 名字`），JS 一个演示一个文件；`agent.js` 只留全书公共逻辑（章首问题标签、名词卡）。注意书脚本必须在 `shell.js` 之前执行。
- 首页只做最小的生成器支持：接入统一模板，不参与章号和进度；hero、导读布局写在书里，不设计通用首页配置。
- 每页分两次验收：先等价迁移（正文、章节 id、小节锚点、`storageKey`、交互都不变），再做内容调整。

## 待决定

- [x] 主题继续独立仓库，还是放进 agent-notes 当 `packages/notes-theme`？（倾向独立仓库；代价是主题发布前 `md-pilot` 不能合并上线）
  - 结论（2026-10-21）：**继续独立仓库** `E:\repo\notes-theme`。接受代价：主题发布 `v0.1.0` 之前，`md-pilot` 不合并上线。
- [ ] edit 匹配演示改成静态表格？会话树改成静态图？（等价迁移之后再定）
- [x] `::: analogy` 去留（书里没用，styleguide 有示例）
  - 结论：保留。旧页面的“Java 类比”框（`div.java`）就是它，第二部分已经在用。
- [x] 名词卡的名称、状态以哪边为准？迁移后跟随 `data/agent.mjs`（和首页本质地图一致），和旧卡片有 5 处不同：hooks“Hooks / Plugins”→“Hooks”、protocols“Agent 协议家族”→“Agent 协议家族（A2A · ACP · AG-UI）”、swebench“SWE-bench、Terminal-Bench 与时间跨度”→“SWE-bench 等基准”；状态 injection“未解决”→“仍在演变”、swebench“更新很快”→“仍在演变”。要保留旧写法，就改 `data/agent.mjs`（首页地图跟着变），或给名词卡加覆盖写法。第一部分迁移时可能还有更多。
  - 结论（2026-10-22）：**维持现状，以 `data/agent.mjs` 为准**（和首页本质地图一致）。旧卡片上的写法不保留；第一部分照此处理。

- [ ] notes-theme 里对 `legacy: true` 页面和 `legacyChapters` 的支持删不删？只用于手写 HTML 页面渐进迁移；agent-notes 已不再使用，在现有主题上继续改或写第二本书都用不到。（建议删，等用户确认）
- [ ] 是否把全书合成一个 HTML（目前分 index / part1 / part2 / part3 四页，页面之间有目录栏、翻页和正文里 19 个跨页链接）？用户要求**上线（第 6 步）之前讨论**。要考虑：旧网址 `partN.html#cN` 怎么转到新地址（GitHub Pages 只能靠静态小页面加脚本跳转）、主题生成器和目录栏 / 翻页要怎么改、部分标题是否保留为目录分组。阅读进度按章 id 存，不受影响。

## 步骤

### 1. 修 notes-theme 的基础问题，补小型回归测试

- [x] `lib/build.mjs`：`out` 必须在书目录内且不能是书目录本身（防 `.`、`''`、`..`）；先构建到临时目录，成功后再替换 `docs/`，失败保留上次产物。
  - 另外拒绝 `out` 和 `content/`、`widgets/`、`copy` 来源重叠。临时目录是 `out` 旁边的 `.notes-build-<out>.tmp`，替换时旧目录先改名为 `.old` 再删；Windows 上改名被占用时重试约 1 秒。
- [x] `copy` 覆盖生成文件时报错（防止迁完一页后被 `legacy/` 旧文件盖回去）。
  - 两条 copy 规则写同一个文件、目标跑出输出目录也报错；`legacy: true` 的页面如果 copy 没提供对应 HTML 也报错（迁移第 3 步删旧文件时能兜住漏改配置）。
- [x] 构建前校验：章节 `part` 必须在 `config.parts`、章节 id 唯一、必填字段、`home.entries` 锚点存在；报错带文件名和字段。
  - 新文件 `lib/validate.mjs`，所有问题一次报完。额外检查：章节 `part` 必须属于它所在的页面、不认识的 front matter 字段（防拼错）、`imp` 取值、`legacyChapters`、`pages`/`parts`/`importance`/名词表。锚点检查在生成后、替换前做，所以首页是 legacy 时也能查。
- [x] `lib/frontmatter.mjs`：纯数字值（如 `title: 2048`）导致 `esc` 报 `s.replace is not a function`；按字段规范化或明确报错。README 示例里的行尾 `# 注释` 解析器不支持，二选一：改 README 或支持它。
  - 解析器不再猜类型：标量一律是文字（`n: 007` 不会变成 7），只有 `[a, b]` 是列表；字段类型由 `validate.mjs` 按字段检查。**改了 README**：示例去掉行尾注释，字段说明改成表格，并写明行尾 `#` 不是注释（`title: C# 入门` 要能用）。
- [x] `lib/highlight.mjs` 的 `esc` 只转义 `&<>`，却用于属性（`data-t="..."`）；区分文本转义和属性转义，校验 id。
  - `esc`（文本）和 `escAttr`（属性，另转 `"` `'`）；所有进属性的值改用 `escAttr`。id、页面文件名、`importance` 键、名词 id/状态、`widget` 名字都做了格式校验。
- [x] `lib/markdown.mjs` 的 `split` 先按行切再分别解析，已知会破坏：组件两侧的引用式链接、`<pre>` 里的 `:::`、带尾随文字的反引号行。改成 markdown-it 块规则。
  - 组件 API 不变（仍拿到 `{ name, args, body }`）。一章共用一个 env，组件内外的引用式链接互通。多余的 `:::`、未闭合的组件报错，行号是文件里的行号。
- [x] `components/quiz.mjs`：每题必须恰好一个 `[x]`；解析在构建时渲染成 HTML（现在前端用 `textContent`，Markdown 不生效）。
  - 输出改为 `<div class="why" hidden><span class="verdict"></span>解析 HTML</div>`，`shell.js` 只填“答对了/再想想”。`legacy/` 页面不用主题的自测，不受影响。
- [x] `bin/dev.mjs`：路径边界用 `startsWith` 不可靠（可落到 `docs-xxx` 兄弟目录）；捕获 URL 解码异常；只监听 127.0.0.1。
  - 用旧版实测确认过两个问题都存在（`/..%5Cdocs-secret%5Cx` 能读到兄弟目录；坏编码直接让进程崩溃）。监听器同时忽略构建临时目录，避免重建死循环。
- [x] `config.data` 不能覆盖 `chapters/pages/site` 等保留键；Node 版本要求和锁文件里 `entities` 的 `>=20.19.0` 统一。
- 回归测试：`npm test`（`node:test`，不加依赖），73 条，覆盖以上每一项。agent-notes 重新构建后，`docs/` 只有自测相关的预期差异（`part3.html` 的解析标记、`assets/shell.js`）。
  - 尚未在浏览器里点过自测：留给第 2 步的 Playwright 脚本一起验。

### 2. 截图和交互对比脚本（Playwright）

- [x] 桌面、手机 × 浅色、深色；固定视口、清空 localStorage、等字体加载。
  - `scripts/shots.mjs`（agent-notes 里，按“第二本书用到再搬进主题”的原则）。桌面 1280×800，手机 390×844 @2x；每个配置是全新的浏览器上下文；`reducedMotion: reduce`、关动画、隐藏光标、固定时区和语言；外部请求一律拦下。
  - 浏览器用 playwright 锁定的 Chromium（1.64.1 → Chromium 156），不用本机会自动更新的 Chrome。
- [x] 按章节截图为主；展开问答、点自测、操作演示后再截。
  - 按元素 id 命名（`c4.png`、`learn.png`、`rail.png`、`_top.png`），迁移前后靠名字对上。`@open`、`@quiz` 只截有变化的章节；演示在 `scripts/shots.config.mjs` 里按元素 id 写操作，截所在的 `.panel`（`@demo-名字`）。
- [x] 检查控制台报错、资源 404、重复 id、站内链接和锚点。
  - 往页面里故意塞了坏链接、坏锚点、重复 id、`console.error`、404 图片、外部请求，六类全部报出，合法锚点没有误报。
- [x] 先给现有三个旧页面拍基线。注意 Windows 拍的基线不能拿去和 Linux 比像素。
  - `shots/baseline/`：四页 × 四个配置共 380 张，检查零问题。`compare` 发现两边平台不同时直接拒绝。
  - 稳定性：同一份产物连拍三遍，两次对比都是 0 差异。为此修了三处抖动来源：目录栏的平滑滚动（等所有滚动停稳再截）、焦点框和悬停（截前移开鼠标、取消焦点）、亚像素位置（截前把元素顶端滚到整数像素，吸顶目录栏截图时改成 static）。
  - 残余风险：偶尔有一条 1 像素宽的边界抖动，报告里单列为“细微差异”，不隐藏。
  - 注意：迁完的页面会多出 `footer.png`（旧页面没有页脚），这是预期的“新增”。

### 3. 迁第二部分，再迁第一部分

按 agent-notes 的 AGENTS.md「迁移期间」四步做；演示 JS 拆成独立文件；每页完成后核对全站目录、首页地图和交叉链接。

- [x] 第二部分（2026-10-22，等价迁移）
  - 用一次性脚本在关掉 JS 的 Chromium 里解析 `legacy/part2.html` 生成 Markdown，再人工审。演示：`widgets/session-tree.html`、`widgets/hook-sim.html`，脚本 `assets/demos/session-tree.js`、`hook-sim.js`（从 guide.js 原样搬来）。guide.js 里这两段和第二部分的 9 道自测题已删。
  - 主题为此新增：`sql` 高亮；组件参数末尾 `{open}`（`term`、`ref`、`q` 默认展开，旧页面里 MCP 名词卡是默认展开的）。
  - 验收（`compare baseline part2-b`）：`book.js` 一字未改（章号、目录、所属问题）；正文逐字一致；目录栏、首页、第一和第三部分截图不变；链接、锚点、重复 id、控制台检查零问题；两个演示都能操作，会话树截图逐像素一致。
  - 有意保留的差异：① 3 个名词卡的名称和 2 个状态标签改为跟随 `data/agent.mjs`（hooks、protocols、swebench 的名称；injection、swebench 的状态），因为主题的名词卡只从名词表取这些信息——用户已确认以名词表为准；② 两个 `text` 代码块（事件序列、恢复顺序）里 `← …` 注释不再是灰色；③ 代码高亮改由主题生成，`undefined`、对象键 `type:` 等也会上色；④ 新增页脚（旧页面没有）；⑤ 文字抗锯齿和亚像素偏移。
- [x] 第一部分（2026-10-22，等价迁移）
  - 9 章；4 个演示：`agent-loop-sim`、`context-budget`、`prompt-builder`、`edit-match`（HTML 在 `widgets/`，脚本在 `assets/demos/`，从 guide.js 原样搬来）。guide.js 里这 4 段和 20 道自测题已删，顺带删了迁第三部分时漏删的第 17 章那道题。`legacyChapters` 已清空。
  - 原样 HTML（主题没有对应组件，内容调整阶段再看）：第 1 章“变薄 / 移交 / 变厚”三栏图、第 5 章五个槽位图、第 2、8、9 章的章首导语 `p.lead`、第 8 章两个单元小标题。
  - 验收（`compare baseline part1-a`）：`book.js` 一字未改；正文逐字一致；目录栏、首页截图不变；检查零问题；**桌面端 4 个演示操作后逐像素一致**。
  - 差异都属于第二部分已列的几类：名词卡跟随名词表（scaffold 状态；fc、longctx、skills 名称）、`text` 代码块注释不再是灰色（第 2 章“只看答案的奖励”）、新增页脚、亚像素偏移（手机端演示和第 4、6、7 章高度差 1 个 CSS 像素，图上一致）。

### 4. 首页接入统一模板，删掉旧机制

- [x] 生成器支持普通页面（首页）进统一模板；本质地图脚本搬出 `guide.js`。
  - 主题：`pages` 里 `plain: true`，`content/<页面>/` 每个文件一节（front matter 只有 `id`、`eyebrow`、`title`、`class`，包成 `section.home-sec`；没有 front matter 的原样输出，hero 写在 `content/index/00-hero.md`），不编章号、不进目录数据。
  - 书：`content/index/` 三个文件；本质地图 `widgets/essence-map.html` + `assets/demos/essence-map.js`（从 guide.js 原样搬来），目录栏“本质地图”下的七个问题改用 shell.js 的 `NOTES.subs` 扩展点注册。`copy` 里的 legacy 规则已去掉（否则旧 index.html 会和生成的首页冲突）。
  - 验收（`compare baseline home-a`、`home-b`）：hero、顶部一屏、目录栏截图不变，目录栏文字逐字一致，`book.js` 未变，检查零问题，地图两种视图和筛选都能用。差异：两个“示范”框的标签旧页面写成行内 `span.tag`，现在和全书其他类比框统一成 `div.tag`，“怎么学”一节矮了 15 像素；其余是亚像素偏移。
- [x] 删除 `legacy/`、`legacyChapters`、`copy` 里的 legacy 规则、旧 CSS/JS —— **删除前先列清单给用户确认**。
  - 2026-10-24 用户确认后删除：`legacy/index.html`、`legacy/assets/guide.js`、`legacy/assets/guide.css`、`legacy/` 目录、`notes.config.mjs` 里的 `legacyChapters` 和相关注释；`copy` 的 legacy 规则在上一项已去掉。AGENTS.md 的“迁移期间”改写成“加内容”。
  - 删除前确认过：生成的页面里没有任何文件引用 guide.css / guide.js；删除后重新构建，4 个 HTML 和 `book.js` 一字未变。
  - guide.css 443 条规则：358 条在新 CSS 里一字不差，37 条换了写法；48 条找不到同名选择器的，是改了名（`.pi`→`.ref`、`.java`→`.analogy`）或已无人使用的旧结构（`.three`、`.booktoc`、`.rail a.partlink` 等）。

### 5. 整理 notes-theme 第一版

- [ ] 文案配置化（“自测”“想一想”“上一部分”“答对了”，以及 CSS 里的“词”“问”），一个带默认值的 `labels` 配置即可。
- [ ] 补 LICENSE、更新 README 和 styleguide。
- [ ] 提交作者邮箱改成 GitHub noreply（现在是私人邮箱，作者和提交者都要改，**推送前**处理）。
- [ ] 干净环境重新安装、构建，确认 `docs/` 无差异。

### 6. 发布和上线

- [ ] 建 GitHub 仓库、推送、打 `v0.1.0`；agent-notes 改依赖 `github:Jerremiz/notes-theme#v0.1.0`，提交完整锁文件。
- [ ] 合并 `md-pilot`，Pages 改从 `/docs` 发布。本地没有 `CNAME`，切换前确认自定义域名 `agent.jeremiz.com` 不会断；检查旧 URL 和阅读进度。

## 参考

- Codex 对本计划的评审（2026-10-21）：codex://threads/01a15ecc-2d7e-7b62-8b83-69fe0d261490
