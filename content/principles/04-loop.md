---
id: c4
toc: Agent Loop
title: Agent Loop：harness 的心脏
imp: must
impLabel: 核心 · 建议手写
q: [q1]
done: 我能写出带护栏的 loop，并讲清 pi 的两层循环和两阶段执行
---
### 基础 | 循环本身

**调用模型 → 有工具调用就执行并回填 → 再调用模型 → 直到不再调用工具。**这就是 ReAct（Reason + Act，2022）思路的工程实现。“一次模型回复 + 它引出的工具执行”叫一个 **turn**。

不再调用工具时有两种情况：任务完成，或者**需要用户补充信息**（缺关键参数、所有方案都走不通、要做不可逆的操作）。停下来问人是循环的正常出口，不是失败。逐步点击模拟器，观察代码、事件和 messages 的变化：

::: term react | 循环结构留下来了，主流模型不再依赖显式文本模板
- 2022-01 | Chain-of-Thought 论文：让模型“一步步想”能显著提升推理。
- 2022-10 | ReAct 论文：思考（Thought）、行动（Action）、观察（Observation）交替进行。当时靠提示词模板实现，harness 用正则从文本里解析出 Action。
- 2023-06 | function calling 出现，Action 不再靠正则解析，变成结构化输出。
- 2024-09 → 2025 | o1、DeepSeek-R1、Claude 的 extended thinking 等推理模型出现；随后推理和工具调用在模型内部交织进行，通过强化学习训练出来。

**现在：**支持原生推理和工具调用的模型，通常不必再在提示词里写“Thought: … Action: …”，这部分能力练进了模型；显式模板仍可以用，用不用取决于模型、任务和 harness 的设计；但“想 → 调工具 → 看结果 → 再想”这个循环本身就是今天每个 harness 的主循环。这是“练进模型”的典型样子：**思想留下，实现方式转进了模型里**。
:::

::: widget agent-loop-sim
:::

::: callout 第一次写循环就要带上的两样东西
**限制动作：**只注册这个任务需要的工具，限定工作目录，给每次执行设超时，删除、推送这类不可逆操作先停下来问人。这是最小的安全边界，完整的做法在第 13 章。\
**判断完成：**开始前写下成功标准，比如“这几个测试通过、构建不报错”，循环结束后由程序检查。模型说“完成了”不算数。完整的做法在第 9、15 章。
:::

### 进阶 | 生产级的 Java 版本

只有 while 循环的版本离生产很远。下面标注的 9 处才是真正的工程量：

```java AgentLoop.java | Java 21 · 参考实现
public final class AgentLoop {
    private static final int MAX_TURNS = 50;                    // ① 防止死循环
    private final LlmClient llm;
    private final Map<String, Tool> tools;
    private final ToolGuard guard;
    private final ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();

    public String run(Session session, String input, CancelToken cancel) {
        session.append(Message.user(input));
        for (int turn = 0; turn < MAX_TURNS; turn++) {
            cancel.throwIfCancelled();                                // ② 支持中止
            AssistantMessage reply = llm.complete(session.buildContext(), toolSpecs());
            session.append(reply);                                    // 先持久化，崩溃后可恢复
            switch (reply.stopReason()) {
                case ERROR, ABORTED -> throw new AgentException(reply.errorMessage());
                case LENGTH -> {                                      // ③ 截断的工具调用不执行
                    reply.toolCalls().forEach(c -> session.append(Message.toolError(c.id(), "output truncated")));
                    continue;
                }
                default -> {}
            }
            if (reply.toolCalls().isEmpty()) return reply.text();

            // ④ 先串行做校验和权限检查，再并行执行（与 pi 相同的两阶段）
            List<Prepared> prepared = reply.toolCalls().stream().map(this::prepare).toList();
            List<CompletableFuture<Message>> futures = prepared.stream()
                .map(p -> p.immediate() != null
                        ? CompletableFuture.completedFuture(p.immediate())
                        : CompletableFuture.supplyAsync(() -> execute(p, cancel), pool)
                            .completeOnTimeout(Message.toolError(p.id(), "timeout"), 120, TimeUnit.SECONDS))  // ⑤ 超时
                .toList();
            futures.forEach(f -> session.append(f.join()));           // ⑥ 按调用顺序回填
        }
        throw new AgentException("exceeded " + MAX_TURNS + " turns");
    }

    private Prepared prepare(ToolCall call) {
        Tool tool = tools.get(call.name());
        if (tool == null) return Prepared.fail(call, "Tool " + call.name() + " not found");
        try {
            JsonNode args = SchemaValidator.validate(tool.schema(), call.arguments()); // ⑦ 校验参数
            Decision d = guard.check(call.name(), args);                              // ⑧ 权限钩子
            return d.blocked() ? Prepared.fail(call, d.reason()) : Prepared.ok(call, tool, args);
        } catch (Exception e) {
            return Prepared.fail(call, e.getMessage());               // ⑨ 错误回填，不中断
        }
    }

    private Message execute(Prepared p, CancelToken cancel) {
        try {
            String out = p.tool().execute(p.args(), cancel);          // 工具内部负责超时后杀进程树
            return Message.toolResult(p.id(), Truncator.truncate(out)); // 行数 / 字节双上限
        } catch (Exception e) {
            return Message.toolError(p.id(), e.getMessage());
        }
    }
}
```

::: callout 容易忽略的问题
`completeOnTimeout` 只是让 future 提前返回默认值，**底层任务还在跑**。如果工具是一个 shell 进程，超时后必须真正杀掉它，而且要杀整个进程树（`ProcessHandle.descendants()` 逐个 `destroyForcibly()`），否则 `mvn` 拉起的子 JVM 会成为孤儿进程。pi 的 bash 工具正是这么做的（第 7 章）。
:::

