/* 看懂 Agent · 书的配置。主题和生成器在 notes-theme，这里只放这本书自己的东西。 */
import data from './data/agent.mjs';

export default {
  title: '看懂 Agent',
  tagline: '词会过时，问题不会',
  repo: 'https://github.com/Jerremiz/agent-notes',
  storageKey: 'harness-guide-done',   // 阅读进度存在浏览器里的键名，改了读者的进度会清零
  out: 'docs',

  styles: ['assets/agent.css'],
  scripts: ['assets/agent.js'],
  copy: {
    'assets': 'assets',
    'legacy': ''          // 迁移期间：还没转成 Markdown 的页面原样复制。全部迁移完删掉这一行和 legacy/ 目录
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
    { file: 'index', title: '首页', legacy: true },
    { file: 'part1', title: '原理', part: '原理', legacy: true },
    { file: 'part2', title: '工程化', part: '工程', legacy: true },
    { file: 'part3', title: '综合', part: '综合' }
  ],

  /* 迁移期间：旧页面里各章的目录信息。某一页转成 Markdown 后，把它的章节从这里删掉（信息改写在各章文件开头） */
  legacyChapters: [
    { id: 'c1',  t: 'Agent 与 Harness',        part: '原理', imp: 'must',  q: ['q0', 'q5'] },
    { id: 'c2',  t: '模型从哪来',              part: '原理', imp: 'must',  q: ['q1', 'q6'] },
    { id: 'c3',  t: 'LLM 调用与工具调用',      part: '原理', imp: 'must',  q: ['q1'] },
    { id: 'c4',  t: 'Agent Loop',              part: '原理', imp: 'must',  q: ['q1'] },
    { id: 'c5',  t: '上下文工程',              part: '原理', imp: 'must',  q: ['q2'] },
    { id: 'c6',  t: 'Prompt Caching',          part: '原理', imp: 'often', q: ['q2'] },
    { id: 'c7',  t: '工具设计与实现',          part: '原理', imp: 'often', q: ['q1'] },
    { id: 'c8',  t: '记忆与检索',              part: '原理', imp: 'often', q: ['q2', 'q3'] },
    { id: 'c9',  t: '规划、多 Agent 与长任务', part: '原理', imp: 'often', q: ['q5', 'q3', 'q6'] },
    { id: 'c10', t: '状态与持久化',            part: '工程', imp: 'often', q: ['q3'] },
    { id: 'c11', t: '事件流与集成',            part: '工程', imp: 'plus',  q: ['q4'] },
    { id: 'c12', t: '扩展机制与钩子',          part: '工程', imp: 'plus',  q: ['q7', 'q4'] },
    { id: 'c13', t: '安全与权限',              part: '工程', imp: 'often', q: ['q7'] },
    { id: 'c14', t: '可靠性',                  part: '工程', imp: 'often', q: ['q7'] },
    { id: 'c15', t: '测试与评测',              part: '工程', imp: 'often', q: ['q6'] },
    { id: 'c16', t: 'MCP 与工具生态',          part: '工程', imp: 'plus',  q: ['q4', 'q2'] }
  ],

  footer: '本手册以开源项目 [pi](https://github.com/earendil-works/pi) 为例讲解 agent 的原理和工程做法。文中的 pi 源码以 commit [cdaf6c2](https://github.com/earendil-works/pi/tree/cdaf6c227d4718a72b59ccd02152c9614df44cfc)（2026-10-11）为准，之后的版本可能有出入；行业动态和趋势判断同样截至 2026 年 10 月。标注“示意”的代码只用来说明概念。如有错漏，欢迎在 [GitHub 提 issue](https://github.com/Jerremiz/agent-notes/issues) 或直接[提交 PR](https://github.com/Jerremiz/agent-notes/pulls)，一起完善这本手册。'
};
