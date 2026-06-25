# ForgeAgent Agent Loop

MVP 使用简单 ReAct JSON Loop。

当前阶段不引入复杂多 Agent 框架，不做 Planner / Coder / Reviewer 多 Agent 编排。

## 循环流程

```txt
System Prompt
  ↓
User Task
  ↓
Model 输出 JSON action
  ↓
Runner 执行 tool
  ↓
Tool result 回填上下文
  ↓
继续循环
  ↓
final
```

## 模型输出格式

工具调用：

```json
{
  "message": "我需要先查看项目结构。",
  "action": {
    "name": "list_files",
    "args": {
      "path": "."
    }
  }
}
```

结束：

```json
{
  "message": "修复完成，已生成 diff，并通过测试。",
  "final": true
}
```

## MVP 工具

```txt
list_files
read_file
search_text
apply_patch
run_command
get_diff
```

## 限制

```txt
maxSteps = 30
maxFileReadBytes = 200KB
maxToolOutputChars = 20000
run_command 必须审批
```

## System Prompt 基线

```txt
你是 ForgeAgent OS 的本地 Coding Agent。

你运行在一个隔离 Git worktree 中。
你只能通过工具读取文件、搜索代码、修改文件、查看 diff、请求执行命令。

规则：
1. 不要臆测文件内容，必须先读取文件。
2. 修改前先说明计划。
3. run_command 必须说明原因。
4. 不要访问 workspace 外部路径。
5. 不要读取 .env、密钥、私钥、系统目录。
6. 每次修改后必须查看 diff。
7. 如果需要验证，使用 run_command 请求执行测试。
8. 最终输出包括：修改摘要、测试结果、风险、后续建议。
9. 输出必须是 JSON。
```

## 当前 Phase 0

Phase 0 只完成 ForgeAgent 命名、包名、文档和测试收敛。

Agent Loop 的实现从 Phase 7 开始。

## External Working Memory

Phase 13 起，每个 task 都会维护外部任务记忆：

```txt
~/.forgeagent/runs/<taskId>/
  task_plan.md
  progress.md
  findings.md
  decisions.md
  changed_files.md
  test_results.md
  context_pack.md
  final_summary.md
```

## Phase 14: Context Pack Builder

每次 Agent Loop 开始前生成 Context Pack：

```txt
~/.forgeagent/runs/<taskId>/context_pack.md
```

Context Pack 来源：

- 用户任务 prompt
- AGENTS.md
- .agents/AGENTS.md
- .agents/rules/\*
- .agents/skills/\*
- task_plan.md
- progress.md
- findings.md
- 当前 diff
- 相关文件摘要
- allowed tools
- blocked paths
- validation commands

目录约定：

```txt
.agents/        项目级 Agent 规则源，提交进 Git
~/.forgeagent/  ForgeAgent 本地运行态，不提交进 Git
```

Context Pack 约束：

1. 不读取敏感文件。
2. 不包含 .env、key、pem、node_modules、dist、.git。
3. 有最大字符数限制（默认 30_000）。
4. 作为模型主上下文。
5. 事件历史只作为恢复辅助。

这些文件不是给人看的"装饰文档"，而是 Agent Harness 的外部工作记忆。

规则：

1. 创建 task 后自动生成 task_plan.md 和 context_pack.md。
2. 每次状态变化更新 progress.md。
3. 每轮 Agent step 更新 progress.md。
4. search_text/read_file 结果写入 findings.md。
5. apply_patch 结果写入 changed_files.md 和 decisions.md。
6. run_command 执行结果写入 test_results.md。
7. final 输出写入 final_summary.md。

每次更新会发出 `memory.updated` 事件，Console 和 CLI 可以被动刷新。

## Tool Layer Boundary

Agent Loop 不直接 switch 调用工具函数，而是通过 ToolRegistry 调用。

ToolRegistry 负责：

1. 查找工具描述。
2. 判断 source/type/permission。
3. 创建 ToolCallRecord。
4. 输出 tool.started/tool.finished 结构化事件。
5. 为 Console 展示提供统一字段。

Phase 14.5 暂不接真实 MCP Server。