### 深入 | pi 的 runLoop：两层循环 + 两阶段执行

::: ref 两层循环分开处理“运行中插话”和“结束后追加”；循环只认注入的钩子，不认识会话和扩展。 | packages/agent/src/agent-loop.ts · runLoop()
```ts runLoop（节选并简化） | agent-loop.ts
let pendingMessages = await config.getSteeringMessages?.() || [];

while (true) {                                  // 外层：处理 follow-up（任务结束后才发的消息）
  let hasMoreToolCalls = true;
  while (hasMoreToolCalls || pendingMessages.length > 0) {   // 内层：工具调用 + steering
    if (lastCompletedTurn) { await config.prepareNextTurn?.(...); /* 自动压缩发生在这里 */ }
    for (const m of pendingMessages) currentContext.messages.push(m);   // 注入插话
    await config.prepareRequest?.(...);           // 请求前最后一次重建上下文

    const message = await streamAssistantResponse(currentContext, config, signal, emit, streamFn);
    if (message.stopReason === "error" || message.stopReason === "aborted") { /* turn_end, agent_end */ return; }

    const toolCalls = message.content.filter(c => c.type === "toolCall");
    hasMoreToolCalls = false;
    if (toolCalls.length > 0) {
      const batch = message.stopReason === "length"
        ? await failToolCallsFromTruncatedMessage(toolCalls, emit)
        : await executeToolCalls(currentContext, message, config, signal, emit);
      hasMoreToolCalls = !batch.terminate;
      for (const r of batch.messages) currentContext.messages.push(r);
    }
    const decision = await config.finishTurn?.(...);   // 可以要求结束或再跑一轮
    await emit({ type: "turn_end", message, toolResults });
    if (decision?.action === "end") { /* agent_end */ return; }
    pendingMessages = await config.getSteeringMessages?.() || [];
  }
  const followUps = await config.getFollowUpMessages?.() || [];
  if (followUps.length > 0) { pendingMessages = followUps; continue; }
  break;
}
await emit({ type: "agent_end", messages: newMessages });
```

几个值得学的设计：

- **两层循环**把“运行中插话”（steering，内层每个 turn 结束时检查）和“结束后追加”（follow-up，外层在本该停下时检查）分开。
- **两阶段执行**（`executeToolCallsParallel`）：先按顺序对每个调用做 `prepareToolCall`（查找工具 → 参数预处理 → schema 校验 → `beforeToolCall` 钩子），通过的再用 `Promise.all` 并行执行。这样权限弹窗是一个一个出现的，而执行仍然并行。
- **按源顺序回填**：`tool_execution_end` 事件按完成顺序发出（界面更实时），但持久化的 toolResult 消息按 assistant 消息里的原顺序排列。
- **terminate 要整批同意**：工具结果可以带 `terminate: true` 表示“这批做完就别再请求模型了”，但只有**整批所有结果都同意**时才生效，避免一个工具擅自中断其他工具的后续。
- **可串行化**：任一工具声明 `executionMode: "sequential"`，整批就退化为串行，用于共享可变状态的工具。
- **钩子注入**：压缩、上下文变换、权限、结束判定都是 `config` 上的函数，循环本身不认识“会话”“扩展”这些上层概念，可以用假的 LLM 单独测试（第 15 章）。
:::

:::: qa
::: q 写一个 agent loop，并说明它的终止条件。
- 正常终止：回复中没有工具调用。可能是做完了，也可能是需要用户补充信息或确认。
- 异常终止：出错或被中止、达到最大轮数、超过 token / 费用预算、整体超时、用户取消、所有工具结果要求 terminate。
- 写完主体后主动补充：参数校验、权限钩子、两阶段执行、超时并杀进程树、结果截断、按序回填、每步持久化。
:::
::: q Agent 陷入死循环（反复调同一个工具）怎么办？
- 硬限制：最大轮数、token / 费用预算、墙钟超时。
- 检测：对 (工具名, 参数) 做哈希，连续 N 次相同就注入提示或终止。
- 根因：通常是错误信息不够清楚，模型不知道错在哪。改进错误信息比加限制更有效。
- 给人留出口：随时中止和 steering。
:::
::: q 并行执行工具时，权限确认怎么处理？
- 如果在并行任务里各自弹确认框，用户会同时看到多个弹窗，且顺序混乱。
- 做法是两阶段：先顺序跑完所有前置检查（含人工确认），再并行执行通过的调用。pi 的 `executeToolCallsParallel` 就是这样。
- 被拒绝的调用直接生成错误结果，不进入执行阶段。
:::
::::

::: ahead 前瞻 · 本章
- [现状] 到目前为止，loop 本身的结构没有变。变的是它能接下多长的任务：METR 的 2019–2025 数据显示，agent 能以 50% 成功率完成的任务，其长度（按人类专家所需时间算）大约每 7 个月翻一番。这衡量的是任务难度，不是 agent 自己连续跑了多久；不过实际产品里，单次运行也确实已从几分钟走向几小时。
- [推测] 运行变长之后，工程重点从“内层循环”移到“外层循环”：跨上下文窗口、跨会话、跨进程重启怎么接着干（第 9、10 章的长任务部分）。
- [推测] 中途插话（steering）和排队消息会成为标配，因为人不会守着一个跑几小时的任务等它结束。pi 的两层循环正是为此设计的。
:::

::: quiz
- pi 并行执行工具时，权限钩子（beforeToolCall）是怎么跑的？
  - [ ] 也并行
  - [x] 先按顺序对每个调用做校验和钩子，再并行执行通过的
  - [ ] 执行完再检查
  > 两阶段：串行准备、并行执行。确认弹窗不会同时冒出来。
:::
