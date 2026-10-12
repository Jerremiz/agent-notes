---
id: c19
toc: 速记与自测
title: 速记清单与自测
imp: aux
impLabel: 复习
done: 速记清单我能脱稿讲出来
---
### 先记骨架

::: flash
- **七个问题** 动手、上下文、状态、连接、分工、验证、防护，各来自主流模型的一条工程约束；是导航分类，不是严格划分
- **方案五个位置** 实现载体：提示词、harness 代码、模型权重；规范或交付方式：开放标准、厂商 API。两个维度，一个方案可以同时占几格
- **什么会练进模型** 能示范或能被程序判对错的行为，更有机会被训练进模型，删不删看评测；执行、状态、权限、审计留在外面
- **新词三问** 回答哪个问题？方案放在哪里？和最像的老词比换了哪个维度？
- **约束从哪来** 来源各不相同：推理接口（无状态）、架构与预算（窗口有限、前缀可复用）、训练目标（会自信地错）、输入表示（指令和数据混在一起）
- **SFT vs RL** 照示范学 vs 自己试、按分数学；写得出答案用前者，判得出好坏用后者
- **反馈 × 更新** RLHF / RLAIF / RLVR 是反馈从哪来，PPO / GRPO 是怎么更新，两个维度
- **harness 即训练环境** 所以编辑格式绑定模型，模型在训练时用惯的 harness 里往往表现更好
- **按需加载四维** 放什么、常驻还是按需、谁决定、怎么找；AGENTS.md、Skills、tool search、RAG 都在这张表里
- **一个验证器四个用处** 运行中自查、离线评测、写回 skill、训练奖励；盲区也四处共享
:::

### 再记细节

::: flash
- **Agent** LLM 在循环中自主选择并调用工具，直到完成目标
- **Workflow vs Agent** 控制流由代码决定 vs 由模型决定；能用 workflow 就别上 agent
- **Function calling** 模型输出动作请求（常见是 JSON 参数，也可以是受语法约束的文本），harness 校验、执行、回填
- **stopReason=length** 参数可能截断，整批工具调用不执行
- **错误回填** 参数错、工具失败都作为错误结果交回模型，不中断循环
- **两阶段执行** 串行做校验与审批，再并行执行，按源顺序回填
- **两层循环** 内层：工具 + steering；外层：follow-up
- **上下文五手段** 截断、渐进披露、压缩、清旧结果、子 agent
- **压缩切分** 保留最近 keepRecentTokens；永不在 toolResult 处切
- **Prompt caching** 前缀一致才命中；稳定内容在前，只追加，增量表达变化
- **edit** 文本替换防行号漂移；模糊匹配；要求唯一；按 realpath 加锁
- **截断方向** 文件保留头，命令输出保留尾；完整内容落临时文件
- **RAG vs 搜索** 经典 RAG 预建索引、固定检索，快、适合海量文档 vs 模型现场多轮搜原文，慢、贵，但能精确匹配、读到最新
- **检索管线** 切块带地址；BM25 + 向量用 RRF 合并；候选再 rerank；正确、有据、够新分开评
- **多 agent 三类失败** 分派含糊、上下文被淹没、各自完成拼不起来；完成要在“合”的那层验证
- **多 agent** 收益是隔离和并行；pi 用子进程实现
- **会话** 只追加树；compaction、context_edit 也是追加
- **崩溃恢复** turn 边界持久化；悬空写操作靠执行端认得的幂等键或查外部状态；toolCallId 本身不保证对方去重
- **插件契约** 钩子失败即拦截；状态放 details 跟随分支
- **间接注入** 读外部内容的 LLM 应用都会遇到，RAG 问答也不例外；agent 的额外风险是注入变成真实动作
- **致命三要素** 私有数据 + 不可信内容 + 对外通信，至少切一条
- **安全边界** 沙箱和权限才是边界，正则和提示词不是
- **重试分层** 只在理解语义的层重试，避免重试相乘
- **测试 vs 评测** 假模型测 harness；评测集测效果，pass@1、pass@k 与 pass^k；重置环境、固定预算、小样本别信几个点
- **三个 engineering** prompt ⊂ context ⊂ harness，逐层扩大，不是替代
- **harness 变薄？** 替模型思考的变薄，替模型做事、把关的变厚，部分转给模型和 API
- **MCP 现状** 成了基础设施；热点转向 tool search、code mode、skills，它们多在解决怎么用好 MCP
- **Skills vs MCP** skill 讲方法，MCP 给能力，互补；本地 coding agent 常用 CLI + skill
- **长时任务** 功能清单 JSON + 进度文件 + git；每个会话做一项、验证、提交
- **编辑格式** 和模型绑定（apply_patch / str_replace），多厂商 harness 按模型选
:::

::: callout 造词年表搬到了首页
名词按“回答哪个问题”归类后放在[首页的本质地图](index.html#map)里，切到“按年份”就是原来的年表。复习时先盖住每个词后面那句“本质”，自己说一遍。自测题已经分到各章末尾，读完一章就做那一章的。\
规律：**已练进模型**的多是“替模型思考”的技巧；**已成标配**的多是协议和计费机制，讨论变少恰恰说明它们已经普及；**已淘汰**的多是太重的抽象或超前于模型能力的设想。
:::

### 延伸阅读

- Anthropic：Building Effective Agents；Effective Context Engineering for AI Agents；Effective harnesses for long-running agents；Code execution with MCP
- OpenAI：Harness engineering: leveraging Codex in an agent-first world（2026-02）
- Manus：Context Engineering for AI Agents: Lessons from Building Manus（2025-07）
- MCP 2026-07-28 规范说明：[blog.modelcontextprotocol.io](https://blog.modelcontextprotocol.io/posts/2026-07-28/)；Agent Skills 规范：[agentskills.io](https://agentskills.io)
- Mario Zechner（pi 作者）：[MCP vs CLI](https://mariozechner.at/posts/2025-08-15-mcp-vs-cli/)
- METR：Measuring AI Ability to Complete Long Tasks（2025）；Chroma：Context Rot（2025）
- ReAct: Synergizing Reasoning and Acting in Language Models（2022）
- 后训练：InstructGPT（Training language models to follow instructions with human feedback，2022）；Tülu 3（2024）；DeepSeek-R1（2025）
- 检索：LightRAG（2024）；Microsoft GraphRAG（2024）
- Simon Willison：The lethal trifecta for AI agents
- MCP 规范：[modelcontextprotocol.io](https://modelcontextprotocol.io)
- pi 源码：[github.com/earendil-works/pi](https://github.com/earendil-works/pi)，重点文件见附录
