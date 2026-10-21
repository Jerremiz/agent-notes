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
- [ ] `::: analogy` 去留（书里没用，styleguide 有示例）

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

- [ ] 桌面、手机 × 浅色、深色；固定视口、清空 localStorage、等字体加载。
- [ ] 按章节截图为主；展开问答、点自测、操作演示后再截。
- [ ] 检查控制台报错、资源 404、重复 id、站内链接和锚点。
- [ ] 先给现有三个旧页面拍基线。注意 Windows 拍的基线不能拿去和 Linux 比像素。

### 3. 迁第二部分，再迁第一部分

按 agent-notes 的 AGENTS.md「迁移期间」四步做；演示 JS 拆成独立文件；每页完成后核对全站目录、首页地图和交叉链接。

### 4. 首页接入统一模板，删掉旧机制

- [ ] 生成器支持普通页面（首页）进统一模板；本质地图脚本搬出 `guide.js`。
- [ ] 删除 `legacy/`、`legacyChapters`、`copy` 里的 legacy 规则、旧 CSS/JS —— **删除前先列清单给用户确认**。

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
