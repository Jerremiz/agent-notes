---
id: px
toc: pi 源码地图
title: pi 源码地图
part: 附录
n: 附
eyebrow: 附录
imp: aux
impLabel: 参考
done: 我 clone 了 pi，知道每个包和关键文件的位置
---
pi 的代码在 [earendil-works/pi](https://github.com/earendil-works/pi)（原 badlogic/pi-mono），TypeScript 编写。先建立地图，各章“pi 的做法”里的源码引用才能对上位置。本手册核对的是 pi 的 [`v1.4.0`](https://github.com/earendil-works/pi/releases/tag/v1.4.0)。文中的路径多是缩写，省略了 `packages/`、`coding-agent/src/` 这类前缀，按下面的地图补全即可。建议现在就 clone 一份这个版本：`git clone --branch v1.4.0 https://github.com/earendil-works/pi`。之后的版本可能改名或挪位置，对不上时以 v1.4.0 为准。

### 基础 | 四层结构

<div class="layers">
  <div class="layer"><div><div class="nm">packages/coding-agent</div><div class="ds">终端里的 <code>pi</code>：内置工具、AgentSession、会话存储、压缩、扩展、skill、四种运行模式</div></div><div class="an">≈ 应用层</div></div>
  <div class="layer split">
    <div><div class="nm">packages/agent</div><div class="ds"><code>Agent</code> 与 <code>agentLoop</code>：循环、事件、队列、钩子。核心代码约 2500 行，最值得精读</div><div class="an">≈ 运行时引擎</div></div>
    <div><div class="nm">packages/tui</div><div class="ds">终端 UI，差量渲染</div><div class="an">≈ 视图层</div></div>
  </div>
  <div class="layer"><div><div class="nm">packages/ai</div><div class="ds">统一的多厂商 LLM 接口：消息类型、流式事件、工具定义、用量与费用</div></div><div class="an">≈ JDBC 驱动层</div></div>
  <div class="layer ext"><div><div class="nm">Anthropic · OpenAI · Google · 本地模型 …</div><div class="ds">模型厂商 API</div></div><div class="an">≈ 各家数据库</div></div>
</div>

### 进阶 | 一条消息的旅程

你在终端里敲下“修一下这个测试”并回车，代码依次经过这些地方：

::: journey
1. [coding-agent/src/main.ts → modes/](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/main.ts) 解析命令行，选择交互 / print / json / rpc 模式
2. [core/agent-session.ts · AgentSession.prompt()](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/agent-session.ts) 展开 prompt 模板、处理扩展命令、检查是否需要压缩，把用户消息交给 Agent
3. [core/system-prompt.ts](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/system-prompt.ts) 按 section 拼出 system prompt：角色、工具清单、规则、AGENTS.md、skill 索引、cwd
4. [agent/src/agent.ts · Agent](https://github.com/earendil-works/pi/blob/v1.4.0/packages/agent/src/agent.ts) 管理状态和 steering / follow-up 队列，调用 agentLoop
5. [agent/src/agent-loop.ts · runLoop()](https://github.com/earendil-works/pi/blob/v1.4.0/packages/agent/src/agent-loop.ts) 循环：transformContext → convertToLlm → 流式请求 → 执行工具 → 回填结果
6. [ai/ · models.stream()](https://github.com/earendil-works/pi/tree/v1.4.0/packages/ai) 把统一格式转换成具体厂商的 HTTP 请求，把 SSE 响应转换回统一事件
7. [coding-agent/src/core/tools/*.ts](https://github.com/earendil-works/pi/tree/v1.4.0/packages/coding-agent/src/core/tools) read / bash / edit / write 的实际实现
8. [core/session-manager.ts](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/session-manager.ts) 每条消息追加写入 JSONL 会话文件
9. [core/extensions/](https://github.com/earendil-works/pi/tree/v1.4.0/packages/coding-agent/src/core/extensions) 沿途在各个事件点调用扩展的处理器（可以拦截工具、改写上下文）
:::

### 深入 | 读源码前的 TypeScript 速查

| Java | TypeScript / Node |
|---|---|
| `CompletableFuture` | `Promise` + `async` / `await`；`Promise.all` ≈ `allOf` |
| `Iterator` | `AsyncIterable`，`for await (const ev of stream)` 消费流式事件 |
| `sealed interface` + `switch` | 可辨识联合：`switch (event.type)` |
| Bean Validation / JSON Schema | TypeBox：`Type.Object({...})` 同时得到 TS 类型和 JSON Schema |
| SPI / `ServiceLoader` | `export default function (pi) {...}` |
| `Thread.interrupt()` | `AbortSignal`，层层传给工具 |
| `a != null ? a.b() : null` | `a?.b()`；`x ?? []` 是默认值 |
| 单线程 + 事件循环 | Node 的 JavaScript 默认跑在单个主线程上，没有多线程抢同一段代码；但 `await` 之间仍会交错，所以 pi 照样需要“文件修改队列”（第 7 章）。用了 worker_threads 或多进程，还要另外处理并发 |
