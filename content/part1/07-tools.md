---
id: c7
title: 工具设计与实现
imp: often
q: [q1]
done: 我理解 edit 的匹配规则、两种截断方向和并发写保护
---
### 基础 | 设计原则（ACI）

工具是模型的 API。SWE-agent 论文（2024）把它叫作 ACI（Agent-Computer Interface），Anthropic 在《Building Effective Agents》里沿用了这个说法。它值得像设计对外 API 一样用心：

- **少而通用：**coding agent 有 read、write、edit、bash 就能做几乎所有事。工具越多越容易选错，定义本身也占上下文。
- **描述写给模型：**做什么、什么时候用、什么时候不用、参数含义。
- **错误是反馈：**告诉模型错在哪、怎么改。
- **防呆：**让模型不容易犯错。
- **控制输出体积：**默认截断，告诉模型完整输出在哪。
- **标注副作用：**只读、破坏性、幂等、是否与外部世界交互，供权限系统参考。

| pi 内置工具 | 参数 | 默认启用 |
|---|---|---|
| `read` | `path`, `offset?`, `limit?` | 是 |
| `bash` | `command`, `timeout?`（秒） | 是 |
| `edit` | `path`, `edits: [{oldText, newText}]` | 是 |
| `write` | `path`, `content` | 是 |
| `grep` `find` `ls` | …（grep、find 遵守 .gitignore；ls 不过滤） | 否 |
| `powershell` | …（仅原生 Windows） | 否 |

### 进阶 | edit：为什么用文本替换，怎么防呆

用行号修改会遇到“行号漂移”：第一处修改增加了 3 行，第二处的行号就错了。用“旧文本 → 新文本”替换，位置由内容决定，不受影响。但它有两个新问题：模型复述的旧文本和文件不完全一致（空格、引号），以及旧文本在文件中出现多次。试试 pi 的处理方式：

::: widget edit-match
:::

::: ref 先精确匹配，再做归一化后的模糊匹配；出现多次就报错，要求给出能唯一定位的文本。 | coding-agent/src/core/tools/edit-diff.ts · fuzzyFindText()
- 先精确匹配；找不到再做**模糊匹配**：Unicode NFKC 归一化、去掉每行行尾空白、弯引号转直引号、各种破折号转 `-`、特殊空格转普通空格。
- 出现多次就报错，并明确要求“提供更多上下文使其唯一”。
- 多处修改放在一次调用的 `edits[]` 里，每个 oldText 都对**原始文件**匹配，不能重叠，然后一次性应用。
- 替换后内容没变也报错：这通常意味着特殊字符问题，提示模型检查。
:::

**编辑格式和模型是绑定的。**厂商会在自家 harness 的工具上做强化学习，于是模型对某种编辑格式特别熟练：OpenAI 建议 GPT 系列和 Codex 模型使用 `apply_patch`（一种类 diff 的补丁格式），Anthropic 的模型则针对 `str_replace` 式的文本编辑工具训练过。同一个模型换一种它不熟悉的编辑格式，出错率会明显上升。

所以支持多厂商的 harness 要考虑**按模型选工具格式**，而不是全部用一种。这是第 2 章“harness 也是训练环境”带来的直接后果。

### 进阶 | 动作接口的精度光谱

同一件事，可以通过精度不同的几种接口去做。比如“把图表导出成 PNG”：

| 接口 | 模型做什么 | 优点 | 代价 |
|---|---|---|---|
| GUI（computer use） | 看截图 → 点坐标 → 再看截图 | 任何有界面的软件都能用 | 慢、费 token（每步一张图）、容易点错 |
| CLI | `export --format png --output fig.png` | 精确、可组合、模型训练时见过大量用法 | 软件得有命令行；要读退出码和错误输出 |
| API / 函数调用 | 输出带 JSON 参数的调用 | 参数可校验，可做权限标注 | 要有人先写好工具定义 |
| 代码（code mode） | 写一段脚本批量调用 | 中间结果不进上下文 | 需要沙箱执行代码（第 16 章） |

原则：**能用更精确的接口，就不用更模糊的**。GUI 留给没有任何接口的软件。也有项目反过来，给只有界面的软件自动生成一层命令行，让 agent 能走 CLI。无论走哪种接口，最后都要检查结果：退出码、输出、生成的文件，或者再截一张图确认。

::: term computeruse | 能看屏幕、点鼠标的 agent；有接口时优先走接口
- 2024-10 | Anthropic 推出 computer use：模型看截图，输出鼠标和键盘动作。
- 2025-01 | OpenAI 推出 Operator，在浏览器里替用户操作网页。
- 2025–26 | OSWorld 等基准用来衡量这类能力；coding agent 则普遍选择 CLI 和浏览器自动化脚本，而不是像素级点击。

**和其他词的关系：**它和 function calling、CLI 回答的是同一个问题：输出怎么变成动作。区别只在接口精度。点击类操作同样需要“确认后再执行”这类护栏（第 13 章）。
:::

### 深入 | 截断策略、进程树与并发写

