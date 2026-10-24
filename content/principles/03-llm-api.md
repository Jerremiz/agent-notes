---
id: c3
toc: LLM 调用与工具调用
title: LLM API 与 Function Calling
imp: must
q: [q1]
done: 我能讲清工具调用的往返、stop reason 和异常处理
---
### 基础 | 一次带工具调用的往返

```js 通用形态（已简化，字段名取自 pi-ai） | 示意
// → 请求：system + 工具定义 + 历史
{ "systemPrompt": "You are an expert coding assistant…",
  "tools": [{ "name": "read", "description": "Read file contents",
              "parameters": { "type": "object", "properties": { "path": { "type": "string" } }, "required": ["path"] } }],
  "messages": [{ "role": "user", "content": "pom.xml 里用了哪些依赖？" }] }

// ← 响应：模型没有回答，而是请求调用工具
{ "role": "assistant", "stopReason": "toolUse",
  "content": [{ "type": "toolCall", "id": "call_1", "name": "read", "arguments": { "path": "pom.xml" } }] }

// → 下一次请求：全部历史 + 工具结果
{ "role": "toolResult", "toolCallId": "call_1", "toolName": "read",
  "content": [{ "type": "text", "text": "<project>…</project>" }], "isError": false }
```

- **模型不执行任何东西。**它按训练学到的格式输出工具名和 JSON 参数，执行的是 harness。
- **无状态。**每次请求都把完整历史重发，“记忆”是 harness 拼出来的。
- **模型靠名字和描述选工具。**描述写得不清，就会选错或填错参数。

::: term fc | 不是没人讨论了，是变成了多数工具协议的底层形态
- 2023-06 | OpenAI 在 GPT-4 / 3.5 上推出 function calling，模型第一次被专门训练输出“工具名 + JSON 参数”。
- 2024-05 | Anthropic tool use 正式可用；各家格式大同小异，都是 JSON Schema 描述工具。
- 2024-08 | OpenAI 推出 Structured Outputs（严格按 schema 约束解码），其他厂商陆续跟进。
- 2025 | 推理模型把思考和工具调用交织在一起（先想、调工具、看结果、再想），工具调用从“一问一答”变成连续动作。

