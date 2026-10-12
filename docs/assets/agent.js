/* 看懂 Agent · 本书专用脚本（在 notes-theme 的 shell.js 之前加载）
   通用的目录、进度、翻页、问答、自测都在 shell.js；这里只做和“七个问题”有关的事。
   迁移期间：模拟器、本质地图等还在 legacy/assets/guide.js 里，迁移对应页面时搬过来。 */
(function(){
  const B = window.BOOK;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const PB = Object.fromEntries(B.problems.map(p => [p.id, p]));
  const TB = Object.fromEntries(B.terms.map(t => [t.id, t]));
  const qHref = q => (document.getElementById('emap') ? '' : B.home.page + '.html') + '#' + q;
  function qChip(q){
    const p = PB[q]; const a = el('a', 'qchip', p.n + ' ' + p.name); a.href = qHref(q); a.title = p.ask; return a;
  }

  /* 章首：本章回答哪几个问题 */
  document.querySelectorAll('section.ch').forEach(s => {
    const c = B.chapters.find(x => x.id === s.id); const eb = s.querySelector('.eyebrow');
    if (!c || !c.q.length || !eb) return;
    const box = el('span', 'qs'); box.appendChild(el('span', 'qs-l', '回答'));
    c.q.forEach(q => box.appendChild(qChip(q)));
    eb.appendChild(box);
  });

  /* 名词卡：注入“本质”一行、所属问题和方案所在层 */
  document.querySelectorAll('details.term[data-term]').forEach(d => {
    const t = TB[d.dataset.term]; if (!t) return;
    const chip = qChip(t.q); chip.addEventListener('click', e => e.stopPropagation());
    const sm = d.querySelector('summary'), st = sm.querySelector('.st'); if (st) st.after(chip); else sm.appendChild(chip);
    const tb = d.querySelector('.tb');
    const ess = el('p', 'ess'); ess.appendChild(el('b', null, '本质'));
    ess.appendChild(document.createTextNode(t.ess));
    if (t.layer) ess.appendChild(el('span', 'layer-tag', '方案在：' + B.layers[t.layer]));
    tb.insertBefore(ess, tb.firstChild);
  });
})();
