---
id: c15
title: 测试与评测
imp: often
q: [q6]
done: 我能分别设计 harness 的单测和 agent 的评测
---
### 基础 | 两件不同的事

- **测试 harness 本身**（确定性）：循环、工具、会话恢复、钩子在各种模型输出下是否表现正确。用假的模型。
- **评测 agent 的效果**（非确定性）：在真实模型下任务完成得怎么样。用评测集。

### 进阶 | 用脚本化的假模型做确定性测试

::: ref 用预先编排好回复的假模型，确定性地测试循环的各种边界情况。 | packages/ai · Faux Provider for Tests
```ts fauxProvider | ai/README.md
const faux = fauxProvider({ tokensPerSecond: 50 });
const models = createModels();
models.setProvider(faux.provider);

faux.setResponses([                                          // 预先编排模型的每一次回复
  fauxAssistantMessage([
    fauxThinking('Need to inspect package metadata first.'),
    fauxToolCall('echo', { text: 'package.json' }),
  ]),
  // … 下一轮的回复 …
]);
```

有了它，就能确定性地测试“模型返回截断的工具调用时不执行”“工具抛异常后循环继续”“steering 消息在正确的位置注入”这类边界情况，还能控制输出速度来测流式和中止。这也是第 4 章说“钩子注入让循环可测试”的具体做法。
:::

```java Java 里的等价做法 | JUnit 5 · 示意
@Test
void truncatedToolCallIsNotExecuted() {
    var llm = ScriptedLlm.of(
        assistant(LENGTH, toolCall("bash", "{\"command\":\"rm -rf")),   // 被截断的参数
        assistant(STOP, text("done")));
    var bash = spy(new BashTool());
    new AgentLoop(llm, Map.of("bash", bash), ToolGuard.allowAll()).run(session, "clean up", CancelToken.none());
    verify(bash, never()).execute(any(), any());
    assertThat(session.last(2).get(0)).isToolError();
}
```

### 深入 | 评测集的设计

| 评什么 | 怎么评 |
|---|---|
| 最终结果 | 能程序判定就程序判定：跑隐藏测试（SWE-bench 的做法）、核对数据库状态 |
| 轨迹 | 是否调用了该调用的工具、参数是否正确、有无危险操作（“退款前必须先查订单”） |
| 开放式输出 | LLM 当评委，给明确评分标准，定期用人工标注校准 |
| 效率 | token、费用、turn 数、耗时 |

- **非确定性：**每个用例跑多次。pass@1（单次成功的概率，用多次运行的平均成功率估计）是最基本的数字；pass@k（k 次里至少成功一次）衡量能力上限；pass^k（k 次全部成功）衡量稳定性，τ-bench 用的就是这个思路，生产更关心后者。
- **让数字可比：**每次运行前把环境重置到同一个初始状态（仓库、数据库、沙箱），否则上一次的残留会影响下一次；比较两个版本时固定模型、温度、最大轮数和 token 预算；调提示词用的任务和最后报告成绩的任务分开，否则成绩会虚高。
- **小样本会抖：**20 个任务里多做对 1 个就是 5 个百分点。20 个任务各跑 3 次适合练手、发现明显问题，但撑不起“提升了 3 个点”这种结论：要么加任务、加次数，要么看同一批任务上逐题的成败变化，并报告波动范围（参考 [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)）。
- **LLM 评委的偏差：**偏好更长的回答、位置偏差、偏好同家模型。缓解：具体评分标准、成对比较时交换顺序、换模型当评委、和人工标注算一致性。
- **来源：**线上真实失败案例最有价值，再加人工构造的边界情况和公开基准（SWE-bench、Terminal-Bench、τ-bench）。
- **进 CI：**改提示词、换模型、改工具都跑回归，像单元测试一样。
- **读基准成绩时，harness 也是被测对象。**Terminal-Bench 这类基准测的是“模型 + harness”的组合，同一个模型在不同 harness 里能差十几个百分点；很多榜单成绩是各家用自己的 harness 跑出来的。比较模型要在同一个 harness 下比，比较 harness 要在同一个模型下比。
- **消融评测：**换模型时，逐个关掉提示里的提醒、规划步骤、额外工具，看成绩是否下降。不下降就删，这是让 harness 跟着模型“变薄”最可靠的办法（第 1 章）。