::: ref 读文件保留开头、命令输出保留结尾；超时杀整个进程树；同一文件的修改排队执行。 | tools/truncate.ts · tools/bash.ts · tools/file-mutation-queue.ts
- **截断方向不同：**上限是 2000 行或 50KB，先到为准，一般按整行截断（例外：bash 输出的最后一行本身就超过字节上限时，只保留这一行的末尾，并标明是半行）。read 用 `truncateHead`（保留开头，模型可以用 offset 接着读）；bash 用 `truncateTail`（保留结尾，因为编译错误、测试失败、退出信息都在最后）。bash 被截断时，完整输出写入临时文件，结果里告诉模型路径和起始行号。
- **杀进程树：**bash 在非 Windows 上以 `detached` 启动成独立进程组；超时或用户中止时调用 `killProcessTree(pid)`，连同所有子进程一起结束。超时没有默认值，由模型按需传入。
- **同文件串行、不同文件并行：**并行执行的两个 edit 如果改同一个文件，会出现“读-改-写”竞争，后写的覆盖先写的。`withFileMutationQueue` 按文件的 **realpath**（解析符号链接，防止两条路径指向同一文件）维护一条 Promise 链，同一文件的操作排队，队列清空后删除 key 防止内存泄漏。
:::

```java 同样的思路，用 Java 实现 | 示意
final class FileMutationQueue {
    private final ConcurrentHashMap<Path, ReentrantLock> locks = new ConcurrentHashMap<>();

    <T> T withLock(Path file, Callable<T> op) throws Exception {
        Path key = realPathOrAbsolute(file);                // 符号链接指向同一文件时必须用同一把锁
        ReentrantLock lock = locks.computeIfAbsent(key, k -> new ReentrantLock(true));  // 公平锁 = 按到达顺序
        lock.lock();
        try { return op.call(); }                     // 完整的 读 → 改 → 写 都在锁内
        finally {
            lock.unlock();
            if (!lock.hasQueuedThreads()) locks.remove(key, lock);  // 清理，防止 map 无限增长
        }
    }
}
```

::: small
注意 Java 版的清理有一个竞态：remove 之后、另一个线程刚好 computeIfAbsent 拿到新锁，与仍持有旧锁引用的线程并发。生产代码可以用引用计数，或用 Guava 的 `Striped<Lock>` 固定数量的锁来避免。
:::

:::: qa
::: q 让 agent 修改文件，用行号还是文本替换？各有什么问题？
- 行号：多处修改后漂移；模型数行号容易错。
- 文本替换：位置稳定；但要处理空白和引号差异（模糊匹配）、多次出现（要求唯一）、多处修改（基于原文件匹配、不可重叠、一次应用）。
- 整文件重写：最简单，但费 token 且容易误删内容，只适合新文件。
:::
::: q 工具输出很大（比如构建日志）怎么处理？
- 按行数和字节双上限截断，尽量按整行截；单行本身超长时才截半行，并明确标出。
- 截断方向按场景选：日志保留尾部，文件保留头部。
- 完整内容落临时文件，结果里告诉模型路径和截断位置，需要时再读。
:::
::: q 并行工具调用改同一个文件会怎样？怎么解决？
- 两个调用都读到旧内容，各自修改后写回，后写的覆盖先写的，丢失更新。
- 按文件真实路径加锁，锁住完整的读-改-写；不同文件仍然并行。
- 或者把有共享状态的工具声明为串行执行。
:::
::::

::: ahead 前瞻 · 本章
- [已有证据] Claude Code、Codex CLI、pi 等主流 coding agent 都以“少量通用工具 + bash”为主。专用工具的价值主要集中在两类：模型训练时见过的格式（如编辑工具），以及需要权限控制、结构化输出的操作。
- [已有证据] 工具数量多时，已有厂商 API 和 harness（包括 pi）支持按需加载工具定义，不必全量放进上下文（第 16 章）。
- [作者判断] 工具格式和模型的绑定会加深。harness 的工具层会出现“按模型适配”的一层，类似 JDBC 驱动按数据库适配方言。
- [作者判断] 防呆逻辑（模糊匹配、唯一性检查）会变薄：模型复述旧文本越来越准。但截断、进程树、并发写这些“替模型做事”的逻辑不会变。
:::

::: quiz
- bash 工具输出超限时，pi 保留哪一部分？
  - [ ] 开头
  - [x] 结尾
  - [ ] 中间
  > 编译错误和测试失败信息在最后，所以 bash 用 truncateTail；read 则保留开头。
- 两个并行的 edit 改同一个文件，pi 怎么避免丢失更新？
  - [ ] 不处理
  - [x] 按文件 realpath 排队，同文件串行、不同文件并行
  - [ ] 全部工具改为串行
  > withFileMutationQueue 用 Promise 链实现每个文件一条队列。
- edit 的 oldText 在文件中出现 2 次，pi 会？
  - [ ] 替换第一处
  - [ ] 全部替换
  - [x] 报错要求提供更多上下文使其唯一
  > 防止改错位置。
:::
