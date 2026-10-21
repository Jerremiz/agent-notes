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
  terms: { list: data.terms, status: data.status },
  data: { problems: data.problems, layers: data.layers },

  home: { page: 'index', label: '导读', entries: [{ id: 'learn', t: '怎么学' }, { id: 'map', t: '本质地图' }] },
  parts: {
    '原理': { label: '第一部分 · 原理', page: 'part1' },
    '工程': { label: '第二部分 · 工程化', page: 'part2' },
    '综合': { label: '第三部分 · 综合', page: 'part3' },
    '附录': { label: '附录', page: 'part3' }
  },
  /* 页面顺序就是翻页顺序。legacy: true 的页面还是手写 HTML，放在 legacy/ 里 */
  pages: [
    { file: 'index', title: '首页', plain: true },   // 普通页面：hero 和导读的版式写在 content/index/ 里
    { file: 'part1', title: '原理', part: '原理' },
    { file: 'part2', title: '工程化', part: '工程' },
    { file: 'part3', title: '综合', part: '综合' }
  ],

  /* 迁移期间：旧页面里各章的目录信息。某一页转成 Markdown 后，把它的章节从这里删掉（信息改写在各章文件开头） */
  legacyChapters: [
  ],

  footer: '本手册以开源项目 [pi](https://github.com/earendil-works/pi) 为例讲解 agent 的原理和工程做法。文中的 pi 源码以 commit [cdaf6c2](https://github.com/earendil-works/pi/tree/cdaf6c227d4718a72b59ccd02152c9614df44cfc)（2026-10-11）为准，之后的版本可能有出入；行业动态和趋势判断同样截至 2026 年 10 月。标注“示意”的代码只用来说明概念。如有错漏，欢迎在 [GitHub 提 issue](https://github.com/Jerremiz/agent-notes/issues) 或直接[提交 PR](https://github.com/Jerremiz/agent-notes/pulls)，一起完善这本手册。'
};
