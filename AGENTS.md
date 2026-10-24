# 看懂 Agent · 写作和维护规则

## 结构

- 正文在 `content/<页面>/`，一章一个 Markdown 文件。组件写法见 notes-theme 的 README 和 styleguide。
- `docs/` 是生成结果，**不要手改**；改完内容运行 `npm run build`，连同 `docs/` 一起提交。
- 本地预览：`npm run dev`，打开 http://127.0.0.1:4000（只监听本机）。
- 名词、七个问题、五层在 `data/agent.mjs`；书的配置在 `notes.config.mjs`。
- 本书专用的样式和交互在 `assets/agent.css`、`assets/agent.js`，交互演示在 `widgets/` 和 `assets/demos/`；通用的东西改 notes-theme，不在这里覆盖主题样式。

## 加内容

- **加一章：**在对应的 `content/<页面>/` 里新建 `NN-名字.md`，文件名决定顺序。开头写 `id`、`title`、`imp`、`q`（本章回答的问题，如 `[q1, q2]`）、`done`，字段说明见 notes-theme 的 README；章号自动编。章节 `id` 一旦发布就不要改：它是链接锚点，也是读者阅读进度的键。
- **加一部分：**在 `notes.config.mjs` 的 `parts` 和 `pages` 里各加一项，并建 `content/<页面>/_part.md`。
- **首页：**`content/index/` 是普通页面（`plain: true`）：`00-hero.md` 是原样 HTML，其余每个文件一节。
- **加交互演示：**HTML 片段放 `widgets/名字.html`，正文里写 `::: widget 名字`；脚本放 `assets/demos/名字.js`（一个演示一个文件，页面里没有这个演示时什么也不做），加进 `notes.config.mjs` 的 `scripts`。书的脚本都在 shell.js 之前执行。全书公共的逻辑（章首问题标签、名词卡）才放 `assets/agent.js`。再在 `scripts/shots.config.mjs` 里写上它的操作步骤。
- **改了版式或演示：**改之前先拍基线，改完再拍一次对比：`npm run build` 后 `npm run shots -- shoot <名字>`，再 `npm run shots -- compare <基线> <名字>`，打开 `shots/compare-<基线>-<名字>/index.html` 逐张看。“新出现的问题”必须为空；“缺少的截图”说明章节 id 或演示的元素 id 变了。

## 截图脚本

- `scripts/shots.mjs` 截图并检查（控制台报错、404、外部请求、重复 id、站内链接和锚点），`scripts/shots.config.mjs` 是交互演示的操作清单。用法写在脚本开头。
- 第一次用先装浏览器：`npx playwright install chromium`（版本跟着 `package.json` 里锁定的 playwright）。
- 截图存在 `shots/`，不提交。基线只能和同一平台、同一浏览器版本拍的截图比；换了机器或升级了 playwright，先用改动前的提交重拍基线。
- 同一份产物重拍应当零差异。“细微差异”是 1–3 像素宽的线，多半是渲染抖动，但也要看一眼。

## 写作口径

- 先说结论，再说为什么。中文标点，中英文之间留空格。
- 趋势判断放进 `::: ahead`，每条标可信度：`[已有证据]` 有一手资料或多家产品实践，`[作者判断]` 根据迹象推测，`[有争议]` 业内有分歧。
- pi 源码的引用以 commit `cdaf6c2` 为准，放进默认折叠的 `::: ref`；示意代码在代码块标题栏写“示意”。
- 每个关键名词第一次出现时用 `::: term`，名词本身的信息（名称、状态、本质、所属问题）只在 `data/agent.mjs` 维护。
