---
id: c10
toc: 状态与持久化
title: 状态、持久化与故障恢复
imp: often
q: [q3]
done: 我能设计会话存储，讲清上下文重建、恢复和幂等
---
### 基础 | 只追加的会话树

agent 任务可能跑几十分钟，期间进程会崩、会发布。会话状态要写入磁盘，常用设计是**只追加的事件日志**：每条记录带 `id` 和 `parentId`，组成一棵树。重放即可恢复；回到历史节点即可分支；完整记录可审计。点击节点，看哪些记录会发给模型：

::: widget session-tree
:::

### 进阶 | pi 的记录类型与上下文重建

| type | 内容 | 进上下文 |
|---|---|---|
| `message` | system / user / assistant / toolResult | 是 |
| `compaction` | 摘要 + firstKeptEntryId + tokensBefore | 以摘要形式 |
| `branch_summary` | 切换分支时对离开分支的摘要 | 是 |
| `context_edit` | 从后续上下文中删除或替换某条旧记录，原记录不动 | 影响其他记录 |
| `custom_message` | 扩展注入的消息 | 是 |
| `custom` `model_change` `usage` `label` | 扩展状态、模型切换、额外用量、书签 | 否 |

::: ref 沿 parentId 走出当前路径，套用最新的压缩和 context_edit，再转换成模型消息。 | core/session-manager.ts · buildContextEntries() / buildSessionContext()
- 从当前叶子沿 `parentId` 走到根，得到路径。
- 路径上如果有 compaction，取最新的一条：先放它，再放 `firstKeptEntryId` 到它之间的非 system 记录，再放它之后的记录。压缩前的 system 消息折叠进 compaction 自带的完整检查点。
- 应用每个目标的最新 `context_edit`（只影响模型看到的内容，原始记录、导出和计费不变）。
- 转换为模型消息：compaction → 检查点 + 摘要；branch_summary → 摘要消息；custom / usage → 不产生消息。

`context_edit` 是个巧妙的设计：既要“让模型忘掉某条失败的尝试”，又要保持只追加。做法是追加一条“编辑记录”，而不是修改原记录。而且它是**分支相对**的：回到编辑之前的节点，原内容又会重新可见。
:::

### 深入 | 崩溃恢复、幂等与并发

- **按 turn 边界持久化：**assistant 消息写入磁盘后再执行工具；工具结果写入磁盘后再发起下一次请求。
- **恢复时的“悬空调用”：**最后一条是带工具调用的 assistant 消息却没有结果，说明执行状态未知。只读工具直接重跑；写操作要么能安全重试（幂等，见下面的说明），要么先查询外部状态；都做不到，就回填“执行状态未知”，让模型先检查。
- **单写者：**同一会话同时只能有一个循环在跑。分布式部署用会话级锁或按会话 ID 分区的队列；运行中的新消息进 steering / follow-up 队列。
- **大对象外置：**工具输出、图片放对象存储，事件里存引用。

::: callout “用 toolCallId 幂等”要分清三样东西
**调用标识**：toolCallId 标识模型发出的这一次调用。它只在 assistant 消息先落盘、恢复时沿用同一条消息的前提下才稳定；如果消息没落盘、重新请求模型，新回复里的调用会换一个 ID。\
**业务幂等键**：交给执行端去重的键，可以由“会话 ID + toolCallId”派生。前提是**执行端认识它**：下游 API 支持幂等键（例如 `Idempotency-Key` 请求头），或者你自己的执行层把“这个键已执行”和业务副作用记在同一个事务里。\
**执行结果记录**：harness 自己写下的“执行了没有、结果是什么”，也就是 toolResult。\
失败例子：agent 调用 `create_merge_request`，Git 平台已经建好了 MR，worker 却在写入 toolResult 之前崩溃。恢复后拿同一个 toolCallId 重试，如果 Git 平台不认这个键，就会建出第二个 MR：toolCallId 只让**我们**认出这是同一次调用，没让**对方**去重。可行的做法：把幂等键写进请求本身（比如放进分支名或 MR 描述），恢复时先按键查询是否已存在；或者用 outbox 模式，先把“要执行的动作”写库，由单独的执行器负责去重并记录结果。即使这样，“副作用已发生、结果还没记下”的窗口依然存在，所以恢复逻辑必须能查询外部状态（参考 [AWS：Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)）。
:::

```sql 会话事件表（PostgreSQL） | 示意
create table session_entry (
  session_id   uuid        not null,
  seq          bigint      not null,           -- 会话内单调递增，用于断线续传和乐观并发
  entry_id     char(8)     not null,
  parent_id    char(8),                          -- 树结构
  type         text        not null,           -- message / compaction / branch_summary / context_edit …
  payload      jsonb       not null,
  created_at   timestamptz not null default now(),
  primary key (session_id, seq),
  unique (session_id, entry_id)
) partition by hash (session_id);

-- 追加时带上期望的 seq，冲突即说明有并发写者：insert … values (:sid, :expectedSeq, …)
```

:::: qa
::: q 服务挂了，agent 执行到一半，怎么恢复？会不会重复执行写操作？
- 按 turn 边界持久化，重放事件日志恢复上下文。
- 对悬空的工具调用分类处理：只读重跑；写操作用执行端认得的幂等键重试，或先查外部状态；无法确认则告诉模型。
- 更进一步可以用持久化执行框架（类似 Temporal）把每次工具调用作为可重试的活动。

> **再深一步：**为什么用只追加而不是直接更新一个 messages 数组？→ 支持分支、审计、恢复；对缓存友好；压缩和删除也用追加表达（compaction、context_edit），不丢原始数据。
:::
::::

::: ahead 前瞻 · 本章
- [现状] 状态分成两层并存：会话日志记录“对话发生了什么”，git 和项目文件记录“世界变成了什么样”。Anthropic 的长任务做法两者都用（第 9 章）。
- [现状] 只追加的事件日志是常见设计：Claude Code、Codex CLI、pi 的会话文件都是 JSONL 事件流，都支持恢复会话（见 [Claude Code 文档](https://code.claude.com/docs/en/how-claude-code-works)、Codex 源码 [`rollout/src/recorder.rs`](https://github.com/openai/codex/blob/8c0f7011674145da7e10627769fb221c74fbf7a0/codex-rs/rollout/src/recorder.rs)、pi 的 `docs/session-format.md`）。
- [推测] Temporal 这类持久化执行框架会更多地用来承载 agent：每次模型调用和工具调用都是可重试、可恢复的活动，等审批时不必占着 worker（沙箱等资源怎么保留，见第 17 章）。
- [有争议] 状态放客户端还是厂商服务端（第 3 章）。个人工具倾向客户端；托管平台倾向服务端。
:::

::: quiz
- 服务崩溃后恢复，发现一个写操作工具调用没有结果记录，最稳妥的是？
  - [ ] 直接重执行
  - [x] 用执行端认得的幂等键重试，或先查外部状态
  - [ ] 丢弃会话
  > 写操作执行状态未知，必须防重复副作用。toolCallId 可以用来派生幂等键，但下游不认这个键，重试照样会重复执行；所以恢复时往往要先查外部状态。
:::
