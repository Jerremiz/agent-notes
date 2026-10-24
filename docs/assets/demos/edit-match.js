/* 看懂 Agent · 演示：edit 匹配（widgets/edit-match.html）
   迁移时从旧页面的 legacy/assets/guide.js 原样搬来（该文件已删，见 git 历史），逻辑未改。页面里没有这个演示时什么也不做。 */
(function(){
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
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
})();
