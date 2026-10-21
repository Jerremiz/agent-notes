/* 看懂 Agent · 演示：Agent Loop 模拟器（widgets/agent-loop-sim.html）
   从 legacy/assets/guide.js 原样搬来，逻辑未改。页面里没有这个演示时什么也不做。 */
(function(){
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
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
})();