**和新词的关系：**MCP、tool search、code mode 大多建立在它之上：MCP 决定工具从哪来，tool search 决定什么时候把定义给模型，code mode 让模型用代码批量调用，落到模型面前的通常仍是一次工具调用（第 16 章）。**但 JSON 只是最常见的表达，不是唯一的：**OpenAI 的 custom tools 允许工具接收自由文本，并可以用语法（Lark、正则）约束格式，适合补丁、SQL 这类本来就不是 JSON 的输入（[官方文档](https://developers.openai.com/api/docs/guides/function-calling)）。更稳的抽象是一个闭环：**模型提出动作请求，运行时校验并执行，再把结果回传**；用 JSON、自由文本还是代码来表达请求，是可以变的那一层。
:::

### 进阶 | stop reason、流式与错误

| stopReason | 含义 | harness 该做什么 |
|---|---|---|
| `stop` | 模型说完了 | 结束本次运行 |
| `toolUse` | 要调用工具 | 执行工具，回填结果，继续循环 |
| `length` | 达到最大输出 token | 工具参数可能被截断，**不能执行** |
| `error` | 请求出错 | 按错误类型重试或结束（第 14 章） |
| `aborted` | 被取消 | 保留已收到的部分，结束 |
| `pending` | 仅出现在流式的中间状态 | 等待 |

- **流式事件：**响应以 SSE 逐块到达，统一成 `text_delta`、`thinking_delta`、`toolcall_delta`、`toolcall_end` 等事件。
- **流式中的工具参数是半截 JSON。**界面想提前显示“正在写入 X 文件”，就要做“尽力而为”的增量解析；真正执行必须等 `toolcall_end` 拿到完整参数，并经过 schema 校验。
- **参数不合法**（缺字段、类型错、调了不存在的工具）时，不要抛异常中断任务，把错误作为 `isError` 的工具结果返回，模型通常下一轮就能改对。
- **推理块要原样回传。**推理模型在调用工具前会先输出思考内容（Anthropic 是带签名的 thinking 块，OpenAI 是可加密的 reasoning item）。在工具调用的往返中，harness 必须把这些块原样放回下一次请求，否则模型会丢掉推理过程，有的厂商会直接拒绝请求。这也是“跨厂商切换”难的根源（见下）。
- **思考预算是一个参数。**现在的模型大多可以调思考强度（effort / thinking budget）。harness 可以按任务难度设置：简单的格式化用低档，排查疑难问题用高档。它影响成本、延迟，有时还影响缓存键（第 6 章）。

::: ref 错误是值不是异常；流式的半截参数只用来展示；被截断的工具调用整批判为失败。 | packages/ai/README.md · Error Handling / Streaming Tool Calls
- **错误是值，不是异常。**流一旦建立就不会 throw：出错时发出 `error` 事件，最终消息的 `stopReason` 为 `"error"` 或 `"aborted"`，并保留已收到的部分内容和 token 用量。上层只需看 stopReason 分支，不需要到处 try/catch。
- **半截参数：**`toolcall_delta` 期间 `arguments` 是对不完整 JSON 的尽力解析，至少是 `{}`；文档特别提醒字段可能缺失、字符串可能截断在半个词。
- **截断的调用不执行：**agent-loop 遇到 `stopReason === "length"` 会调用 `failToolCallsFromTruncatedMessage`，把这条消息里的工具调用全部判为失败。
:::

### 深入 | 约束解码与跨厂商切换

- **约束解码（constrained sampling）：**部分厂商支持在解码时强制输出符合 JSON Schema，参数就不会不合法。代价是不是所有模型都支持，schema 也有限制（例如要求 `additionalProperties: false`）。
- **跨厂商切换：**同一个会话中途换模型（比如主模型故障降级），历史消息要能被另一家理解。难点在各家私有的内容块，比如推理过程（thinking）。

::: ref 能用严格模式就用，不支持就退回普通调用；换了模型就丢掉之前的 thinking 块。 | packages/ai · Constrained Sampling / Cross-Provider Handoffs
```ts 工具声明约束解码 | ai/README.md
const strictTool: Tool = {
  name: 'edit_file',
  description: 'Edit a file',
  parameters: Type.Object({ path: Type.String(), content: Type.String() }, { additionalProperties: false }),
  constrainedSampling: { type: 'json_schema', strict: 'prefer' }   // 'require' 时不支持的模型直接报错
};
```

- `strict: 'prefer'`：支持就用厂商的严格模式，不支持就退回普通工具调用。这是“能力探测 + 优雅降级”的典型写法。pi 内置的 read / bash / edit / write 都声明了 `strict: "prefer"`。
- 切换模型时：同一厂商、同一 API、同一模型产生的 assistant 消息原样保留，包括 thinking 块；换了模型，之前的 thinking 块直接丢掉，文本和工具调用保持不变。理由有两条：签名和加密的推理只对产生它的模型有效；把可读的思考转成普通文本发给新模型，新模型会把它当成回复的一部分。早期版本的做法是把 thinking 转成带 `<thinking>` 标签的文本，后来改掉了。
:::

**无状态 API 还是有状态 API。**上面讲的都是无状态调用：每次把完整历史发过去。厂商也提供了有状态的选择，比如 OpenAI 的 Responses API 可以只传 `previous_response_id`，历史存在服务端；还可以直接用服务端工具（网页搜索、代码执行），工具在厂商那边执行完再把结果交给模型。这等于把一部分 harness 搬到了厂商那里。

- **好处：**少传数据、少写代码，服务端工具开箱即用。
- **代价：**状态在别人手里，换厂商、审计、离线回放、合规都变难。coding agent 这类需要分支、恢复、跨厂商降级的场景，主流做法仍是客户端保存全部状态。pi 也是这样。

::: term assistants | “托管 agent”的第一次尝试，2026 年 8 月停用，被 Responses API 取代
- 2023-11 | OpenAI 推出 Assistants API：thread、run、内置检索和代码解释器，状态全托管。
- 2025-03 | 推出 Responses API：保留服务端工具和可选的服务端状态，但调用模型回到简单的“一次请求一次响应”。
- 2025-08 | 宣布 Assistants API 弃用，一年后（2026-08）停止服务。

**教训：**把循环、状态、检索全包进黑盒的抽象太重了，开发者需要能控制每一轮。后来的主流形态是“底层给原语，控制权交还开发者”：Responses API 的服务端工具仍可在一次请求里连续执行，但调用自己的函数时，每一轮由客户端驱动。这和第 1 章的 workflow / agent 之争、和 2023 年 LangChain 的降温是同一类教训。
:::

:::: qa
::: q Function Calling 的原理是什么？
- 模型经过训练，能按特定格式输出工具名和参数；工具 schema 由 API 服务端注入到提示中。
- harness 解析输出、校验参数、执行、把结果作为 toolResult 回填，再发起下一次请求。
- 本质是“模型提出请求、程序执行、结果回填”的协议，模型没有执行能力。

> **再深一步：**怎么保证参数一定合法？→ 约束解码 + harness 侧 schema 校验双保险；约束解码不可用时，靠校验失败后的错误回填让模型自纠。
:::
::: q 流式输出时，工具参数还没收完，界面想先展示怎么办？
- 对不完整 JSON 做容错的增量解析，只用于展示，字段要逐个判空。
- 执行前必须等完整参数并重新校验，绝不能拿半截参数执行。
- 如果最终 stopReason 是 length，整批调用作废。
:::
::::

::: ahead 前瞻 · 本章
- [现状] “JSON Schema 描述参数 + 模型输出结构化调用”是目前各家 API 最常见的形态；同时也出现了自由文本加语法约束的工具，JSON 不是唯一表达。
- [现状] 主流推理模型把推理和工具调用交织在一起，厂商文档要求 harness 原样保存和回传推理块。
- [推测] “模型提出动作请求 → 运行时校验、执行、回传”这个闭环会长期稳定；请求的表达形式（JSON、受语法约束的文本、代码）和上层的发现、批量调用方式还会继续变。
- [推测] 厂商会提供更多服务端工具和托管能力。harness 要做的选择是：哪些交给厂商省事，哪些必须握在自己手里（状态、权限、审计）。
:::

::: quiz
- 推理模型在工具调用往返中输出的思考块，harness 应该怎么处理？
  - [ ] 丢掉，省 token
  - [x] 原样放回下一次请求
  - [ ] 改写成摘要再放回
  > 模型是在带着思考继续的轨迹上训练的；丢掉会丢推理过程，有的厂商会直接拒绝请求。
- 模型回复因 max tokens 被截断，里面有工具调用。正确做法？
  - [ ] 照常执行
  - [ ] 补全 JSON 后执行
  - [x] 不执行，返回错误
  > 参数可能不完整。pi 用 failToolCallsFromTruncatedMessage 把整批判为失败。
- 下面哪个说法最准确？
  - [ ] 工具调用只能用 JSON Schema 描述参数
  - [x] JSON 参数最常见，但也有自由文本加语法约束的工具；不变的是“请求 → 运行时校验执行 → 回传结果”的闭环
  - [ ] 模型自己执行工具
  > OpenAI 的 custom tools 就允许自由文本输入，并可用 Lark 语法或正则约束格式。
:::
