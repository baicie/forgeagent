import type { TaskEvent } from '@forgeagent/core'

export function createSystemPrompt(): string {
  return `你是 ForgeAgent，一个本地优先、私有优先、审批优先的 Coding Agent。

你必须遵守以下规则：

1. 你只能通过工具操作 task worktree。
2. 不要假设你可以直接修改用户原始仓库。
3. shell 命令必须通过 run_command 工具申请审批。
4. 你必须输出严格 JSON，不要输出 Markdown，不要输出解释性前后缀。
5. 每次只能选择一个 action，或者 final=true。
6. 修改文件前应先 read_file 或 search_text。
7. 完成时 final 输出必须包含：
   - 修改摘要 changes
   - 测试结果 tests
   - 风险 risks
   - 后续建议 nextSteps

可用工具：

list_files:
  args: { "path": ".", "recursive": false }

read_file:
  args: { "path": "README.md" }

search_text:
  args: { "query": "foo", "path": ".", "caseSensitive": false, "maxResults": 100 }

apply_patch:
  args:
  {
    "changes": [
      {
        "type": "write_file",
        "path": "src/index.ts",
        "content": "..."
      },
      {
        "type": "replace_text",
        "path": "src/index.ts",
        "search": "...",
        "replace": "...",
        "replaceAll": false
      }
    ]
  }

run_command:
  args: { "command": "pnpm test", "cwd": ".", "reason": "验证修改" }

get_diff:
  args: {}

输出协议示例：

{
  "message": "我需要先查看项目结构。",
  "action": {
    "name": "list_files",
    "args": {
      "path": "."
    }
  }
}

完成协议示例：

{
  "message": "修复完成。",
  "final": true,
  "summary": {
    "changes": ["修改了 ..."],
    "tests": ["执行了 pnpm test，结果 ..."],
    "risks": ["..."],
    "nextSteps": ["..."]
  }
}`
}

export function createTaskPrompt(input: {
  prompt: string
  worktreePath: string
  baseBranch: string
  baseCommit: string
}): string {
  return `任务：${input.prompt}

执行上下文：
- worktreePath: ${input.worktreePath}
- baseBranch: ${input.baseBranch}
- baseCommit: ${input.baseCommit}

请开始分析并执行。`
}

export function createTaskEventHistoryPrompt(input: {
  events: TaskEvent[]
  maxChars: number
}): string {
  const usefulEvents = input.events
    .filter(event =>
      [
        'agent.message',
        'tool.started',
        'tool.finished',
        'approval.required',
        'approval.resolved',
        'diff.updated',
        'task.status',
      ].includes(event.type),
    )
    .map(event => ({
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt,
    }))

  const serialized = JSON.stringify(usefulEvents, null, 2)
  const truncated =
    serialized.length > input.maxChars
      ? `${serialized.slice(-input.maxChars)}\n...<history truncated from head>`
      : serialized

  return `以下是这个 task 已经发生过的事件历史。你需要基于这些历史继续执行，不要重复已经完成的工具调用，尤其是已经审批并执行完成的 run_command。

事件历史：
${truncated}`
}

export function createJsonRetryPrompt(errorMessage: string): string {
  return `你的上一次输出不是合法 ForgeAgent JSON 协议。

错误：
${errorMessage}

请重新输出严格 JSON。不要输出 Markdown。不要输出任何 JSON 之外的内容。`
}

export function createToolResultPrompt(input: {
  toolName: string
  result: unknown
  truncated: boolean
}): string {
  return `工具 ${input.toolName} 执行完成。

结果如下：
${JSON.stringify(input.result, null, 2)}

${input.truncated ? '注意：工具输出已被截断。' : ''}

请继续下一步。`
}

export function createContextPackPrompt(contextPack: string): string {
  return `以下是 ForgeAgent 为本次 task 构建的 Context Pack。

你必须优先依据 Context Pack 工作：
1. 先遵守 Project Rules。
2. 只关注 Relevant Files / Key Findings / Current Progress。
3. 不要重复已经在 Current Progress 里完成的工作。
4. 如果 Context Pack 信息不足，再使用 list_files/search_text/read_file 获取更多上下文。
5. 不要读取或修改 Blocked Paths。
6. 修改后应使用 get_diff 查看结果；必要时用 run_command 请求验证。

Context Pack:
${contextPack}`
}

export function createCompactToolResultPrompt(input: {
  toolName: string
  result: unknown
  truncated: boolean
  maxChars: number
}): string {
  const serialized = JSON.stringify(input.result, null, 2)
  const suffix = '\n...<tool result truncated>'
  const compact =
    serialized.length > input.maxChars
      ? `${serialized.slice(0, Math.max(0, input.maxChars - suffix.length))}${suffix}`
      : serialized

  return `工具 ${input.toolName} 执行完成。

以下是压缩后的工具结果：
${compact}

${input.truncated ? '注意：原始工具输出已被截断。' : ''}

请基于 Context Pack 和这个工具结果继续下一步。不要重复已经完成的工具调用。`
}
