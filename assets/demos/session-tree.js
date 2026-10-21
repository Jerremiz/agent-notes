/* 看懂 Agent · 演示：会话树（widgets/session-tree.html）
   从 legacy/assets/guide.js 原样搬来，逻辑未改。页面里没有这个演示时什么也不做。 */
(function(){
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  if ($('#treeSvg')) {
    /* ---------- Session tree ---------- */
    const NS = 'http://www.w3.org/2000/svg';
    const nodes = [
      { id:'a1f0c2d4', p:null,       role:'user',      x:50,  y:60,  t:'实现登录接口' },
      { id:'b7c29e01', p:'a1f0c2d4', role:'assistant', x:150, y:60,  t:'建 Controller' },
      { id:'c3d97a55', p:'b7c29e01', role:'user',      x:250, y:60,  t:'用 JWT' },
      { id:'d05e1b8c', p:'c3d97a55', role:'assistant', x:350, y:60,  t:'加 JwtFilter' },
      { id:'e8a4f6d2', p:'d05e1b8c', role:'user',      x:450, y:60,  t:'加刷新 token' },
      { id:'f2b13c90', p:'e8a4f6d2', role:'assistant', x:550, y:60,  t:'完成' },
      { id:'g6c7d1e3', p:'b7c29e01', role:'user',      x:250, y:150, t:'改用 Session' },
      { id:'h9d35f27', p:'g6c7d1e3', role:'assistant', x:350, y:150, t:'接 Redis' },
      { id:'i4e8a0b6', p:'h9d35f27', role:'user',      x:450, y:150, t:'写集成测试' },
      { id:'j1f5c7e9', p:'i4e8a0b6', role:'assistant', x:550, y:150, t:'测试通过' }
    ];
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    let leaf = 'f2b13c90';
    const svg = $('#treeSvg');
    function pathOf(id){ const out = []; let n = byId[id]; while (n){ out.unshift(n.id); n = byId[n.p]; } return out; }
    function svgEl(tag, attrs){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
    function drawTree(){
      svg.textContent = '';
      const act = new Set(pathOf(leaf));
      nodes.forEach(n => { if (!n.p) return; const p = byId[n.p];
        const d = p.y === n.y ? `M${p.x},${p.y} L${n.x},${n.y}` : `M${p.x},${p.y} C${p.x+40},${p.y} ${n.x-50},${n.y} ${n.x},${n.y}`;
        svg.appendChild(svgEl('path', { d, fill:'none', stroke: act.has(n.id) ? 'var(--accent)' : 'var(--line)', 'stroke-width': act.has(n.id) ? 3 : 2 }));
      });
      nodes.forEach(n => {
        const g = svgEl('g', { class:'node', tabindex:'0', role:'button', 'aria-label': n.role + '：' + n.t });
        const col = n.role === 'user' ? 'var(--r-user)' : 'var(--r-assistant)';
        g.appendChild(svgEl('circle', { cx:n.x, cy:n.y, r: n.id === leaf ? 11 : 9, stroke:col, fill: act.has(n.id) ? col : 'var(--surface)' }));
        const tx = svgEl('text', { x:n.x, y:n.y + 28, 'text-anchor':'middle', fill: act.has(n.id) ? 'var(--ink)' : 'var(--muted)' }); tx.textContent = n.t;
        const lb = svgEl('text', { x:n.x, y:n.y - 16, 'text-anchor':'middle', fill:'var(--muted)', style:'font-family:var(--f-mono);font-size:9px' }); lb.textContent = n.id.slice(0, 4);
        g.appendChild(tx); g.appendChild(lb);
        const pick = () => { leaf = n.id; drawTree(); };
        g.addEventListener('click', pick);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); pick(); } });
        svg.appendChild(g);
      });
      const jl = $('#treeJsonl'); jl.textContent = '';
      nodes.forEach(n => { jl.appendChild(el('div', act.has(n.id) ? 'act' : '', JSON.stringify({ type:'message', id:n.id, parentId:n.p, message:{ role:n.role, content:n.t } }))); });
      $('#treeInfo').textContent = '当前叶子 ' + leaf.slice(0, 4) + '，发给模型 ' + act.size + ' 条';
    }
    drawTree();

  }
})();
