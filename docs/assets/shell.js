/* notes-theme · 页面外壳：目录栏、阅读进度、滚动定位、翻页、问答展开、自测。
   数据来自构建生成的 window.BOOK；每本书自己的脚本在本文件之前加载，
   可以通过 window.NOTES.subs[sectionId] = () => [{id, t}] 自定义某一节在目录里的小节。 */
(function(){
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const store = {
    get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };
  const B = window.BOOK;
  /* 界面文字来自书的 labels 配置；{n} 之类是占位符 */
  const L = B.site.labels;
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
  const HOOKS = (window.NOTES = window.NOTES || {}); HOOKS.subs = HOOKS.subs || {};
  const page = (document.querySelector('[data-page]') || { dataset: {} }).dataset.page;
  const isHome = page === B.home.page;
  const onPage = id => !!document.getElementById(id);
  const chOf = id => B.chapters.find(x => x.id === id);
  const chHref = id => { const c = chOf(id); if (!c) return '#'; return onPage(id) ? '#' + id : c.page + '.html#' + id; };
  const homeHref = id => (isHome ? '' : B.home.page + '.html') + '#' + id;

  /* ---------- 目录 ---------- */
  const sections = [...document.querySelectorAll('section.ch, section.home-sec')];
  const toc = $('#toc');
  const rail = $('.rail');
  const done = store.get(B.site.storageKey, {});
  const IMP = Object.fromEntries(Object.entries(B.importance).map(([k, v]) => [k, v.title || v.label]));

  /* 当前页每一节的小节（直属的 h3），编上锚点，供目录展开和滚动定位 */
  const lvOf = h => { const s = h.querySelector('.lv'); return !s ? '' : s.classList.contains('l1') ? 'l1' : s.classList.contains('l2') ? 'l2' : 'l3'; };
  const h3Text = h => { const c = h.cloneNode(true); c.querySelectorAll('.lv,.step').forEach(x => x.remove()); return c.textContent.trim(); };
  const subsOf = {};
  sections.forEach(s => {
    if (HOOKS.subs[s.id]){ subsOf[s.id] = HOOKS.subs[s.id](); return; }
    subsOf[s.id] = [...s.querySelectorAll(':scope > h3')].map((h, i) => {
      if (!h.id) h.id = s.id + '-' + (i + 1);
      return { id: h.id, t: h3Text(h), lv: lvOf(h) };
    });
  });

  function addEntry(id, href, num, title, imp){
    const li = el('li', 'entry'); const a = el('a'); a.href = href; a.dataset.id = id;
    const n = el('span', 'n'); if (num) n.appendChild(el('span', null, num)); a.appendChild(n);
    a.appendChild(el('span', 't', title));
    if (imp){ const dot = el('i', 'dot ' + imp); dot.title = IMP[imp] || ''; a.appendChild(dot); }
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
  if (B.home.entries && B.home.entries.length){
    toc.appendChild(el('li', 'part' + (isHome ? ' here' : ''), B.home.label));
    B.home.entries.forEach(e => addEntry(e.id, homeHref(e.id), '', e.t));
  }
  let lastPart = null;
  B.chapters.forEach(c => {
    if (c.part !== lastPart){
      lastPart = c.part;
      toc.appendChild(el('li', 'part' + (onPage(c.id) ? ' here' : ''), B.parts[c.part].label));
    }
    addEntry(c.id, chHref(c.id), /^\d+$/.test(c.n) ? c.n.padStart(2, '0') : c.n, c.t, c.imp);
  });

  /* ---------- 进度 ---------- */
  function paintProgress(){
    let c = 0;
    B.chapters.forEach(ch => { if (done[ch.id]) c++; });
    document.querySelectorAll('a[data-id]').forEach(a => a.classList.toggle('done', !!done[a.dataset.id]));
    const t = $('#meterText'), f = $('#meterFill');
    if (t) t.textContent = fmt(L.progress, { done: c, total: B.chapters.length });
    if (f) f.style.width = (c / B.chapters.length * 100) + '%';
  }
  document.querySelectorAll('[data-done]').forEach(cb => {
    cb.checked = !!done[cb.dataset.done];
    cb.addEventListener('change', () => { done[cb.dataset.done] = cb.checked; store.set(B.site.storageKey, done); paintProgress(); });
  });

  /* ---------- 滚动定位：高亮当前章和小节，并让它留在目录的可见范围里 ---------- */
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
    for (const s of sections){ if (s.getBoundingClientRect().top <= line) ch = s; else break; }
    if (!ch && !isHome) ch = sections[0] || null;
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
  /* 目录还能滚动时，在边缘加一点渐隐 */
  function fadeRail(){
    const more = rail.scrollHeight - rail.clientHeight > 2 && window.innerWidth > 900;
    rail.classList.toggle('fade-t', more && rail.scrollTop > 2);
    rail.classList.toggle('fade-b', more && rail.scrollTop + rail.clientHeight < rail.scrollHeight - 2);
  }
  rail.addEventListener('scroll', fadeRail, { passive: true });
  window.addEventListener('resize', fadeRail);
  spy(); fadeRail();

  /* ---------- 翻页 ---------- */
  const pager = $('#pager');
  if (pager){
    const i = B.pages.findIndex(p => p.file === page);
    const link = (p, cls, small, text) => { const a = el('a', cls); a.href = p.file + '.html'; a.appendChild(el('small', null, small)); a.appendChild(el('b', null, text)); pager.appendChild(a); };
    if (i > 0) link(B.pages[i - 1], 'prev', L.prev, '← ' + B.pages[i - 1].title);
    if (i >= 0 && i < B.pages.length - 1) link(B.pages[i + 1], 'next', L.next, B.pages[i + 1].title + ' →');
  }

  /* ---------- 问答：全部展开 / 收起 ---------- */
  document.querySelectorAll('[data-toggle-qa]').forEach(btn => {
    btn.addEventListener('click', () => {
      const items = btn.closest('.qa-wrap').querySelectorAll('details.qa');
      const open = [...items].some(d => !d.open);
      items.forEach(d => d.open = open);
      btn.textContent = open ? L.collapseAll : L.expandAll;
    });
  });

  /* ---------- 自测：点选项判对错 ---------- */
  document.querySelectorAll('.selftest[data-quiz]').forEach(box => {
    const qs = [...box.querySelectorAll('.q')];
    const score = box.querySelector('.score');
    let n = 0, right = 0;
    qs.forEach(q => {
      const a = +q.dataset.a, why = q.querySelector('.why'), opts = [...q.querySelectorAll('.opt')];
      opts.forEach((b, j) => b.addEventListener('click', () => {
        opts.forEach((o, k) => { o.disabled = true; if (k === a) o.classList.add('right'); else if (k === j) o.classList.add('wrong'); });
        why.querySelector('.verdict').textContent = j === a ? L.right : L.wrong;
        why.hidden = false;
        n++; if (j === a) right++;
        score.textContent = fmt(L.quizScore, { right, total: qs.length });
      }, { once: true }));
    });
  });

  paintProgress();
})();
