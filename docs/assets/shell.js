/* notes-theme · 页面外壳：目录栏（手机上是顶部细条 + 底部弹出的目录）、阅读进度、滚动定位、站内跳转、翻页、问答展开、自测。
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
  /* 链到别的页面：index 写成 ./（地址栏不带 index.html）；file:// 下目录不会自动打开 index.html，仍写全名 */
  const local = location.protocol === 'file:';
  const pageUrl = f => (f === 'index' || f === 'index.html') && !local ? './' : f.replace(/\.html$/, '') + '.html';
  const chHref = id => { const c = chOf(id); if (!c) return '#'; return onPage(id) ? '#' + id : pageUrl(c.page) + '#' + id; };
  const homeHref = id => (isHome ? '' : pageUrl(B.home.page)) + '#' + id;

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
  /* 部分的标题；正在读的那一部分高亮（.here），见滚动定位。首页那一组的 data-part 是空串 */
  const partLi = (part, label) => { const li = el('li', 'part', label); li.dataset.part = part; return li; };
  if (B.home.entries && B.home.entries.length){
    toc.appendChild(partLi('', B.home.label));
    B.home.entries.forEach(e => addEntry(e.id, homeHref(e.id), '', e.t));
  }
  let lastPart = null;
  B.chapters.forEach(c => {
    if (c.part !== lastPart){
      lastPart = c.part;
      toc.appendChild(partLi(c.part, B.parts[c.part].label));
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
  const mobile = matchMedia('(max-width: 900px)');
  function keepInView(){
    if (mobile.matches) return;   /* 手机上目录在弹层里，打开弹层时再定位（openSheet） */
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
    /* 当前部分：章节看 data-part；首页的节、或首页上还没滚到任何一节时，是首页那一组 */
    const part = ch && ch.classList.contains('ch') ? ch.dataset.part : (ch || isHome ? '' : null);
    toc.querySelectorAll('li.part').forEach(li => li.classList.toggle('here', li.dataset.part === part));
    if (chId === curCh && sub === curSub) return;
    curCh = chId; curSub = sub;
    paintBar(ch, part);
    toc.querySelectorAll('a[data-id]').forEach(a => { const on = a.dataset.id === chId; a.classList.toggle('on', on); a.parentElement.classList.toggle('open', on); });
    toc.querySelectorAll('a.subsec').forEach(a => a.classList.toggle('on', a.dataset.sub === sub));
    keepInView(); fadeRail();
  }
  let ticking = false;
  window.addEventListener('scroll', () => { if (!ticking){ ticking = true; requestAnimationFrame(() => { ticking = false; spy(); onBarScroll(); }); } }, { passive: true });
  /* 目录还能滚动时，在边缘加一点渐隐 */
  function fadeRail(){
    const more = rail.scrollHeight - rail.clientHeight > 2 && window.innerWidth > 900;
    rail.classList.toggle('fade-t', more && rail.scrollTop > 2);
    rail.classList.toggle('fade-b', more && rail.scrollTop + rail.clientHeight < rail.scrollHeight - 2);
  }
  rail.addEventListener('scroll', fadeRail, { passive: true });
  window.addEventListener('resize', fadeRail);

  /* ---------- 手机：顶部细条 ---------- */
  const mbar = $('#mbar');
  const barBtn = mbar && mbar.querySelector('.mbar-btn');
  /* 细条上显示当前位置：部分名 + 章号、章名；首页的节显示导读组名和节名；最顶上显示书名和副标题 */
  function paintBar(ch, part){
    if (!mbar) return;
    const small = $('#mbarPart'), big = $('#mbarTitle');
    big.textContent = '';
    if (ch && ch.classList.contains('ch')){
      const c = chOf(ch.id);
      small.textContent = B.parts[part] ? B.parts[part].label : '';
      if (c && c.n) big.appendChild(el('span', 'n', /^\d+$/.test(c.n) ? c.n.padStart(2, '0') : c.n));
      big.appendChild(document.createTextNode(c ? c.t : ch.dataset.t || ''));
    } else if (ch){
      const e = (B.home.entries || []).find(x => x.id === ch.id), h = ch.querySelector('h2');
      small.textContent = B.home.label;
      big.textContent = e ? e.t : h ? h.textContent : B.site.title;
    } else {
      small.textContent = B.site.tagline;
      big.textContent = B.site.title;
    }
  }
  /* 往下读时收起细条，往回滚或回到顶上时出现；底边是全书的阅读进度 */
  let lastY = window.scrollY;
  function onBarScroll(){
    if (!mbar) return;
    const y = window.scrollY, dy = y - lastY;
    if (!sheetOpen()){
      if (y < 80 || dy < -6) mbar.classList.remove('away');
      else if (dy > 6 && !mbar.contains(document.activeElement)) mbar.classList.add('away');
    }
    if (Math.abs(dy) > 6 || y < 80) lastY = y;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    $('#mbarFill').style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  }

  /* ---------- 手机：底部弹出的目录 ---------- */
  const scrim = $('.scrim'), closeBtn = rail.querySelector('.close');
  const sheetOpen = () => rail.classList.contains('open');
  const outside = () => [mbar, $('main')].filter(Boolean);
  function openSheet(){
    if (!mobile.matches || sheetOpen()) return;
    rail.classList.add('open'); scrim.classList.add('on');
    document.documentElement.classList.add('sheet-open');
    rail.setAttribute('role', 'dialog'); rail.setAttribute('aria-modal', 'true');
    barBtn.setAttribute('aria-expanded', 'true');
    outside().forEach(x => x.inert = true);
    /* 当前章（或小节）放在面板中间偏上 */
    const on = toc.querySelector('a.subsec.on') || toc.querySelector('a[data-id].on');
    if (on) rail.scrollTop = on.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop - rail.clientHeight * 0.35;
    (on || closeBtn).focus({ preventScroll: true });
  }
  /* back：关掉后焦点回到细条的按钮（用户点关闭、遮罩或按 Esc 时）；跳转时焦点去目标，不回按钮 */
  function closeSheet(back){
    if (!sheetOpen()) return;
    rail.classList.remove('open'); scrim.classList.remove('on');
    rail.style.transform = '';
    document.documentElement.classList.remove('sheet-open');
    rail.removeAttribute('role'); rail.removeAttribute('aria-modal');
    barBtn.setAttribute('aria-expanded', 'false');
    outside().forEach(x => x.inert = false);
    if (back) barBtn.focus({ preventScroll: true });
  }
  if (mbar){
    barBtn.addEventListener('click', openSheet);
    closeBtn.addEventListener('click', () => closeSheet(true));
    scrim.addEventListener('click', () => closeSheet(true));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()){ e.preventDefault(); closeSheet(true); } });
    mobile.addEventListener('change', () => { closeSheet(false); mbar.classList.remove('away'); });
    /* 面板滚到顶时往下拖：跟手移动，拖过 90px 或甩得快就关掉 */
    let drag = null;
    rail.addEventListener('touchstart', e => { drag = rail.scrollTop <= 0 ? { y: e.touches[0].clientY, t: performance.now(), dy: 0 } : null; }, { passive: true });
    rail.addEventListener('touchmove', e => {
      if (!drag) return;
      drag.dy = e.touches[0].clientY - drag.y;
      if (drag.dy <= 0){ rail.classList.remove('drag'); rail.style.transform = ''; return; }
      if (e.cancelable) e.preventDefault();
      rail.classList.add('drag'); rail.style.transform = `translateY(${drag.dy}px)`;
    }, { passive: false });
    rail.addEventListener('touchend', () => {
      if (!drag) return;
      const fast = drag.dy / (performance.now() - drag.t) > 0.5;
      rail.classList.remove('drag'); rail.style.transform = '';
      if (drag.dy > 90 || (drag.dy > 30 && fast)) closeSheet(true);
      drag = null;
    });
  }

  /* ---------- 站内跳转：平滑滚动，每一帧重新量目标位置 ----------
     屏幕外的章还没排版（content-visibility），浏览器自带的平滑滚动按估计高度算终点，途中各章排版后就停错位置。
     这里接管本页锚点的点击：远的先瞬移到离目标一屏半的地方，再用 420ms 缓动滚完最后一段；每一帧都按目标当前的位置算，
     停下后再校正几帧。用户一滚轮、触摸或按键就停下，不和用户抢。系统设置了减少动态效果时直接跳。 */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let jumpRun = 0;
  const offsetOf = t => t.getBoundingClientRect().top - (parseFloat(getComputedStyle(t).scrollMarginTop) || 0);
  const scrollNow = top => window.scrollTo({ top, behavior: 'instant' });
  function settle(t, run, n = 0){
    if (run !== jumpRun) return;
    const d = offsetOf(t);
    if (Math.abs(d) > 1) scrollNow(window.scrollY + d);
    if (n < 12) requestAnimationFrame(() => settle(t, run, n + 1));
  }
  function jumpTo(t){
    const run = ++jumpRun;
    if (reduceMotion.matches){ scrollNow(window.scrollY + offsetOf(t)); settle(t, run); return; }
    const near = window.innerHeight * 1.5, d = offsetOf(t);
    if (Math.abs(d) > near) scrollNow(window.scrollY + d - Math.sign(d) * near);
    const y0 = window.scrollY, t0 = performance.now(), dur = 420;
    const ease = x => 1 - Math.pow(1 - x, 3);
    (function step(now){
      if (run !== jumpRun) return;
      const k = Math.min(1, Math.max(0, (now - t0) / dur));
      const end = window.scrollY + offsetOf(t);
      scrollNow(y0 + (end - y0) * ease(k));
      if (k < 1) requestAnimationFrame(step); else settle(t, run);
    })(t0);
  }
  /* mousedown：拖滚动条也算用户接手（点链接时 click 会在 mousedown 之后重新开始跳转） */
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => window.addEventListener(type, () => { jumpRun++; }, { passive: true }));
  const samePage = u => u.origin === location.origin && u.search === location.search &&
    u.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, '');
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href);
    if (!u.hash || !samePage(u)) return;
    const t = document.getElementById(decodeURIComponent(u.hash.slice(1)));
    if (!t) return;
    e.preventDefault();
    closeSheet(false);
    if (location.hash !== u.hash) history.pushState(null, '', u.hash);
    jumpTo(t);
    /* 焦点移到目标：键盘和读屏用户从这里接着读 */
    if (!t.matches('a,button,input,select,textarea,summary,[tabindex]')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });

  /* 书名：本地打开时补上 index.html；已经在首页时不重新加载，平滑回到页首，地址里去掉 #锚点和 index.html */
  const brand = $('.rail .brand');
  if (brand){
    if (local && /^\.\/?$/.test(brand.getAttribute('href'))) brand.setAttribute('href', 'index.html');
    if (isHome) brand.addEventListener('click', e => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      closeSheet(false);
      const clean = (local ? location.pathname : location.pathname.replace(/index\.html$/, '')) + location.search;
      if (location.hash || clean !== location.pathname + location.search) history.pushState(null, '', clean);
      jumpTo(document.documentElement);   /* 页首：<html> 的 top 就是 -scrollY */
    });
  }

  spy(); fadeRail(); onBarScroll();

  /* ---------- 翻页 ---------- */
  const pager = $('#pager');
  if (pager){
    const i = B.pages.findIndex(p => p.file === page);
    const link = (p, cls, small, text) => { const a = el('a', cls); a.href = pageUrl(p.file); a.appendChild(el('small', null, small)); a.appendChild(el('b', null, text)); pager.appendChild(a); };
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
