---
id: c16
toc: MCP 与工具生态
title: MCP 与工具生态：从热门话题到基础设施
imp: plus
q: [q4, q2]
done: 我能讲清 MCP 的价值、风险、现状，以及它和 skills、code mode、CLI 的关系
---
### 基础 | MCP 是什么

**MCP（Model Context Protocol）**是 Anthropic 在 2024 年底推出的开放协议，把外部工具和数据标准化地接入 agent。以前每个 agent 要为每个系统各写一套集成（M×N），有了 MCP，系统实现一次 server，所有支持 MCP 的 agent 都能用（M+N）。

- host 里的 MCP client 连接 MCP server，基于 JSON-RPC 2.0。
- 传输：本地 stdio（启动子进程），远程 Streamable HTTP。
- server 提供 tools（函数）、resources（数据）、prompts（模板）。

::: analogy Java 类比
MCP ≈ JDBC。JDBC 刚出来时是热门话题，现在没人讨论 JDBC，但每个 Java 应用都在用。没人讨论不等于过时，往往意味着它**成了默认的接入方式**。
:::

::: term mcp | 讨论变少是因为它已经普及，讨论转移到了“怎么把它用省” {open}
- 2024-11 | Anthropic 发布 MCP，配套 Claude Desktop 和一批参考 server。最初主要是本地 stdio。
- 2025-03 | 规范加入 Streamable HTTP 和 OAuth 授权，开始支持远程 server。同月 OpenAI 宣布支持 MCP，这是它成为事实标准的转折点。
- 2025-04/05 | Google、Microsoft 跟进；同时安全研究者公开演示“工具投毒”。各类 MCP server 目录涌现，热度达到顶峰。
- 2025-08 | 反思开始：工具定义全量进上下文，接几个大型 server 就占掉几万 token；pi 的作者写了《MCP vs CLI》，认为很多 MCP server 只是给 CLI 套了一层很薄的封装。
- 2025-09 → 11 | Cloudflare 提出 Code Mode，Anthropic 发表《Code execution with MCP》（一个示例流程从约 15 万 token 降到约 2 千）并推出 Tool Search 和 Programmatic Tool Calling：**不再把所有 MCP 工具定义直接塞给模型**。
- 2025-10 | Anthropic 推出 Skills，社区开始说“skills 可能比 MCP 更重要”；同月 OpenAI 的 Apps SDK 建立在 MCP 之上。
- 2025-12 | Anthropic 把 MCP 捐给 Linux Foundation 下新成立的 Agentic AI Foundation（AAIF，与 OpenAI、Block 共同发起）。
- 2026-初 | MCP Apps 扩展：server 可以返回交互式界面。2 月“MCP 已死，CLI 万岁”的文章引发一轮争论。
- 2026-07 | 2026-07-28 版规范：协议核心改为**无状态**，可以直接挂在负载均衡后面；弃用 Roots、Sampling、Logging；工具列表可缓存且顺序确定；授权加固；Tasks、MCP Apps、企业托管授权改为正式扩展。
:::

### 进阶 | 为什么现在不怎么讨论了：过时了吗

**没有过时。**热度下降有三个原因，只有一个是坏消息：

1. **它成了基础设施。**主流模型厂商、IDE、桌面客户端都已支持，治理交给中立基金会，规范在按部就班地迭代。剩下的话题是部署、鉴权、网关、审计，这些在企业平台团队里讨论，不在社交媒体上。
2. **热点转移了。**2025 年下半年起，大家的注意力转向 context engineering、skills、code mode、harness engineering。这些新词大多是在**解决“怎么把 MCP 用好”**，而不是替换它。
3. **它暴露了真实缺陷（这是坏消息）。**最大的问题是上下文成本：传统做法把所有工具定义在会话开始时塞进上下文，接几个 server 就占掉几万 token。其次是安全（工具描述可以藏注入、本地 server 以你的权限运行）和早期设计偏重（有状态会话难以横向扩展）。

这三个缺陷都有了回应：上下文成本靠 tool search 和 code mode 缓解，状态问题靠 2026-07 的无状态规范处理，安全问题仍然要靠第 13 章的沙箱和权限。

**它真正失去的阵地是“有 shell 的本地 coding agent”。**模型天生会用 `git`、`gh`、`curl`、`jq`，训练数据里有大量用法；写一个 CLI 加一份 README（或一个 skill），比起一个本地 stdio MCP server 更省上下文、能用管道组合。pi 早期就不内置 MCP，靠扩展桥接（本手册对照的 2026 年 10 月版本已内置 MCP 支持，`pi mcp add`）。但在**没有 shell 的场景**（网页版和手机上的聊天助手、多租户 SaaS 后端），以及需要**统一鉴权、审计、分发**的企业场景，远程 MCP 仍然是主流。

### 进阶 | 和新东西之间是什么关系

| 相关的词 | 它解决什么 | 和 MCP 的关系 |
|---|---|---|
| Function calling | 模型怎么表达“我要调用工具” | **下层。**MCP 工具最终都转成工具定义交给模型（第 3 章） |
| Tool search / 按需加载 | 工具太多占上下文 | **改变暴露方式。**工具仍来自 MCP，只是定义不再全量进上下文 |
| Code mode / 代码执行 | 多次调用的中间结果占上下文 | **改变调用方式。**MCP 工具被包装成代码 API，模型写脚本批量调用，只有结果进上下文 |
| Skills | 模型不知道某类任务该怎么做 | **互补。**skill 讲方法，MCP 给能力；skill 里可以指定用某个 MCP 工具或 CLI |
| CLI + bash | 同样是“让 agent 能操作外部系统” | **部分替代。**在有 shell 的 coding agent 里替代了很多本地 MCP server |
| A2A | agent 之间协作 | **不同层。**MCP 连工具，A2A 连 agent（第 11 章） |
| AGENTS.md | 项目规则放哪 | **无关但同门。**同属 AAIF 管理的开放标准 |
| ChatGPT Plugins → Apps SDK → MCP Apps | 第三方给助手加能力和界面 | **前身与延伸。**2023 年的插件停用，2025 年的 Apps SDK 直接建在 MCP 上，2026 年并入 MCP 成为 MCP Apps 扩展 |

