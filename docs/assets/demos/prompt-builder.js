/* 看懂 Agent · 演示：system prompt 拼装器（widgets/prompt-builder.html）
   迁移时从旧页面的 legacy/assets/guide.js 原样搬来（该文件已删，见 git 历史），逻辑未改。页面里没有这个演示时什么也不做。 */
(function(){
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
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
})();
