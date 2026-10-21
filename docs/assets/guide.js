(function(){
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const store = {
    get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };

  /* ---------- 目录 + 进度（数据来自 book.js） ---------- */
  const B = window.BOOK;
  const PB = Object.fromEntries(B.problems.map(p => [p.id, p]));
  const TB = Object.fromEntries(B.terms.map(t => [t.id, t]));
  const onPage = id => !!document.getElementById(id);
  const chOf = id => B.chapters.find(x => x.id === id);
  const chHref = id => { const c = chOf(id); if (!c) return '#'; return onPage(id) ? '#' + id : B.parts[c.part].page + '#' + id; };
  let numSeq = 0;
  const NUM = {};
  B.chapters.forEach(c => { NUM[c.id] = c.n || String(++numSeq); });
  const chLabel = id => NUM[id] === '附' ? '附录' : '第 ' + NUM[id] + ' 章';
  const qHref = q => (document.getElementById('emap') ? '' : 'index.html') + '#' + q;

  const chapters = [...document.querySelectorAll('section.ch, section.home-sec')];
  const toc = $('#toc');
  const rail = document.querySelector('.rail');
  let done = store.get('harness-guide-done', {});
  const isHome = !!document.getElementById('learn');
  const IMP = { must:'核心', often:'重要', plus:'延伸', aux:'练习 / 参考' };

  /* 当前页每一节的小节（h3），编上锚点，供目录展开和滚动定位 */
  const lvOf = h => { const s = h.querySelector('.lv'); return !s ? '' : s.classList.contains('l1') ? 'l1' : s.classList.contains('l2') ? 'l2' : 'l3'; };
  const h3Text = h => { const c = h.cloneNode(true); c.querySelectorAll('.lv,.step').forEach(x => x.remove()); return c.textContent.trim(); };
  const subsOf = {};
  chapters.forEach(s => {
    if (s.id === 'map'){ subsOf.map = B.problems.map(p => ({ id: p.id, t: p.n + ' ' + p.name })); return; }
    subsOf[s.id] = [...s.querySelectorAll(':scope > h3')].map((h, i) => {
      if (!h.id) h.id = s.id + '-' + (i + 1);
      return { id: h.id, t: h3Text(h), lv: lvOf(h) };
    });
  });

  /* 目录：全书都列出来；正在读的那一章展开到小节 */
  function addEntry(id, href, num, title, imp){
    const li = el('li', 'entry'); const a = el('a'); a.href = href; a.dataset.id = id;
    const n = el('span', 'n'); if (num) n.appendChild(el('span', null, num)); a.appendChild(n);
    a.appendChild(el('span', 't', title));
    if (imp){ const dot = el('i', 'dot ' + imp); dot.title = IMP[imp]; a.appendChild(dot); }
    li.appendChild(a);
    const subs = onPage(id) ? subsOf[id] : null;
    if (subs && subs.length){
      const ol = el('ol', 'subs');
      subs.forEach(s => {
        const sli = el('li'); const sa = el('a', 'subsec'); sa.href = '#' + s.id; sa.dataset.sub = s.id;
        if (s.lv) sa.appendChild(el('i', 'lvdot ' + s.lv));
        sa.appendChild(el('span', 't', s.t));
        sli.appendChild(sa); ol.appendChild(sli);
      });
      li.appendChild(ol);
    }
    toc.appendChild(li);
  }
  toc.appendChild(el('li', 'part' + (isHome ? ' here' : ''), '导读'));
  addEntry('learn', (isHome ? '' : 'index.html') + '#learn', '', '怎么学');
  addEntry('map', (isHome ? '' : 'index.html') + '#map', '', '本质地图');
  let lastPart = null;
  B.chapters.forEach(c => {
    if (c.part !== lastPart){
      lastPart = c.part;
      toc.appendChild(el('li', 'part' + (onPage(c.id) ? ' here' : ''), B.parts[c.part].label));
    }
    addEntry(c.id, chHref(c.id), /^\d+$/.test(NUM[c.id]) ? NUM[c.id].padStart(2, '0') : NUM[c.id], c.t, c.imp);
  });

  function paintProgress(){
    let c = 0;
    B.chapters.forEach(ch => { if (done[ch.id]) c++; });
    document.querySelectorAll('a[data-id]').forEach(a => a.classList.toggle('done', !!done[a.dataset.id]));
    $('#meterText').textContent = '已掌握 ' + c + ' / ' + B.chapters.length + ' 章';
    $('#meterFill').style.width = (c / B.chapters.length * 100) + '%';
  }
  document.querySelectorAll('[data-done]').forEach(cb => {
    cb.checked = !!done[cb.dataset.done];
    cb.addEventListener('change', () => { done[cb.dataset.done] = cb.checked; store.set('harness-guide-done', done); paintProgress(); });
  });

  /* 滚动定位：高亮当前章和小节，并让它留在目录的可见范围里 */
  let curCh, curSub;
  function keepInView(){
    if (window.innerWidth <= 900){
      const c = toc.querySelector('a[data-id].on'); if (c) toc.scrollLeft += c.getBoundingClientRect().left - toc.getBoundingClientRect().left - 8; return;
    }
    const on = toc.querySelector('a.subsec.on') || toc.querySelector('a[data-id].on'); if (!on) return;
    const top = on.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop, bottom = top + on.offsetHeight;
    if (top < rail.scrollTop + 60 || bottom > rail.scrollTop + rail.clientHeight - 60)
      rail.scrollTo({ top: Math.max(0, top - rail.clientHeight * 0.4), behavior: 'smooth' });
  }
  function spy(){
    const line = window.innerHeight * 0.3;
    let ch = null;
    for (const s of chapters){ if (s.getBoundingClientRect().top <= line) ch = s; else break; }
    if (!ch && !isHome) ch = chapters[0] || null;
    let sub = null;
    if (ch) for (const s of (subsOf[ch.id] || [])){
      const h = document.getElementById(s.id);
      if (h && h.getBoundingClientRect().top <= line) sub = s.id;
    }
    const chId = ch ? ch.id : null;
    if (chId === curCh && sub === curSub) return;
    curCh = chId; curSub = sub;
    toc.querySelectorAll('a[data-id]').forEach(a => { const on = a.dataset.id === chId; a.classList.toggle('on', on); a.parentElement.classList.toggle('open', on); });
    toc.querySelectorAll('a.subsec').forEach(a => a.classList.toggle('on', a.dataset.sub === sub));
    keepInView(); fadeRail();
  }
  let ticking = false;
  window.addEventListener('scroll', () => { if (!ticking){ ticking = true; requestAnimationFrame(() => { ticking = false; spy(); }); } }, { passive: true });
  /* soft fade at the rail's edges only when there is more to scroll */
  function fadeRail(){
    const more = rail.scrollHeight - rail.clientHeight > 2 && window.innerWidth > 900;
    rail.classList.toggle('fade-t', more && rail.scrollTop > 2);
    rail.classList.toggle('fade-b', more && rail.scrollTop + rail.clientHeight < rail.scrollHeight - 2);
  }
  rail.addEventListener('scroll', fadeRail, { passive: true });
  window.addEventListener('resize', fadeRail);
  spy(); fadeRail();

  /* ---------- 章首：本章回答哪几个问题 ---------- */
  function qChip(q){
    const p = PB[q]; const a = el('a', 'qchip', p.n + ' ' + p.name); a.href = qHref(q); a.title = p.ask; return a;
  }
  chapters.filter(s => s.matches('section.ch')).forEach(s => {
    const c = chOf(s.id); const eb = s.querySelector('.eyebrow');
    if (!c || !c.q.length || !eb) return;
    const box = el('span', 'qs'); box.appendChild(el('span', 'qs-l', '回答'));
    c.q.forEach(q => box.appendChild(qChip(q)));
    eb.appendChild(box);
  });

  /* ---------- 名词卡：注入“本质”一行和所属问题 ---------- */
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

  /* ---------- 翻页 ---------- */
  const pager = $('#pager');
  if (pager){
    const pages = [['index.html','首页'],['part1.html','原理'],['part2.html','工程化'],['part3.html','综合']];
    const here = (document.querySelector('[data-page]') || {dataset:{}}).dataset.page + '.html';
    const i = pages.findIndex(p => p[0] === here);
    if (i > 0){ const a = el('a', 'prev'); a.href = pages[i-1][0]; a.appendChild(el('small', null, '上一部分')); a.appendChild(el('b', null, '← ' + pages[i-1][1])); pager.appendChild(a); }
    if (i >= 0 && i < pages.length - 1){ const a = el('a', 'next'); a.href = pages[i+1][0]; a.appendChild(el('small', null, '下一部分')); a.appendChild(el('b', null, pages[i+1][1] + ' →')); pager.appendChild(a); }
  }
  /* ---------- Q&A toggles ---------- */
  document.querySelectorAll('[data-toggle-qa]').forEach(btn => {
    btn.addEventListener('click', () => {
      const items = btn.closest('.qa-wrap').querySelectorAll('details.qa');
      const open = [...items].some(d => !d.open);
      items.forEach(d => d.open = open);
      btn.textContent = open ? '全部收起' : '全部展开';
    });
  });

  /* ---------- Quiz ---------- */
  const qs = [
  ];
  /* ---------- 首页：本质地图（按问题 / 按年份） ---------- */
  const mapBox = $('#emap');
  if (mapBox){
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

  /* ---------- 首页：全书目录 ---------- */
  const bt = $('#bookToc');
  if (bt){
    ['原理','工程','综合'].forEach(part => {
      const col = el('div', 'bt-col');
      const h = el('a', 'bt-h'); h.href = B.parts[part].page; h.appendChild(el('b', null, B.parts[part].label.split(' · ')[1])); col.appendChild(h);
      const ol = el('ol');
      B.chapters.filter(c => c.part === part || (part === '综合' && c.part === '附录')).forEach(c => {
        const li = el('li'); const a = el('a'); a.href = chHref(c.id); a.dataset.id = c.id;
        const n = el('span', 'n'); n.appendChild(el('span', null, (/^\d+$/.test(NUM[c.id]) ? NUM[c.id].padStart(2, '0') : NUM[c.id]))); a.appendChild(n);
        a.appendChild(el('span', 't', c.t)); a.appendChild(el('i', 'dot ' + c.imp));
        li.appendChild(a); ol.appendChild(li);
      });
      col.appendChild(ol); bt.appendChild(col);
    });
  }
  paintProgress();
  /* ---------- 各章末尾的自测 ---------- */
  chapters.filter(s => s.matches('section.ch')).forEach(s => {
    const mine = qs.filter(q => q.ch === s.id);
    if (!mine.length) return;
    const box = el('div', 'selftest');
    const head = el('div', 'qa-head');
    head.appendChild(el('span', null, '自测'));
    const score = el('span', 'score'); head.appendChild(score);
    box.appendChild(head);
    const list = el('div'); box.appendChild(list);
    const answered = {};
    function draw(){
      list.textContent = ''; let right = 0, n = 0;
      mine.forEach((q, i) => {
        const item = el('div', 'q');
        item.appendChild(el('div', 'qt', (mine.length > 1 ? (i + 1) + '. ' : '') + q.q));
        const opts = el('div', 'opts');
        q.o.forEach((o, j) => {
          const b = el('button', 'opt', o);
          if (answered[i] != null){ b.disabled = true; if (j === q.a) b.classList.add('right'); else if (j === answered[i]) b.classList.add('wrong'); }
          b.onclick = () => { answered[i] = j; draw(); };
          opts.appendChild(b);
        });
        item.appendChild(opts);
        if (answered[i] != null){ n++; if (answered[i] === q.a) right++; item.appendChild(el('div', 'why', (answered[i] === q.a ? '答对了。' : '再想想。') + q.w)); }
        list.appendChild(item);
      });
      score.textContent = n ? '答对 ' + right + ' / ' + mine.length : mine.length + ' 题';
    }
    draw();
    const anchor = s.querySelector(':scope > .understood');
    s.insertBefore(box, anchor || null);
  });
})();