**风险**不因热度下降而消失：第三方 server 返回的内容是不可信输入；工具描述本身可能藏注入；本地 stdio server 以你的权限运行；远程 server 的凭据要妥善管理。

### 深入 | 工具太多怎么办：暴露方式

::: ref 工具有五种暴露方式：直接可见、搜索后激活、只能在代码里调用、只给模型、隐藏。 | docs/extensions.md · Tool exposure · docs/codemode.md
| exposure | 模型能否直接看到 | 用途 |
|---|---|---|
| `direct` | 能（默认） | 常用工具 |
| `deferred` | 不能，需 `tool_search` 找到并激活 | 大量低频工具，按需加载 |
| `codemode` | 不能，只能在 codemode 脚本里调用 | 批量调用、过滤大结果 |
| `model-only` | 能，但不能被其他工具调用 | 编排其他工具、或需要问用户的工具 |
| `hidden` | 不能 | 撤回工具（工具无法注销，只能隐藏） |

- **codemode：**模型写一段 JavaScript，在 QuickJS 沙箱里调用其他工具（无文件系统、网络、定时器），可以并行调用、过滤大结果，**只有脚本输出进入上下文**。这是“用代码执行替代大量工具调用”的思路。
- MCP 的工具标注（`readOnlyHint`、`destructiveHint`、`idempotentHint`、`openWorldHint`）可以被权限扩展当作“哪些调用需要确认”的参考；缺省值按最保守的假设处理（可能有破坏性、可能与外部世界交互；`openWorldHint` 说的是工具会不会碰到外部实体，不是网络权限开关）。但它们只是 server 自报的提示（hint），不是保证：恶意 server 可以把删除操作标成只读。不可信来源的标注不能用来放宽权限，真正的限制要靠沙箱和权限系统执行。
:::

**2026-07 规范的工程含义：**新规范去掉了初始化握手和会话 ID，每个请求自带协议版本和客户端能力，服务端需要的状态改为“工具返回一个句柄，模型在后续调用里传回来”。这和第 10 章的设计原则一致：**状态显式化，服务无状态，才能横向扩展**。弃用 Sampling（server 反过来调用模型）和 Roots，说明早期一些“看起来很强大”的设计在实践中用得很少，被收回了。

:::: qa
::: q MCP 现在没人讨论了，是不是过时了？
- 没有过时，是变成了基础设施：主流厂商都支持，Linux Foundation 治理，2026-07 发布了面向大规模部署的无状态规范。
- 热点转移到 skills、code mode、harness engineering，而这些大多在解决“怎么用好 MCP”。
- 真实的退让：有 shell 的本地 coding agent 里，CLI + skill 替代了很多本地 MCP server；但无 shell 场景和企业集成仍以远程 MCP 为主。

> **再深一步：**工具定义太占上下文怎么办？→ 按需加载（tool search / deferred），或 code mode（工具变成代码 API，只有脚本输出进上下文），或改用 CLI + skill。pi 的 exposure 机制同时提供了前两种。
:::
::: q 给一个内部系统做 agent 集成，用 MCP、CLI 还是 skill？
- 只给开发者在本地 coding agent 里用：CLI + skill（或 README）最省事、最省上下文。
- 要给网页助手、多个团队、不同客户端用，需要统一鉴权和审计：远程 MCP server。
- 操作有固定的最佳实践：再配一个 skill，写清楚步骤和注意事项。
- 三者不冲突，常见的组合是“MCP 或 CLI 提供能力，skill 提供用法”。
:::
::::

::: ahead 前瞻 · 本章
- [现状] MCP 是远程工具和企业系统接入 agent 最常用的协议；2026-07-28 版规范朝无状态、可缓存、强鉴权的方向改，面向大规模部署。
- [现状] 工具多时，定义可以不再全量进上下文：按需加载和代码执行已是多家厂商 API 提供的能力。
- [推测] 本地 coding agent 更多使用 CLI + skills，MCP 主要出现在远程和企业集成里。
- [有争议] agent 之间的协议（A2A，以及 MCP 自己路线图上的 agent 间通信和身份）能否在开发者侧流行起来。目前主要在大型企业平台里使用。
:::

::: quiz
- MCP 近来讨论变少，最准确的解释是？
  - [ ] 已被 skills 取代，不再使用
  - [x] 成了基础设施，热点转向怎么用好它（tool search、code mode 等）
  - [ ] 被 A2A 取代
  > 主流厂商都支持、Linux Foundation 治理、2026-07 发布无状态规范。真正让出的阵地是有 shell 的本地 coding agent。
- Skills 和 MCP 的关系是？
  - [ ] skill 是 MCP 的新版本
  - [x] 互补：skill 讲怎么做，MCP 提供能连接什么
  - [ ] 二者只能选一个
  > skill 里可以写“用这个 MCP 工具或 CLI 完成某一步”。
:::
