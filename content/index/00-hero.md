<header class="hero">
  <h1>看懂 Agent</h1>
  <p class="hero-deck">词会过时，问题不会</p>
  <div class="hero-lead">
    <p>这几年 agent 领域造了很多词：function calling、RAG、MCP、Skills、tool search、context engineering、harness engineering……它们看起来各不相同，大多却在回答同一组问题。这组问题来自当前主流模型及其调用方式的几条工程约束。约束还在，问题就还在。</p>
    <p style="margin-top:.8em">这本手册从后端工程的视角来讲 <b style="color:var(--ink);font-weight:500">coding agent</b>：先把这组问题讲清楚，再逐章拆开，并对照开源 coding agent <b style="color:var(--ink);font-weight:500">pi</b> 的实现，看一个真实系统怎么回答每一个问题。读完的目标是：下一个新词出来时，你能很快判断它主要在回答哪个老问题、换了哪一个维度；放不进去的，再当作真正的新东西细看。</p>
  </div>
  <nav class="parts" aria-label="三个部分">
    <a href="#a0"><span class="pn">01–09</span><b>原理</b><span class="pd">模型从哪来、工具调用、循环、上下文、记忆、多 agent</span></a>
    <a href="#b0"><span class="pn">10–16</span><b>工程化</b><span class="pd">状态、事件、扩展、安全、可靠性、评测、MCP</span></a>
    <a href="#d0"><span class="pn">17–19</span><b>综合</b><span class="pd">系统设计、动手项目、速记自测，附 pi 源码地图</span></a>
  </nav>
  <dl class="howread">
    <div><dt>推荐路线</dt><dd>第一遍先跑通闭环：<a href="#c1">1</a> → <a href="#c3">3</a> → <a href="#c4">4</a> → <a href="#c5">5</a> → <a href="#c7">7</a>，再回头读 <a href="#c2">第 2 章</a>看能力从哪来。第 9 章的长任务、第 10 章的状态恢复、第 14 章的可靠性讲的是同一条线（怎么跨故障接着干），建议连读。</dd></div>
  </dl>
</header>
