---
id: c11
toc: 事件流与集成
title: 事件流、流式输出与集成协议
imp: plus
q: [q4]
done: 我能设计事件推送协议，并能用 Java 驱动 pi
---
### 基础 | 事件序列

```text pi 一次运行的事件 | json / rpc 模式输出
agent_start
  turn_start
    message_start / message_end                     ← 用户消息
    message_start / message_update* / message_end   ← 流式 assistant 消息
    tool_execution_start / _update* / _end          ← 每个工具调用
    message_start / message_end                     ← toolResult 消息
  turn_end
  …
agent_end                                           ← 一次底层运行结束
agent_settled                                       ← 不会再自动继续
```

- 流式增量只用于展示，`message_end` 里的完整消息才是权威结果，落库以它为准。
- `agent_end` 之后还可能有自动重试、压缩恢复、排队消息；要知道“彻底完成”，看 `agent_settled`。

### 进阶 | 推送给前端与外部系统

- **SSE** 足够大多数场景（单向、自动重连、穿透代理友好）；需要双向交互（审批、插话）用 WebSocket。事件带递增序号，断线后从序号续传。
- pi 提供四种接入方式：print（跑完输出结果）、JSON（单次运行的事件流）、RPC（长驻子进程，stdin 收命令、stdout 出事件）、TypeScript SDK（进程内调用）。

```java 从 Java 驱动 pi（RPC 模式） | Java 17 + Jackson · 示意
var pb = new ProcessBuilder("pi.cmd", "--mode", "rpc", "--no-session")   // Windows 下 npm 装的是 pi.cmd
        .directory(new File("E:/repo/demo"))
        .redirectError(ProcessBuilder.Redirect.INHERIT);                 // stderr 是日志，stdout 只有协议
Process pi = pb.start();
var json = new ObjectMapper();
var stdin = new BufferedWriter(new OutputStreamWriter(pi.getOutputStream(), UTF_8));
var stdout = new BufferedReader(new InputStreamReader(pi.getInputStream(), UTF_8));

stdin.write(json.writeValueAsString(Map.of("id", "req-1", "type", "prompt", "message", "列出所有 Controller")) + "\n");
stdin.flush();

String line;
while ((line = stdout.readLine()) != null) {                       // 生产代码应放在独立线程里持续读
    JsonNode ev = json.readTree(line);
    switch (ev.path("type").asText()) {
        case "response" -> System.out.println("[accepted] " + ev.path("success"));   // 只代表已接受
        case "message_update" -> {
            JsonNode d = ev.path("assistantMessageEvent");
            if ("text_delta".equals(d.path("type").asText())) System.out.print(d.path("delta").asText());
        }
        case "tool_execution_start" -> System.out.println("\n[tool] " + ev.path("toolName").asText());
        case "agent_settled" -> { pi.destroy(); return; }
        default -> {}
    }
}
```

### 深入 | 协议细节与 await 屏障

::: ref 严格按换行符分帧；客户端必须持续读输出；命令和响应用 id 关联。 | docs/rpc.md · docs/json.md · agent/src/agent.ts
- **严格 JSONL 分帧：**只按 LF 切分。文档特别警告 Node 的 `readline` 会把 U+2028 / U+2029 当成换行，而这两个字符可以合法地出现在 JSON 字符串里。Java 的 `BufferedReader.readLine()` 只认 `\n`、`\r`，而 JSON 里的这两个都已转义，所以可以直接用。
- **背压：**客户端必须持续读 stdout，否则管道缓冲区写满，pi 会阻塞。
- **线上体积：**wire 上的 `message_update` 只带增量，去掉了累计的 partial 快照，让流的大小随输出线性增长而不是平方增长。
- **命令与响应用 id 关联**，因为处理是异步的，不能按顺序对应。
- **await 屏障：**`Agent` 类会依次 await 每个事件监听器；直接消费底层 `agentLoop` 生成器则只是“观察”，事件顺序不变但不会等待处理器。需要改变行为的逻辑（例如扩展的 `tool_call` 拦截）走的是 `beforeToolCall` 这类钩子，循环会 await 它的返回值再决定是否执行。
:::

### 深入 | 可观测性

| 指标 | 为什么重要 |
|---|---|
| 任务成功率 | 最核心的质量指标，靠评测或用户反馈判定 |
| 每任务 token / 费用 / turn 数 | 成本控制；turn 数过高常意味着模型在打转 |
| 缓存命中率 | 直接影响成本和延迟；突降说明前缀被改动 |
| 工具错误率（按工具） | 定位描述不清或实现有问题的工具 |
| 首 token 延迟、端到端耗时 | 用户体验 |
| 压缩、拦截、人工介入、重试次数 | 上下文压力、安全与稳定性 |

链路追踪：一次任务一个 trace，每个 turn、每次模型调用、每次工具执行一个 span，属性记录 token、缓存命中、耗时、错误，可对接 OpenTelemetry。OpenTelemetry 已有专门的 GenAI 语义约定（还在演进中），规定了模型调用、token 用量、agent 和工具 span 的标准属性名，按它埋点，换观测平台不用改代码。排查线上问题时，能完整回放每个 turn 发给模型的上下文是最关键的能力。

::: term protocols | MCP、A2A、ACP、AG-UI：每个协议连接的是不同的两端
| 协议 | 连接的两端 | 出现 | 现状 |
|---|---|---|---|
| function calling | harness ↔ 模型 | 2023-06 | 事实标准（第 3 章） |
| MCP | agent ↔ 工具与数据 | 2024-11 | 已成标配，由 Linux Foundation 治理（第 16 章） |
| A2A | agent ↔ 其他组织的 agent | 2025-04（Google） | 2025-06 交给 Linux Foundation，主要在企业平台里用 |
| AG-UI | agent 后端 ↔ 前端界面 | 2025-05（CopilotKit） | 标准化本章讲的这类事件流 |
| ACP | coding agent ↔ 编辑器 | 2025-08（Zed） | 同一个 agent 接进不同编辑器，类似 LSP 之于语言服务器 |

**怎么看：**pi 的 RPC 模式（stdin 收命令、stdout 出事件）和 ACP、AG-UI 解决的是同一类问题。自己设计事件协议时，先看这几个标准有没有已经覆盖你的场景。
:::

:::: qa
::: q 线上 agent 回答错了，怎么排查？
- 按 trace 回放完整轨迹：每个 turn 的上下文、模型回复、工具输入输出。
- 定位出错环节：上下文缺信息？工具返回错误数据？选错工具？总结出错？
- 把案例加入评测集，修复后跑回归。
:::
::::

::: ahead 前瞻 · 本章
- [现状] agent 接入的每一段都已出现标准或候选标准（采用程度差别很大）：工具（MCP）、编辑器（ACP）、前端（AG-UI）、agent 之间（A2A）、观测（OTel GenAI 约定）。
- [推测] 任务变长后，界面从“看着流式输出”转向“异步通知 + 事后回放”，断线续传和事件回放的重要性上升。
:::

::: quiz
- 要判断一次运行彻底结束、不会再自动继续，应该看哪个事件？
  - [ ] agent_end
  - [x] agent_settled
  - [ ] turn_end
  > agent_end 之后还可能有自动重试、压缩恢复和排队消息；agent_settled 才表示不会再继续。
:::
