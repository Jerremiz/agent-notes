# 看懂 Agent · 写作和维护规则

## 结构

- 正文在 `content/<页面>/`，一章一个 Markdown 文件。组件写法见 notes-theme 的 README 和 styleguide。
- `docs/` 是生成结果，**不要手改**；改完内容运行 `npm run build`，连同 `docs/` 一起提交。
- 本地预览：`npm run dev`，打开 http://localhost:4000。
- 名词、七个问题、五层在 `data/agent.mjs`；书的配置在 `notes.config.mjs`。
- 本书专用的样式和交互在 `assets/agent.css`、`assets/agent.js`；通用的东西改 notes-theme，不在这里覆盖主题样式。

## 迁移期间

`legacy/` 里是还没转成 Markdown 的页面（只剩首页），构建时原样复制。迁移一页时：

1. 把它的章节拆成 `content/<页面>/NN-xxx.md`，章节信息写进各文件开头，并从 `notes.config.mjs` 的 `legacyChapters` 删掉这些章。
2. 页面里的交互演示和本书专用脚本从 `legacy/assets/guide.js` 搬到 `assets/agent.js` 或 `widgets/`。
3. 去掉 `pages` 里这一页的 `legacy: true`，删掉 `legacy/` 里的旧文件。
4. 对比迁移前后的截图（浅色、深色、手机宽度）：`npm run build` 后 `npm run shots -- shoot <名字>`，再 `npm run shots -- compare baseline <名字>`，打开 `shots/compare-baseline-<名字>/index.html` 逐张看。“新出现的问题”必须为空；“缺少的截图”说明章节 id 或演示的元素 id 变了。

## 截图脚本

- `scripts/shots.mjs` 截图并检查（控制台报错、404、外部请求、重复 id、站内链接和锚点），`scripts/shots.config.mjs` 是交互演示的操作清单。用法写在脚本开头。
- 第一次用先装浏览器：`npx playwright install chromium`（版本跟着 `package.json` 里锁定的 playwright）。
- 截图存在 `shots/`，不提交。基线只能和同一平台、同一浏览器版本拍的截图比；换了机器或升级了 playwright，先用迁移前的提交重拍基线。
- 同一份产物重拍应当零差异。“细微差异”是 1–3 像素宽的线，多半是渲染抖动，但也要看一眼。

## 写作口径

- 先说结论，再说为什么。中文标点，中英文之间留空格。
- 趋势判断放进 `::: ahead`，每条标可信度：`[已有证据]` 有一手资料或多家产品实践，`[作者判断]` 根据迹象推测，`[有争议]` 业内有分歧。
- pi 源码的引用以 commit `cdaf6c2` 为准，放进默认折叠的 `::: ref`；示意代码在代码块标题栏写“示意”。
- 每个关键名词第一次出现时用 `::: term`，名词本身的信息（名称、状态、本质、所属问题）只在 `data/agent.mjs` 维护。
