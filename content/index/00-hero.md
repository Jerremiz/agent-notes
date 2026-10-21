<header class="hero">
  <h1>看懂 Agent</h1>
  <p class="hero-deck">词会过时，问题不会</p>
  <div class="hero-lead">
    <p>这几年 agent 领域造了很多词：function calling、RAG、MCP、Skills、tool search、context engineering、harness engineering……它们看起来各不相同，大多却在回答同一组问题。这组问题来自当前主流模型及其调用方式的几条工程约束。约束还在，问题就还在。</p>
    <p style="margin-top:.8em">这本手册从后端工程的视角来讲 <b style="color:var(--ink);font-weight:500">coding agent</b>：先把这组问题讲清楚，再逐章拆开，并对照开源 coding agent <b style="color:var(--ink);font-weight:500">pi</b> 的实现，看一个真实系统怎么回答每一个问题。读完的目标是：下一个新词出来时，你能很快判断它主要在回答哪个老问题、换了哪一个维度；放不进去的，再当作真正的新东西细看。</p>
  </div>
  <nav class="parts" aria-label="三个部分">
    <a href="part1.html"><span class="pn">01–09</span><b>原理</b><span class="pd">模型从哪来、工具调用、循环、上下文、记忆、多 agent</span></a>
    <a href="part2.html"><span class="pn">10–16</span><b>工程化</b><span class="pd">状态、事件、扩展、安全、可靠性、评测、MCP</span></a>
    <a href="part3.html"><span class="pn">17–19</span><b>综合</b><span class="pd">系统设计、动手项目、速记自测，附 pi 源码地图</span></a>
  </nav>
  <dl class="howread">
    <div><dt>推荐路线</dt><dd>第一遍先跑通闭环：<a href="part1.html#c1">1</a> → <a href="part1.html#c3">3</a> → <a href="part1.html#c4">4</a> → <a href="part1.html#c5">5</a> → <a href="part1.html#c7">7</a>，再回头读 <a href="part1.html#c2">第 2 章</a>看能力从哪来。第 9 章的长任务、第 10 章的状态恢复、第 14 章的可靠性讲的是同一条线（怎么跨故障接着干），建议连读。</dd></div>
    <div><dt>先读这页</dt><dd>下面的“怎么学”和“本质地图”是全书的骨架。每章开头标着它 <span class="qchip">回答</span> 哪几个问题，点一下回到地图里对应的那一行。</dd></div>
    <div><dt>三层深度</dt><dd>每章的小节标了 <span class="lv l1">基础</span> <span class="lv l2">进阶</span> <span class="lv l3">深入</span>。第一遍只看基础，第二遍补进阶，深入部分对着源码读。</dd></div>
    <div><dt>名词卡</dt><dd>每个关键名词第一次出现时有一张可展开的 <b style="color:var(--r-system)">词</b> 卡。先看“本质”一行：它属于哪个问题、方案在哪一层；下面是它的来历和现状。状态分为 <span class="st hot">正流行</span> <span class="st infra">已成标配</span> <span class="st absorbed">已练进模型</span> <span class="st stable">稳定</span> <span class="st debate">仍在演变</span> <span class="st gone">已淘汰</span>。</dd></div>
    <div><dt>pi 的做法</dt><dd>对照 pi 源码的区块默认折叠，只显示一行结论。源码有效时间短，需要时再展开。文中的路径对应 pi 的 commit <a href="https://github.com/earendil-works/pi/tree/cdaf6c227d4718a72b59ccd02152c9614df44cfc" target="_blank" rel="noopener"><code>cdaf6c2</code></a>（2026-10-11），源码地图在<a href="part3.html#px">附录</a>。</dd></div>
    <div><dt>前瞻</dt><dd>每章末尾的紫色 <b style="color:var(--r-system)">前瞻</b> 框把“现在是什么样”和“接下来会怎么变”分开标注：<span class="cf sure">已有证据</span> 描述现状，有一手资料或多家产品实践支持（不代表它会一直成立）；<span class="cf likely">作者判断</span> 根据现有迹象做的推测；<span class="cf open">有争议</span> 业内仍有分歧，或证据还不够。</dd></div>
    <div><dt>先答再看</dt><dd>每章末尾的问答默认折叠。先自己讲一遍，再展开对照要点和“再深一步”。</dd></div>
  </dl>
</header>
