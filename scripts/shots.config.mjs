/* 截图脚本（scripts/shots.mjs）里本书专用的部分：每个交互演示怎么操作、截哪里。
   迁移时演示的元素 id 不变，同一份清单迁移前后都能用；id 改了，脚本会报“演示失败”。

   每个演示在刚打开的页面上从头执行：
     { click: 选择器, nth?: 第几个（从 0 起） }
     { set: 选择器, value: 值 }        给 range / text 输入框赋值，并触发 input、change
     { check: 选择器, on: true|false }  勾选或取消复选框
     { press: 选择器, key: 'Enter' }
   shoot：操作完截图的元素；它在某个 .panel 里时，截整个 .panel（演示框）。
   optional：这一步的元素可能不存在（例如按钮只有 3 个），不存在就跳过，不算失败。
   ifEnabled：按钮已禁用就跳过这一步。 */
export default {
  demos: {
    /* 全书一页，演示都在 index 上 */
    index: [
      { name: 'map-year', shoot: '#map', actions: [{ click: '#emapView .btn', nth: 1 }] },
      { name: 'map-filter', shoot: '#map', actions: [{ click: '#emapSt .btn', nth: 1 }] },
      /* 第一部分 */
      { name: 'sim-3', shoot: '#sim', actions: [{ click: '#simNext' }, { click: '#simNext' }, { click: '#simNext' }] },
      { name: 'sim-end', shoot: '#sim', actions: Array.from({ length: 40 }, () => ({ click: '#simNext', ifEnabled: true })) },
      { name: 'sim-reset', shoot: '#sim', actions: [{ click: '#simNext' }, { click: '#simNext' }, { click: '#simPrev' }, { click: '#simReset' }] },
      { name: 'budget-max', shoot: '#bBar', actions: [{ set: '#bTurns', value: '45' }, { check: '#bSkills', on: true }, { check: '#bCompact', on: false }] },
      { name: 'budget-compact', shoot: '#bBar', actions: [{ set: '#bTurns', value: '45' }, { check: '#bSkills', on: true }] },
      { name: 'prompt-all', shoot: '#pbOut', actions: ['#pbAgents', '#pbAppend', '#pbSkills', '#pbSearch', '#pbSystem'].map(s => ({ check: s, on: true })) },
      { name: 'prompt-none', shoot: '#pbOut', actions: ['#pbAgents', '#pbAppend', '#pbSkills', '#pbSearch', '#pbSystem'].map(s => ({ check: s, on: false })) },
      ...[0, 1, 2, 3, 4, 5].map(i => ({ name: 'edit-' + i, shoot: '#emOut', optional: i > 1, actions: [{ click: '#emCases .btn', nth: i }] })),
      /* 第二部分 */
      { name: 'tree-0', shoot: '#treeSvg', actions: [{ click: '#treeSvg .node', nth: 0 }] },
      { name: 'tree-3', shoot: '#treeSvg', actions: [{ click: '#treeSvg .node', nth: 3 }] },
      { name: 'tree-last', shoot: '#treeSvg', actions: [{ click: '#treeSvg .node', nth: -1 }] },
      ...[0, 1, 2, 3].map(i => ({ name: 'hook-' + i, shoot: '#hookOut', optional: i > 1, actions: [{ click: '#hookSamples .btn', nth: i }] })),
      { name: 'hook-typed', shoot: '#hookOut', actions: [{ set: '#hookCmd', value: 'rm -rf /' }, { press: '#hookCmd', key: 'Enter' }] }
    ]
  }
};