::: callout 同一个验证器，四个用处
判定“做对了”的程序（隐藏测试、状态检查、评分标准），在 agent 运行时是自我检查，在这里是评测，写回文件时决定哪条经验值得留（第 9 章），在厂商那里是强化学习的奖励（第 2 章）。所以它的盲区也会出现在四个地方：只看最终答案的检查，会放过过程错误的解；只看测试通过的检查，会放过改了测试本身的“修复”。设计评测时先问：**有没有办法在不完成任务的情况下拿到分？**
:::

### 深入 | RAG 和检索的评测

检索类系统要分三层评：找没找到、用没用对、划不划算。三层分开测，出问题才知道该改哪一环。

| 评什么 | 指标 | 说明 |
|---|---|---|
| 找全了吗 | Recall@k、Precision@k | 标注好每个问题的相关段落，看前 k 条里命中多少 |
| 排得好吗 | MRR、NDCG | 有用的证据是否排在前面；NDCG 还能区分“完全相关”和“部分相关” |
| 多跳问题 | All-Recall | 需要三段证据才能回答时，少一段就算没找到 |
| 答对了吗 | 归一化后比对、LLM 评委 | “11 月 27 日 17:00”和“27 号下午五点”要先归一化再比 |
| 有依据吗 | 忠实度（faithfulness） | 答案是否被引用的出处支持 |
| 依据新吗 | 出处版本 | 忠实于去年的旧文件，答案照样是错的。正确、有依据、够新要分开检查 |
| 划算吗 | 建索引成本、查询延迟、每问费用 | GraphRAG 的建图成本尤其要单独记 |

常见误读：论文里“A 方法对 B 方法的胜率 80%”往往是 LLM 评委的偏好，不等于事实准确率提高了 80%。

::: term swebench | 基准被做到饱和的速度越来越快，衡量方式从“做对几道题”扩展到“能完成多长的任务”
- 2023-10 | SWE-bench：用真实 GitHub issue 和隐藏测试评测 coding agent，最初最好成绩只有个位数百分比。
- 2024-06 | τ-bench：模拟客服场景，提出 pass^k 衡量稳定性。
- 2024-08 | SWE-bench Verified：人工筛选出 500 道可解的题。之后两年里头部成绩快速攀升、趋于饱和，头部系统之间的分差越来越小，这个基准越来越难区分它们。比较时还要看是不是同一个 harness、同样的预算和设置。
- 2025-03 | METR 提出“时间跨度”：agent 能以 50% 成功率完成的任务，相当于人类专家要干多久。这个数大约每 7 个月翻一番。
- 2025 | Terminal-Bench（5 月，2.0 版 11 月）测终端里的综合任务；SWE-bench Pro（9 月）用更难、防污染的题替代饱和的 Verified。

**规律：**一个基准从发布到饱和通常只要一两年，所以不要背具体分数，要理解每个基准测的是什么、有什么偏差。自己业务的评测集永远比公开榜单更有用。
:::

:::: qa
::: q 怎么知道你的 agent 变好了？
- harness 逻辑用脚本化假模型做确定性单测。
- 效果用评测集：结果 + 轨迹 + 效率，每次运行前重置环境、固定预算，多次运行看 pass@1、pass@k 和 pass^k；样本小时别把几个点的差异当结论。
- LLM 评委要有标准并校准。
- 接 CI 回归；线上结合用户反馈和 A/B。
:::
::::

::: ahead 前瞻 · 本章
- [现状] SWE-bench Verified 已接近饱和，更难的基准（SWE-bench Pro、Terminal-Bench 2.0）和新的尺子（METR 时间跨度、pass^k）在接替。
- [现状] 评测是 harness 变薄的前提：没有评测，就不知道哪段脚手架可以删。
- [推测] 验证会成为瓶颈：agent 产出代码的速度远超人 review 的速度，自动验证（测试、类型检查、浏览器端到端、LLM 审查）在 harness 里的比重会继续上升。
:::

::: quiz
- pass^k 衡量的是？
  - [ ] k 次中至少成功一次（能力上限）
  - [x] k 次全部成功（稳定性）
  - [ ] 平均成本
  > 生产环境更关心稳定性。前者是 pass@k；单次成功率是 pass@1。
:::
