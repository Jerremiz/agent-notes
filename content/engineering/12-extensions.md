---
id: c12
title: 扩展机制与钩子
imp: plus
q: [q7, q4]
done: 我能设计一个插件系统的契约（失败安全、组合、状态、生命周期）
---
### 基础 | 为什么 harness 需要插件化

不同团队对 agent 的要求差异很大：有人要审批、有人要接内部系统、有人要换 UI。把这些都写进核心会让它臃肿且难以维护。插件化让核心只提供**事件点 + 注册接口**，其余交给扩展。

::: analogy Java 类比
扩展 ≈ Spring Boot starter：默认导出一个工厂函数，拿到 `pi` 这个“容器上下文”，往里注册 Bean（工具、命令）和监听器。事件钩子 ≈ `HandlerInterceptor` 链 / AOP `@Around`。
:::

### 进阶 | 三个最小示例

::: ref 注册工具、拦截工具调用、改写 system prompt，各只要十几行。 | examples/extensions/hello.ts · permission-gate.ts · pirate.ts
```ts ① 注册工具 | hello.ts
const helloTool = defineTool({
  name: "hello", label: "Hello",
  description: "A simple greeting tool",
  parameters: Type.Object({ name: Type.String({ description: "Name to greet" }) }),
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    return { content: [{ type: "text", text: `Hello, ${params.name}!` }],   // 给模型
             details: { greeted: params.name } };                             // 给界面 / 状态重建
  },
});
export default function (pi: ExtensionAPI) { pi.registerTool(helloTool); }
```

```ts ② 拦截工具调用 | permission-gate.ts
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName !== "bash") return undefined;
  const command = event.input.command as string;
  if (dangerousPatterns.some((p) => p.test(command))) {
    if (!ctx.hasUI) return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
    const choice = await ctx.ui.select(`⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`, ["Yes", "No"]);
    if (choice !== "Yes") return { block: true, reason: "Blocked by user" };
  }
  return undefined;
});
```

```ts ③ 每次运行前改写 system prompt | pirate.ts（节选）
pi.on("before_agent_start", async (event) => {
  if (pirateMode) return { systemPrompt: event.systemPrompt + "\n\nIMPORTANT: You are now in PIRATE MODE…" };
  return undefined;
});
```
:::

### 深入 | 契约设计：失败安全、组合与状态

::: ref 钩子自己出错就拦截；状态放进工具结果，跟着分支走；资源在会话开始时创建、结束时清理。 | docs/extensions.md · core/extensions/types.ts
- **失败即拦截（fail-safe）：**`tool_call` 处理器自己抛异常时，pi 拦截这次调用，而不是放行。安全相关的钩子必须这样设计：钩子坏了宁可不执行。
- **怎么标记工具失败：**`execute` 抛异常会生成失败结果；也可以正常 return 一个带 `isError: true` 的结果，在标记失败的同时带上结构化数据。只是 return 而不标记，就不算错误。
- **组合语义：**处理器按加载和注册顺序执行；`tool_result` 处理器是链式组合的，每个看到前一个的修改；不同事件的返回值语义不同（有的只是通知，有的可以改写或取消），必须看事件声明的结果类型。
- **状态放哪里：**跟随分支的工具状态放工具结果的 `details`（切换分支时自动正确）；不给模型看的持久数据用 `pi.appendEntry()`；要给模型看的用 `pi.sendMessage()`；跨会话的放外部存储。启动时从当前分支（而不是整个文件）重建状态。
- **生命周期：**工厂函数里不要启动进程、定时器，因为有些场景只加载扩展而不启动会话；放到 `session_start`，在幂等的 `session_shutdown` 里清理。
- **可续跑的边界：**`turn_end`、`agent_before_settle` 处理器可以返回 `continue: true` 请求再跑一轮，文档提醒必须加条件，否则会死循环。
- **供应链：**项目级扩展（`.pi/extensions`）是可执行代码，必须先信任项目才加载（第 13 章）。
:::

::: term hooks | ChatGPT 插件停用了，但“harness 可扩展”这件事成了标配
- 2023-03 | ChatGPT Plugins：第一次尝试让第三方给模型加能力。半年后被 GPTs 取代，2024 年停用。
- 2025-06 | Claude Code 推出 hooks：在工具调用前后、会话开始结束等时机执行用户脚本，可以拦截。
- 2025-10 | Claude Code 推出 plugins（打包命令、子 agent、hooks、MCP 配置、skills）和插件市场；OpenAI 推出基于 MCP 的 Apps SDK，ChatGPT 里的“插件”以新的形式回归。

**两种“插件”要分清：**2023 年的 ChatGPT Plugins 是“给模型加工具”，这个职责后来交给了 MCP；今天 harness 的 hooks / extensions 是“改变 harness 自己的行为”（拦截、改写上下文、加命令），是本章讲的东西。pi 的扩展系统属于后者，而且比多数产品开放得多：工具、命令、事件、UI 都能扩展。
:::

::: ahead 前瞻 · 本章
- [现状] 主流 coding agent 都提供了 hooks 或插件机制。第 1 章说的“针对当前模型的补丁”最适合放在这里，方便以后删掉。
- [现状] 扩展、skill、MCP server 都是可执行代码或可注入的文本，已经出现过恶意 MCP server 和工具投毒的公开案例；分发生态越大，供应链安全越重要：它们都是可执行代码或可注入的文本（第 13 章）。
- [推测] “让 agent 给自己写扩展”会更常见：pi 的 README 就鼓励“让 pi 去构建你想要的功能”。扩展 API 的稳定性和文档质量，决定了模型能不能自己扩展 harness。
:::

::: quiz
- pi 扩展的 tool_call 处理器自己抛了异常，会怎样？
  - [ ] 放行这次调用
  - [x] 拦截这次调用（fail-safe）
  - [ ] pi 崩溃
  > 安全相关的钩子坏了，宁可不执行。
:::
