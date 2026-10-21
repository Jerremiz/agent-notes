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

  if ($('#simCode')) {
    /* ---------- Agent loop simulator ---------- */
    const codeLines = [
      'messages.add(user(input));',
      'while (true) {',
      '  var reply = llm.complete(system, messages, tools);',
      '  messages.add(reply);',
      '  if (reply.toolCalls().isEmpty()) return reply.text();',
      '  for (var call : reply.toolCalls()) {',
      '    var out = tools.get(call.name()).execute(call.args());',
      '    messages.add(toolResult(call.id(), out));',
      '  }',
      '}'
    ];
    const codeEl = $('#simCode');
    codeLines.forEach((l, i) => { const s = el('span', 'ln', l); s.dataset.i = i; codeEl.appendChild(s); });
    const P = 'src/main/java/com/acme/user/UserService.java';
    const STREAM = ['message_start', 'message_update ×n', 'message_end'];
    const steps = [
      { line:0, ev:['agent_start','turn_start','message_start','message_end'], add:{role:'user', text:'UserServiceTest 挂了，帮我修一下'},
        note:'用户消息追加进 messages，发出 agent_start 和 turn_start。' },
      { line:2, ev:STREAM.slice(0,2), call:true,
        note:'第 1 个 turn：system prompt + 全部 messages + 工具定义打包成一次请求，模型开始流式返回。' },
      { line:3, ev:['message_end'], add:{role:'assistant', text:'我先跑一下这个测试看报错。', calls:[['bash', '{"command":"mvn -q test -Dtest=UserServiceTest"}']]},
        note:'回复里是一个工具调用请求（stopReason = toolUse），照样存进历史。' },
      { line:4, ev:[], note:'toolCalls 不为空，不返回，进入 for 循环。' },
      { line:6, ev:['tool_execution_start'], tool:true,
        note:'harness 执行命令。要点：执行前已完成 schema 校验和 beforeToolCall 钩子。' },
      { line:7, ev:['tool_execution_end','message_start','message_end','turn_end'], add:{role:'toolResult', text:'Tests run: 6, Failures: 1\njava.lang.NullPointerException\n  at UserService.normalize(UserService.java:42)'},
        note:'输出包装成 toolResult，用 toolCallId 对应。bash 输出若超限，会保留尾部（错误信息都在最后）。' },
      { line:2, ev:['turn_start'].concat(STREAM.slice(0,2)), call:true, turn:true,
        note:'第 2 个 turn：整个 messages 再发一遍。前缀没变，所以能命中 prompt cache。' },
      { line:3, ev:['message_end'], add:{role:'assistant', text:'第 42 行有 NPE，看看代码。', calls:[['read', '{"path":"'+P+'","offset":36,"limit":12}']]},
        note:'模型只读第 36～47 行。分段读是控制上下文的手段之一。' },
      { line:7, ev:['tool_execution_start','tool_execution_end','message_end','turn_end'], tool:true, add:{role:'toolResult', text:'41  String normalize(User user) {\n42    return user.getEmail().toLowerCase();\n43  }'},
        note:'read 返回代码片段，第 2 个 turn 结束。' },
      { line:3, ev:['turn_start'].concat(STREAM), call:true, turn:true, add:{role:'assistant', text:'email 可能为 null，改成空安全写法。', calls:[['edit', '{"path":"'+P+'",\n "edits":[{"oldText":"user.getEmail().toLowerCase()",\n   "newText":"Optional.ofNullable(user.getEmail())\\n    .map(String::toLowerCase).orElse(\\"\\")"}]}']]},
        note:'第 3 个 turn：edit 用“旧文本 → 新文本”替换，oldText 必须唯一（第 7 章）。' },
      { line:7, ev:['tool_execution_start','tool_execution_end','message_end','turn_end'], tool:true, add:{role:'toolResult', text:'Successfully replaced 1 block in UserService.java'},
        note:'修改完成，但模型还不知道改得对不对。' },
      { line:3, ev:['turn_start'].concat(STREAM), call:true, turn:true, add:{role:'assistant', text:'再跑一次测试确认。', calls:[['bash', '{"command":"mvn -q test -Dtest=UserServiceTest"}']]},
        note:'第 4 个 turn：自我验证，提升成功率最有效的手段之一。' },
      { line:7, ev:['tool_execution_start','tool_execution_end','message_end','turn_end'], tool:true, add:{role:'toolResult', text:'Tests run: 6, Failures: 0'},
        note:'测试通过。' },
      { line:3, ev:['turn_start'].concat(STREAM), call:true, turn:true, add:{role:'assistant', text:'修好了。第 42 行在 email 为 null 时会抛 NPE，已改为用 Optional 处理，6 个测试全部通过。'},
        note:'第 5 个 turn：只有文字，没有工具调用（stopReason = stop）。' },
      { line:4, ev:['turn_end','agent_end','agent_settled'], end:true,
        note:'toolCalls 为空 → return。一条用户消息触发了 5 次模型调用、4 次工具执行。' }
    ];
    let cur = 0, timer = null;
    const list = $('#simList');
    function tok(msgs){ let c = 2600; msgs.forEach(m => { c += Math.round((m.text.length + (m.calls ? m.calls.reduce((a,x)=>a+x[1].length,0) : 0)) * 0.9) + 12; }); return c; }
    function renderSim(){
      let msgs = [], turns = 0, calls = 0, tools = 0;
      for (let i = 0; i < cur; i++){ const s = steps[i]; if (s.add) msgs.push(s.add); if (i === 0 || s.turn) turns++; if (s.call) calls++; if (s.tool) tools++; }
      const s = cur > 0 ? steps[cur - 1] : null;
      codeEl.querySelectorAll('.ln').forEach(l => l.classList.toggle('hl', !!s && +l.dataset.i === s.line));
      $('#simNote').textContent = s ? s.note : '点击“下一步”开始。左边是循环代码，右边是 harness 维护的 messages 列表。';
      const evBox = $('#simEvents'); evBox.textContent = '';
      if (s) s.ev.forEach(e => evBox.appendChild(el('span', 'ev', e)));
      list.textContent = '';
      if (!msgs.length) list.appendChild(el('div', 'note', '（空）'));
      msgs.forEach(m => {
        const box = el('div', 'msg' + (s && s.add === m ? ' fresh' : ''));
        box.appendChild(el('span', 'role ' + m.role, m.role));
        box.appendChild(el('div', 'body', m.text));
        (m.calls || []).forEach(c => box.appendChild(el('div', 'call', 'toolCall → ' + c[0] + ' ' + c[1])));
        list.appendChild(box);
      });
      if (list.querySelector('.fresh')) list.scrollTop = list.scrollHeight;
      $('#simCount').textContent = msgs.length + ' 条';
      $('#simStep').textContent = '第 ' + cur + ' / ' + steps.length + ' 步';
      $('#stTurn').textContent = turns; $('#stCalls').textContent = calls; $('#stTools').textContent = tools;
      $('#stTok').textContent = tok(msgs).toLocaleString();
      $('#simPrev').disabled = cur === 0; $('#simNext').disabled = cur === steps.length;
    }
    function stop(){ if (timer){ clearInterval(timer); timer = null; $('#simPlay').textContent = '自动播放'; } }
    $('#simNext').onclick = () => { stop(); if (cur < steps.length){ cur++; renderSim(); } };
    $('#simPrev').onclick = () => { stop(); if (cur > 0){ cur--; renderSim(); } };
    $('#simReset').onclick = () => { stop(); cur = 0; renderSim(); };
    $('#simPlay').onclick = () => {
      if (timer){ stop(); return; }
      if (cur === steps.length) cur = 0;
      $('#simPlay').textContent = '暂停';
      timer = setInterval(() => { if (cur >= steps.length){ stop(); return; } cur++; renderSim(); }, 1700);
    };
    renderSim();

  }
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
  if ($('#pbOut')) {
    /* ---------- System prompt builder ---------- */
    const SNIP = {
      read:'Read file contents', bash:'Execute bash commands (ls, grep, find, etc.)',
      edit:'Make precise file edits with exact text replacement, including multiple disjoint edits in one call',
      write:'Create or overwrite files', grep:'Search file contents for patterns (respects .gitignore)',
      find:'Find files by glob pattern (respects .gitignore)', ls:'List directory contents'
    };
    const GUIDE = {
      read:['Use read to examine files instead of cat or sed.'],
      edit:['Use edit for precise changes (edits[].oldText must match exactly)',
        'When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls',
        'Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one edit.',
        'Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions.'],
      write:['Use write only for new files or complete rewrites.']
    };
    function buildPrompt(){
      const o = { agents:$('#pbAgents').checked, append:$('#pbAppend').checked, skills:$('#pbSkills').checked, search:$('#pbSearch').checked, system:$('#pbSystem').checked };
      const tools = ['read','bash','edit','write'].concat(o.search ? ['grep','find','ls'] : []);
      const sec = [];
      if (o.system){
        sec.push(['preamble', '你是我们团队的 Java 编码助手。……（SYSTEM.md 的全部内容）']);
      } else {
        sec.push(['preamble', 'You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.']);
        sec.push(['tools', tools.map(t => '- ' + t + ': ' + SNIP[t]).join('\n') + '\n\nIn addition to the tools above, you may have access to other custom tools depending on the project.']);
        const rules = [];
        if (!o.search) rules.push('Use bash for file operations like ls, rg, find');
        tools.forEach(t => (GUIDE[t] || []).forEach(r => rules.push(r)));
        rules.push('Be concise in your responses', 'Show file paths clearly when working with files');
        sec.push(['rules', rules.map(r => '- ' + r).join('\n')]);
        sec.push(['docs', 'Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):\n- Main documentation: …/pi-coding-agent/README.md\n- Additional docs: …/pi-coding-agent/docs\n…（省略）']);
      }
      if (o.append) sec.push(['addendum', '所有回答使用中文。']);
      if (o.agents) sec.push(['project_context', 'Project-specific instructions and guidelines:\n\n<project_instructions path="E:/repo/demo/AGENTS.md">\n- 测试：mvn -q test -Dtest=类名\n- 不要修改 application-prod.yml\n</project_instructions>']);
      if (o.skills) sec.push(['skills', 'The following skills provide specialized instructions for specific tasks.\nUse the read tool to load a skill\'s file when the task matches its description.\nWhen a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.\n\n<available_skills>\n  <skill>\n    <name>release-notes</name>\n    <description>根据 git log 生成发版说明……</description>\n    <location>E:/repo/demo/.pi/skills/release-notes/SKILL.md</location>\n  </skill>\n  <skill>\n    <name>code-review</name>\n    <description>按团队清单审查代码……</description>\n    <location>C:/Users/you/.pi/agent/skills/code-review/SKILL.md</location>\n  </skill>\n</available_skills>']);
      sec.push(['cwd', 'E:/repo/demo']);
      const outEl = $('#pbOut'); outEl.textContent = '';
      let chars = 0;
      sec.forEach(([name, body], i) => {
        if (i) outEl.appendChild(document.createTextNode('\n\n'));
        if (name === 'preamble'){ outEl.appendChild(document.createTextNode(body)); chars += body.length; return; }
        outEl.appendChild(el('span', 'tag', '<' + name + '>'));
        outEl.appendChild(document.createTextNode('\n' + body + '\n'));
        outEl.appendChild(el('span', 'tag', '</' + name + '>'));
        chars += body.length + name.length * 2 + 6;
      });
      $('#pbTok').textContent = Math.round(chars / 4).toLocaleString();
      $('#pbSections').textContent = 'sections：' + sec.map(s => s[0]).join(' · ');
    }
    ['#pbAgents','#pbAppend','#pbSkills','#pbSearch','#pbSystem'].forEach(id => $(id).addEventListener('change', buildPrompt));
    buildPrompt();

  }
  if ($('#emOut')) {
    /* ---------- Edit matcher (mirrors edit-diff.ts) ---------- */
    const FILE = 'public String greet(User u) {   \n    String name = u.getName();\n    log.info(\u201CGreeting user\u201D);\n    return "Hello, " + name;\n}\n\npublic String bye(User u) {\n    String name = u.getName();\n    return "Bye, " + name;\n}';
    const PATH = 'Greeter.java';
    function fuzzy(t){
      return t.normalize('NFKC').split('\n').map(l => l.replace(/\s+$/, '')).join('\n')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, ' ');
    }
    function count(hay, needle){ return needle ? hay.split(needle).length - 1 : 0; }
    const cases = [
      { label:'唯一且精确', old:'return "Hello, " + name;' },
      { label:'出现两次', old:'String name = u.getName();' },
      { label:'行尾空格不一致', old:'public String greet(User u) {\n    String name = u.getName();' },
      { label:'模型写了直引号', old:'log.info("Greeting user");' },
      { label:'根本不存在', old:'return "Hi, " + name;' }
    ];
    let emSel = 0;
    function drawEm(){
      const box = $('#emCases'); box.textContent = '';
      cases.forEach((c, i) => { const b = el('button', 'btn mono' + (i === emSel ? ' sel' : ''), c.label); b.onclick = () => { emSel = i; drawEm(); }; box.appendChild(b); });
      const c = cases[emSel];
      const exact = count(FILE, c.old);
      const fz = fuzzy(FILE), fo = fuzzy(c.old), fuzzyN = count(fz, fo);
      const fileEl = $('#emFile'); fileEl.textContent = '';
      const useFuzzy = exact === 0 && fuzzyN > 0;
      const shown = useFuzzy ? fz : FILE;
      const needle = exact > 0 ? c.old : (fuzzyN > 0 ? fo : '');
      fileEl.appendChild(el('span', 'tag', '// ' + PATH + (useFuzzy ? '（模糊归一化后的视图）' : '') + '\n'));
      if (needle){
        const parts = shown.split(needle);
        parts.forEach((p, i) => { fileEl.appendChild(document.createTextNode(p)); if (i < parts.length - 1) fileEl.appendChild(el('mark', null, needle)); });
      } else fileEl.appendChild(document.createTextNode(shown));
      fileEl.appendChild(el('span', 'tag', '\n\n// oldText:\n'));
      fileEl.appendChild(document.createTextNode(c.old));
      const out = $('#emOut');
      if (exact === 1){ out.className = 'status ok'; out.textContent = '精确匹配 1 处，直接替换。'; }
      else if (exact > 1 || (exact === 0 && fuzzyN > 1)){ out.className = 'status bad'; out.textContent = 'Found ' + Math.max(exact, fuzzyN) + ' occurrences of the text in ' + PATH + '. The text must be unique. Please provide more context to make it unique.'; }
      else if (fuzzyN === 1){ out.className = 'status ok'; out.textContent = '精确匹配失败，模糊匹配成功（去行尾空白、弯引号转直引号等），在归一化后的内容上完成替换。'; }
      else { out.className = 'status bad'; out.textContent = 'Could not find the exact text in ' + PATH + '. The old text must match exactly including all whitespace and newlines.'; }
    }
    drawEm();

  }
  /* ---------- Quiz ---------- */
  const qs = [
    { ch:'c17', q:'平台里有个任务在等人审批，worker 应该怎么办？', o:['一直占着等审批结果','把任务持久化后释放 worker，审批结果作为事件重新入队','为了不卡住，直接拒绝敏感操作'], a:1, w:'等待不该占着 worker；审批回来后，任何 worker 都能从事件日志接着跑。但沙箱不会自动消失：短等待保留（带租约和过期时间），长等待先把未提交的修改快照，再释放沙箱。' },
    { ch:'c5', q:'模型上下文由五个槽位拼成。增长最快、最需要控制的通常是哪一个？', o:['system prompt','工具列表','历史与工具结果'], a:2, w:'每次工具调用都往里追加结果，所以截断、压缩、清旧结果、子 agent 主要都在管它。' },
    { ch:'c3', q:'推理模型在工具调用往返中输出的思考块，harness 应该怎么处理？', o:['丢掉，省 token','原样放回下一次请求','改写成摘要再放回'], a:1, w:'模型是在带着思考继续的轨迹上训练的；丢掉会丢推理过程，有的厂商会直接拒绝请求。' },
    { ch:'c8', q:'Skills 和 tool search 的本质区别是？', o:['一个是开放标准、一个是厂商 API，原理完全不同','都是“完整内容按需加载”，主要区别在装的是做事方法还是工具定义','tool search 是 Skills 的升级版'], a:1, w:'同属“上下文里放什么”这个问题；用第 8 章那张四列表，二者主要差在“放的是什么”。常驻的部分也略有不同：skill 常驻名字和描述，tool search 通常只常驻一个搜索入口。' },
    { ch:'c2', q:'RLVR 和 GRPO 是什么关系？', o:['GRPO 是 RLVR 的新名字','RLVR 说反馈从哪来（程序判对错），GRPO 说怎么更新参数，可以组合','二者是竞争方案，只能选一个'], a:1, w:'两个独立维度。DeepSeek-R1-Zero 就是“程序判对错 + GRPO”。' },
    { ch:'c2', q:'按本手册的规律，哪一项最不可能被训练进模型？', o:['按某种编辑格式输出修改','调用工具前先想一想','在沙箱里限制网络访问'], a:2, w:'沙箱是环境，不是模型的行为。能示范、能被程序判对错的行为才更有机会被练进模型；即使如此，某段脚手架能不能删，仍要用评测确认。' },
    { ch:'c6', q:'为什么 prompt caching 只能缓存前缀？', o:['厂商的计费规则规定的','注意力只回看前面的 token，开头算出的结果和后面写了什么无关','因为前缀通常最短'], a:1, w:'改了前面任何一个字，它后面的结果都要重算，所以“只追加、不改开头”。' },
    { ch:'c9', q:'两个子 agent 都报告“完成”，用户还是登录不了。最可能的原因和对策？', o:['模型不够强，换更大的模型','接口约定不一致；先定契约，并在汇总那一层跑端到端测试','子 agent 太少，再加一个'], a:1, w:'各自的验证都通过了，整体仍然是错的；判断完成的验证器要放在“合”的那一层。' },
    { ch:'c1', q:'哪种场景最适合用 workflow 而不是 agent？', o:['排查原因未知的线上故障','按固定规则给工单分类并路由','修复一个 GitHub issue'], a:1, w:'步骤固定、可枚举的任务用 workflow，更可控、更便宜。' },
    { ch:'c3', q:'模型回复因 max tokens 被截断，里面有工具调用。正确做法？', o:['照常执行','补全 JSON 后执行','不执行，返回错误'], a:2, w:'参数可能不完整。pi 用 failToolCallsFromTruncatedMessage 把整批判为失败。' },
    { ch:'c4', q:'pi 并行执行工具时，权限钩子（beforeToolCall）是怎么跑的？', o:['也并行','先按顺序对每个调用做校验和钩子，再并行执行通过的','执行完再检查'], a:1, w:'两阶段：串行准备、并行执行。确认弹窗不会同时冒出来。' },
    { ch:'c5', q:'pi 压缩时为什么不在 toolResult 处切分？', o:['为了省 token','工具结果必须和它的调用在一起，否则请求会被拒绝','toolResult 不重要'], a:1, w:'每个 tool_result 都要有对应的 tool_use 在前。' },
    { ch:'c6', q:'哪种做法会破坏 prompt caching？', o:['system prompt 开头放当前时间','历史只追加','工具变化以增量消息追加'], a:0, w:'前缀一致才命中。' },
    { ch:'c7', q:'bash 工具输出超限时，pi 保留哪一部分？', o:['开头','结尾','中间'], a:1, w:'编译错误和测试失败信息在最后，所以 bash 用 truncateTail；read 则保留开头。' },
    { ch:'c7', q:'两个并行的 edit 改同一个文件，pi 怎么避免丢失更新？', o:['不处理','按文件 realpath 排队，同文件串行、不同文件并行','全部工具改为串行'], a:1, w:'withFileMutationQueue 用 Promise 链实现每个文件一条队列。' },
    { ch:'c7', q:'edit 的 oldText 在文件中出现 2 次，pi 会？', o:['替换第一处','全部替换','报错要求提供更多上下文使其唯一'], a:2, w:'防止改错位置。' },
    { ch:'c9', q:'pi 的子 agent 示例是怎么隔离上下文的？', o:['同一进程内新建 Agent 对象','为每个子 agent 启动一个独立的 pi 进程（JSON 模式）','共享上下文'], a:1, w:'进程隔离：上下文、内存、崩溃都分开，Ctrl+C 会传播。但子进程和父进程用同一个系统账户，文件和网络权限并没有隔开。' },
    { ch:'c1', q:'关于“模型越强，harness 越薄”，哪个说法最准确？', o:['harness 整体会消失','替模型思考的脚手架变薄，沙箱、状态、验证、评测变厚','harness 越来越厚，与模型无关'], a:1, w:'还有一部分转给了模型训练和厂商 API，比如推理交织、服务端压缩、工具按需加载。' },
    { ch:'c6', q:'换了更短的上下文策略后，缓存命中率从 90% 降到 70%，但每个合格完成的任务花费下降了。该怎么看？', o:['回滚，命中率是第一指标','以每个合格任务的总成本为准，命中率只是过程指标','两个指标都不重要'], a:1, w:'命中率高也可能只是每轮都在重发用不上的上下文。' },
    { ch:'c3', q:'下面哪个说法最准确？', o:['工具调用只能用 JSON Schema 描述参数','JSON 参数最常见，但也有自由文本加语法约束的工具；不变的是“请求 → 运行时校验执行 → 回传结果”的闭环','模型自己执行工具'], a:1, w:'OpenAI 的 custom tools 就允许自由文本输入，并可用 Lark 语法或正则约束格式。' },
    { ch:'c9', q:'长时任务跨多个上下文窗口，Anthropic 推荐的做法是？', o:['把上下文窗口调到最大','用功能清单、进度文件和 git 保存状态，每个会话只做一项并验证','每个会话从头重新开始'], a:1, w:'把记忆从上下文搬到文件和 git 里；完成与否交给测试判定。' }
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
