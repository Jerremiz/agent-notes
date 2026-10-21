/* 看懂 Agent · 演示：上下文预算（widgets/context-budget.html）
   从 legacy/assets/guide.js 原样搬来，逻辑未改。页面里没有这个演示时什么也不做。 */
(function(){
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  if ($('#bBar')) {
    /* ---------- Context budget ---------- */
    const WIN = 200000, RESERVE = 16384, KEEP = 20000, SUMMARY = 3500, PER_TURN = 7000;
    const TH = WIN - RESERVE;
    const segs = [
      { k:'sys',  label:'system prompt', color:'var(--r-system)' },
      { k:'agents', label:'项目规则', color:'color-mix(in srgb,var(--r-system) 55%,var(--bg))' },
      { k:'tools', label:'工具定义', color:'var(--r-tool)' },
      { k:'skills', label:'skill', color:'color-mix(in srgb,var(--r-tool) 50%,var(--bg))' },
      { k:'sum', label:'压缩摘要', color:'var(--ok)' },
      { k:'hist', label:'对话历史', color:'var(--r-assistant)' }
    ];
    function budget(){
      const turns = +$('#bTurns').value, full = $('#bSkills').checked, comp = $('#bCompact').checked;
      $('#bTurnsV').textContent = turns;
      const fixed = { sys:900, agents:2000, tools:1600, skills: full ? 12 * 4200 : 12 * 70 };
      const fixedSum = fixed.sys + fixed.agents + fixed.tools + fixed.skills;
      let hist = 0, sum = 0, n = 0, overflowAt = 0, totalIn = 0;
      for (let t = 1; t <= turns; t++){
        hist += PER_TURN;
        if (comp && fixedSum + sum + hist > TH){ sum = SUMMARY; hist = KEEP; n++; }
        if (!comp && !overflowAt && fixedSum + hist > WIN) overflowAt = t;
        totalIn += Math.min(fixedSum + sum + hist, WIN);
      }
      const vals = Object.assign({}, fixed, { sum, hist });
      const total = Object.values(vals).reduce((a, b) => a + b, 0);
      const bar = $('#bBar'); bar.textContent = '';
      let used = 0;
      segs.forEach(s => { const w = Math.max(0, Math.min(vals[s.k] / WIN * 100, 100 - used)); used += w; const d = el('div'); d.style.width = w + '%'; d.style.background = s.color; d.title = s.label + ' ' + vals[s.k].toLocaleString(); bar.appendChild(d); });
      const th = el('div', 'th'); th.style.left = (TH / WIN * 100) + '%'; th.title = '压缩阈值'; bar.appendChild(th);
      const lg = $('#bLegend'); lg.textContent = '';
      segs.forEach(s => { if (!vals[s.k]) return; const sp = el('span'); const i = el('i'); i.style.background = s.color; sp.appendChild(i); sp.appendChild(document.createTextNode(s.label + ' ' + (vals[s.k] / 1000).toFixed(1) + 'k')); lg.appendChild(sp); });
      const st = $('#bStatus');
      const pct = Math.round(total / WIN * 100);
      const cum = '整个任务累计输入约 ' + (totalIn / 1e6).toFixed(2) + 'M token。';
      if (!comp && total > WIN){
        st.className = 'status bad';
        st.textContent = '共 ' + (total/1000).toFixed(0) + 'k token，超出 200k 窗口（第 ' + overflowAt + ' 个 turn 就超了），请求会被拒绝。';
      } else if (full && turns <= 2){
        st.className = 'status';
        st.textContent = '刚开局，skill 全文就占了 ' + (fixed.skills/1000).toFixed(0) + 'k token。每个 turn 都要为它们付费，哪怕一个都用不上。';
      } else if (n > 0){
        st.className = 'status ok';
        st.textContent = '已自动压缩 ' + n + ' 次，当前占用 ' + pct + '%。' + cum + '压缩通常会让历史部分的缓存复用率下降：摘要之后的内容一般要重新计算，system prompt、工具定义这些没变的开头仍可命中。';
      } else {
        st.className = 'status';
        st.textContent = '当前占用 ' + pct + '%。' + cum + '累计输入随轮数近似平方增长，这就是第 6 章 prompt caching 如此重要的原因。';
      }
    }
    ['#bTurns','#bSkills','#bCompact'].forEach(id => $(id).addEventListener('input', budget));
    budget();

  }
})();
