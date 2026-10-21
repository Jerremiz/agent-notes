/* 看懂 Agent · 演示：本质地图（widgets/essence-map.html，首页）
   从 legacy/assets/guide.js 原样搬来，逻辑未改；顶部的辅助函数也是从 guide.js 原样复制的（agent.js 里的 qChip 在它自己的作用域里）。
   页面里没有地图时什么也不做。必须在 shell.js 之前执行：地图生成的 #q1…#q7 是目录栏和问题标签的跳转目标。 */
(function(){
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const B = window.BOOK;
  const PB = Object.fromEntries(B.problems.map(p => [p.id, p]));
  const onPage = id => !!document.getElementById(id);
  const chOf = id => B.chapters.find(x => x.id === id);
  const chHref = id => { const c = chOf(id); if (!c) return '#'; return onPage(id) ? '#' + id : B.parts[c.part].page + '#' + id; };
  let numSeq = 0;
  const NUM = {};
  B.chapters.forEach(c => { NUM[c.id] = c.n || String(++numSeq); });
  const chLabel = id => NUM[id] === '附' ? '附录' : '第 ' + NUM[id] + ' 章';
  const qHref = q => (document.getElementById('emap') ? '' : 'index.html') + '#' + q;
  function qChip(q){
    const p = PB[q]; const a = el('a', 'qchip', p.n + ' ' + p.name); a.href = qHref(q); a.title = p.ask; return a;
  }
  /* ---------- 首页：本质地图（按问题 / 按年份） ---------- */
  const mapBox = $('#emap');
  if (mapBox){
    /* 目录栏里“本质地图”下面列出各个问题（旧 guide.js 里写死在目录代码中，这里改用 shell.js 的 NOTES.subs 扩展点） */
    const N = (window.NOTES = window.NOTES || {}); N.subs = N.subs || {};
    N.subs.map = () => B.problems.map(p => ({ id: p.id, t: p.n + ' ' + p.name }));
    let view = 'q', fst = 'all';
    const vbar = $('#emapView'), sbar = $('#emapSt');
    function bar(box, items, get, set){
      items.forEach(([k, v]) => {
        const b = el('button', 'btn' + (k === get() ? ' sel' : ''), v);
        b.onclick = () => { set(k); box.querySelectorAll('.btn').forEach(x => x.classList.toggle('sel', x === b)); drawMap(); };
        box.appendChild(b);
      });
    }
    bar(vbar, [['q','按问题'],['y','按年份']], () => view, k => view = k);
    bar(sbar, [['all','全部']].concat(Object.entries(B.status)), () => fst, k => fst = k);
    function item(t, line){
      const it = el('div', 'ti');
      const head = el('div'); head.appendChild(el('b', null, t.name)); head.appendChild(document.createTextNode(' '));
      head.appendChild(el('span', 'st ' + t.st, B.status[t.st]));
      if (view === 'y'){ head.appendChild(document.createTextNode(' ')); head.appendChild(qChip(t.q)); }
      else if (t.layer){ head.appendChild(document.createTextNode(' ')); head.appendChild(el('span', 'layer-tag', B.layers[t.layer])); }
      it.appendChild(head);
      const a = el('a', null, (view === 'q' ? t.y + ' · ' : '') + chLabel(t.ch)); a.href = chHref(t.ch); it.appendChild(a);
      it.appendChild(el('span', 'now', line));
      return it;
    }
    function drawMap(){
      mapBox.textContent = '';
      const rows = B.terms.filter(t => fst === 'all' || t.st === fst);
      if (view === 'q'){
        B.problems.forEach(p => {
          const ts = rows.filter(t => t.q === p.id).sort((a, b) => a.y.localeCompare(b.y));
          const box = el('div', 'qrow'); box.id = p.id;
          const h = el('div', 'qh'); h.appendChild(el('span', 'qn', p.n)); h.appendChild(el('h3', null, p.name)); h.appendChild(el('span', 'qask', p.ask));
          box.appendChild(h);
          const meta = el('dl', 'qmeta');
          [['来自', p.from], ['区分只看', p.look]].forEach(([k, v]) => { const d = el('div'); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', null, v)); meta.appendChild(d); });
          const chs = B.chapters.filter(c => c.q.includes(p.id));
          if (chs.length){
            const d = el('div'); d.appendChild(el('dt', null, '主要在')); const dd = el('dd');
            chs.forEach((c, i) => { if (i) dd.appendChild(document.createTextNode('、')); const a = el('a', null, chLabel(c.id)); a.href = chHref(c.id); dd.appendChild(a); });
            d.appendChild(dd); meta.appendChild(d);
          }
          box.appendChild(meta);
          const items = el('div', 'items');
          if (!ts.length) items.appendChild(el('div', 'small', '这个状态下没有词。'));
          ts.forEach(t => items.appendChild(item(t, t.ess)));
          box.appendChild(items);
          mapBox.appendChild(box);
        });
      } else {
        const ys = [...new Set(rows.map(t => t.y))].sort();
        ys.forEach(y => {
          const yr = el('div', 'yr'); yr.appendChild(el('time', null, y));
          const items = el('div', 'items');
          rows.filter(t => t.y === y).forEach(t => items.appendChild(item(t, t.now)));
          yr.appendChild(items); mapBox.appendChild(yr);
        });
      }
    }
    drawMap();
    if (/^#q\d$/.test(location.hash)){ const tgt = document.getElementById(location.hash.slice(1)); if (tgt) tgt.scrollIntoView(); }
  }
})();
