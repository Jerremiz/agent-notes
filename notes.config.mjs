/* 看懂 Agent · 书的配置。主题和生成器在 notes-theme，这里只放这本书自己的东西。 */
import data from './data/agent.mjs';

export default {
  title: '看懂 Agent',
  tagline: '词会过时，问题不会',
  repo: 'https://github.com/Jerremiz/agent-notes',
  storageKey: 'harness-guide-done',   // 阅读进度存在浏览器里的键名，改了读者的进度会清零
  out: 'docs',

  styles: ['assets/agent.css'],
  scripts: ['assets/agent.js', 'assets/demos/essence-map.js', 'assets/demos/agent-loop-sim.js', 'assets/demos/context-budget.js', 'assets/demos/prompt-builder.js', 'assets/demos/edit-match.js', 'assets/demos/session-tree.js', 'assets/demos/hook-sim.js'],   // 演示一个文件一个，页面里没有对应演示时不做事
  copy: {
    'assets': 'assets'
  },

  importance: { must: { label: '核心' }, often: { label: '重要' }, plus: { label: '延伸' }, aux: { label: '练习', title: '练习 / 参考' } },
  ref: { label: 'pi 的做法' },
  confidence: { sure: '现状', likely: '推测', open: '有争议' },   // 前瞻框里每条的可信度标签，正文写 [现状] 等
  terms: { list: data.terms, status: data.status },
  data: { problems: data.problems, layers: data.layers },

  home: { page: 'index', label: '导读', entries: [{ id: 'read', t: '怎么读' }, { id: 'learn', t: '怎么学' }, { id: 'map', t: '本质地图' }] },
  parts: {
    '原理': { label: '第一部分 · 原理', page: 'index' },
    '工程': { label: '第二部分 · 工程化', page: 'index' },
    '综合': { label: '第三部分 · 综合', page: 'index' },
    '附录': { label: '附录', page: 'index' }
  },
  /* 全书一页：几个内容目录按顺序拼进 index.html，读者用 Ctrl+F 就能搜全书 */
  pages: [
    { file: 'index', title: '首页', from: [
      { dir: 'index', plain: true },   // 普通内容：hero 和导读的版式写在 content/index/ 里
      { dir: 'principles', part: '原理' },
      { dir: 'engineering', part: '工程' },
      { dir: 'synthesis', part: '综合' }   // 附录那一章自己写 part: 附录
    ] }
  ],

  /* 页脚是 Markdown，空一行分段 */
  footer: `本手册以开源项目 [pi](https://github.com/earendil-works/pi) 为例，讲解 agent 的原理和工程做法。

pi 源码以 [v1.4.0](https://github.com/earendil-works/pi/releases/tag/v1.4.0) 为准；行业动态和趋势判断截至 2026 年 10 月。标注“示意”的代码只用来说明概念。

如有错漏，欢迎在 GitHub [提 issue](https://github.com/Jerremiz/agent-notes/issues) 或 [提交 PR](https://github.com/Jerremiz/agent-notes/pulls)，一起完善这本手册。`
};
