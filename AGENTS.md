# AGENTS.md

本文件是 ForgeAgent 仓库的 AI Agent 协作规范。任何 AI Agent、CLI Agent、IDE Agent、自动化脚本在修改本仓库代码前，都必须优先阅读并遵守本文件。

---

# 1. 项目定位

ForgeAgent 是一个面向开发者和企业私有化环境的工程 Agent 操作系统。

第一阶段不是做完整企业平台，也不是做完整 AI IDE，而是先完成一个最小可用闭环：

```txt
Local-first Coding Agent + Web Console Lite
```

MVP 最小闭环：

```txt
1. forgeagent runner start
2. 选择本地 Git 仓库
3. 输入任务
4. Agent 创建隔离 git worktree
5. Agent 生成计划
6. Agent 搜索 / 读取代码
7. Agent 请求执行命令
8. 用户审批命令
9. Agent 修改 worktree 文件
10. Agent 运行测试
11. 展示 diff
12. 用户 apply / commit / discard
```

核心目标：

```txt
让程序员可以在本机安全、可控、可审计地运行 Coding Agent。
```

长期愿景：

```txt
ForgeAgent OS = Agent Runtime + Runner + Control Plane + Tool Layer + Approval + Audit + 多端入口
```

但当前阶段严禁过度设计。

---

# 2. 当前阶段范围

当前只做 MVP。

## 必须做

```txt
1. Local Runner
2. Web Console Lite
3. CLI
4. Workspace 注册
5. Git worktree 隔离
6. Task 状态机
7. Agent Loop
8. Tool 调用
9. Command Approval
10. Event Stream
11. Git Diff
12. Apply / Commit / Discard
13. OpenAI-compatible Model Gateway
14. 基础审计日志
15. 单元测试
```

## 暂不做

```txt
1. 企业 RBAC / SSO
2. 多租户
3. K8s Runner
4. 移动端
5. VS Code 插件
6. Tauri 桌面端
7. RUM / APM / AIOps
8. 插件市场
9. 复杂向量数据库
10. 多 Agent 编排
11. 自动 merge 主分支
12. 自动执行高风险命令
13. 云端 SaaS 控制面
```

所有实现都必须服务于 MVP 闭环，不要提前引入企业级复杂度。

---

# 3. 推荐技术栈

MVP 使用 TypeScript Monorepo。

```txt
Runtime:
  Node.js 20+

Package Manager:
  pnpm

Frontend:
  React
  Vite
  TypeScript
  Monaco Diff Editor

Runner / Server:
  Node.js
  Fastify
  SQLite
  SSE

Agent Runtime:
  TypeScript
  OpenAI-compatible Chat Completions

Git:
  git CLI
  git worktree
  git diff
  git apply

Testing:
  Vitest
```

后续可以演进为：

```txt
Control Plane:
  Java Spring Boot

Runner Daemon:
  Rust / Node

Agent Runtime:
  Python / LangGraph

Enterprise Runner:
  Docker / Kubernetes
```

但 MVP 不允许直接跳到最终架构。

---

# 4. 建议目录结构

```txt
forgeagent/
  AGENTS.md
  README.md
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json

  apps/
    console/
      src/
        App.tsx
        pages/
          HomePage.tsx
          TaskPage.tsx
        components/
          WorkspacePicker.tsx
          TaskTimeline.tsx
          ApprovalPanel.tsx
          DiffViewer.tsx
          ToolCallView.tsx
        api/
          client.ts
          events.ts
      package.json
      vite.config.ts

  packages/
    core/
      src/
        types.ts
        ids.ts
        time.ts
        errors.ts
        path.ts
      package.json

    cli/
      src/
        index.ts
        commands/
          runner.ts
          workspace.ts
          task.ts
      package.json

    runner/
      src/
        main.ts
        server.ts
        db.ts
        config.ts

        routes/
          health.ts
          workspaces.ts
          tasks.ts
          approvals.ts

        services/
          workspaceService.ts
          taskService.ts
          approvalService.ts
          eventService.ts
          auditService.ts

        git/
          gitClient.ts
          worktree.ts
          diff.ts
          patch.ts

        shell/
          shellExecutor.ts
          commandPolicy.ts

        agent/
          loop.ts
          model.ts
          prompts.ts
          tools.ts
          json.ts

      package.json
```

---

# 5. 核心对象模型

所有核心类型应优先放在：

```txt
packages/core/src/types.ts
```

基础类型：

```ts
export type TaskStatus =
  | 'created'
  | 'preparing'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'applied'
  | 'committed'
  | 'discarded'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Workspace {
  id: string
  name: string
  repoPath: string
  gitRoot: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  workspaceId: string
  prompt: string
  status: TaskStatus
  baseBranch: string
  baseCommit: string
  worktreePath: string
  createdAt: string
  updatedAt: string
}

export interface TaskEvent {
  id: string
  taskId: string
  type:
    | 'task.status'
    | 'agent.message'
    | 'tool.started'
    | 'tool.output'
    | 'tool.finished'
    | 'approval.required'
    | 'approval.resolved'
    | 'diff.updated'
    | 'task.completed'
    | 'task.failed'
  payload: unknown
  createdAt: string
}

export interface Approval {
  id: string
  taskId: string
  toolCallId: string
  command: string
  cwd: string
  reason: string
  status: ApprovalStatus
  createdAt: string
  resolvedAt?: string
}
```

---

# 6. Local Runner 设计原则

Runner 是本机执行入口。

启动命令：

```bash
forgeagent runner start
```

启动后默认监听：

```txt
http://127.0.0.1:17890
```

默认数据目录：

```txt
~/.forgeagent
```

目录结构：

```txt
~/.forgeagent/
  forgeagent.sqlite
  worktrees/
    <taskId>/
  patches/
    <taskId>.patch
  logs/
    <taskId>.log
```

Runner 只允许监听 localhost。MVP 阶段不要默认暴露到公网或局域网。

---

# 7. Git Worktree 强制隔离

Agent 禁止直接修改用户原始仓库。

创建任务时必须创建隔离 worktree：

```bash
git -C <repo> worktree add ~/.forgeagent/worktrees/<taskId> -b forgeagent/task-<taskId>
```

Agent 只能在以下目录内读写：

```txt
~/.forgeagent/worktrees/<taskId>
```

最终由用户选择：

```txt
apply:
  将 worktree diff 应用到原始仓库

commit:
  在 worktree 或原始仓库提交变更

discard:
  删除 worktree 和临时分支
```

任何直接修改原始仓库文件的实现都视为错误。

---

# 8. API 规范

Local Runner 提供 HTTP API。

```txt
GET  /api/health

POST /api/workspaces
GET  /api/workspaces
GET  /api/workspaces/:id

POST /api/tasks
GET  /api/tasks
GET  /api/tasks/:id
GET  /api/tasks/:id/events
GET  /api/tasks/:id/diff

POST /api/approvals/:id/approve
POST /api/approvals/:id/reject

POST /api/tasks/:id/apply
POST /api/tasks/:id/commit
POST /api/tasks/:id/discard
POST /api/tasks/:id/cancel
```

实时事件使用 SSE：

```txt
GET /api/tasks/:id/events
```

MVP 阶段不使用 WebSocket，避免复杂化。

---

# 9. Agent Loop 规范

MVP 使用简单 ReAct JSON Loop，不引入复杂多 Agent 框架。

循环过程：

```txt
1. System Prompt
2. User Task
3. Model 输出 JSON action
4. Runner 执行 tool
5. Tool result 回填上下文
6. 循环直到 final
```

模型输出必须是 JSON：

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

完成时：

```json
{
  "message": "修复完成，已生成 diff，并通过测试。",
  "final": true
}
```

禁止让模型输出自由格式后再猜测解析。解析失败必须重试或失败退出。

---

# 10. 内置工具

MVP 只允许以下工具：

```txt
list_files
read_file
search_text
apply_patch
run_command
get_diff
```

## list_files

用途：

```txt
列出 worktree 内文件。
```

限制：

```txt
不得递归读取 node_modules、.git、dist、build、coverage。
```

## read_file

用途：

```txt
读取 worktree 内指定文件。
```

限制：

```txt
单文件最大 200KB。
禁止读取 .env、私钥、证书、系统目录。
```

## search_text

用途：

```txt
搜索 worktree 内文本。
```

限制：

```txt
最多返回 100 条结果。
默认忽略 node_modules、.git、dist、build、coverage。
```

## apply_patch

用途：

```txt
修改 worktree 内文件。
```

限制：

```txt
只能修改 worktree 内文件。
禁止越权路径。
修改后必须触发 diff.updated 事件。
```

## run_command

用途：

```txt
请求执行测试、构建、检查命令。
```

限制：

```txt
必须用户审批。
默认超时 120 秒。
默认 cwd 为 task worktree。
禁止无审批自动执行。
```

## get_diff

用途：

```txt
获取当前 worktree 的 git diff。
```

实现：

```bash
git diff HEAD
```

---

# 11. 安全规则

所有路径必须做 workspace 内部校验。

示例：

```ts
export function assertInsideWorkspace(
  workspaceRoot: string,
  targetPath: string,
) {
  const resolvedRoot = path.resolve(workspaceRoot)
  const resolvedTarget = path.resolve(workspaceRoot, targetPath)

  if (
    !resolvedTarget.startsWith(resolvedRoot + path.sep) &&
    resolvedTarget !== resolvedRoot
  ) {
    throw new Error(`Path escapes workspace: ${targetPath}`)
  }

  return resolvedTarget
}
```

默认禁止读取：

```txt
.env
.env.*
*.pem
*.key
*.crt
id_rsa
id_ed25519
.ssh/
.aws/
.kube/
.git/
```

默认忽略目录：

```txt
node_modules
dist
build
coverage
.next
.nuxt
.turbo
.cache
.git
```

高风险命令必须审批，且默认标记为 dangerous：

```txt
rm -rf
sudo
chmod -R 777
curl | sh
wget | sh
npm publish
pnpm publish
docker system prune
kubectl
ssh
scp
mysql
psql
redis-cli
```

MVP 阶段不要实现自动白名单放行高风险命令。

---

# 12. Command Approval 规范

任何 run_command 都必须创建 Approval。

事件流程：

```txt
Agent 请求 run_command
  ↓
Runner 创建 approval
  ↓
Task 状态变为 waiting_approval
  ↓
Web Console 显示审批卡片
  ↓
用户 approve / reject
  ↓
approve 后执行命令
  ↓
命令输出通过 SSE 返回
  ↓
Agent 继续执行
```

Approval 页面必须显示：

```txt
命令
执行目录
Agent 给出的原因
风险等级
Approve / Reject
```

---

# 13. Web Console Lite 规范

MVP 只做两个页面。

## HomePage

能力：

```txt
1. 添加本地仓库
2. 查看 workspace 列表
3. 创建任务
4. 查看任务列表
```

## TaskPage

能力：

```txt
1. 查看任务状态
2. 查看 Agent 消息
3. 查看工具调用
4. 查看命令输出
5. 审批命令
6. 查看 diff
7. apply / commit / discard / cancel
```

页面结构建议：

```txt
左侧：Agent 消息与任务状态
中间：工具调用、终端输出、审批卡片
右侧：文件变更列表与 diff viewer
底部：apply / commit / discard / cancel
```

---

# 14. CLI 规范

CLI 包名：

```txt
forgeagent
```

命令：

```bash
forgeagent runner start
forgeagent workspace add /path/to/repo
forgeagent workspace list
forgeagent task create --workspace <id> --prompt "..."
forgeagent task watch <taskId>
forgeagent task diff <taskId>
forgeagent task apply <taskId>
forgeagent task commit <taskId> --message "..."
forgeagent task discard <taskId>
```

MVP 阶段 CLI 可以调用本地 HTTP API，不需要直接操作底层服务。

---

# 15. Model Gateway 规范

MVP 只支持 OpenAI-compatible Chat Completions。

环境变量：

```txt
FORGEAGENT_MODEL_BASE_URL
FORGEAGENT_MODEL_API_KEY
FORGEAGENT_MODEL_NAME
```

必须兼容：

```txt
DeepSeek
Qwen
GLM
Ollama
vLLM
OpenAI-compatible API
```

Agent 代码不得直接写死某个模型供应商。

---

# 16. System Prompt 基线

Agent 基础 system prompt：

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

---

# 17. 测试要求

所有核心逻辑必须有单元测试。

必须覆盖：

```txt
1. workspace 路径校验
2. Git 仓库识别
3. worktree 创建
4. worktree 删除
5. diff 生成
6. patch apply
7. task 状态转换
8. approval 状态转换
9. command policy 判断
10. tool path escape 防护
11. read_file 敏感文件拦截
12. run_command 审批流程
13. agent JSON 解析
14. SSE event 生成
```

推荐测试命令：

```bash
pnpm test
pnpm typecheck
pnpm lint
```

CI 至少执行：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

---

# 18. 代码风格

统一要求：

```txt
1. TypeScript strict mode
2. 不使用 any，确实需要时必须注明原因
3. 核心类型放 packages/core
4. Runner 不依赖 React
5. Console 不直接访问文件系统
6. CLI 通过 API 调用 Runner
7. Agent 工具必须可测试
8. 所有外部命令执行必须有 timeout
9. 所有错误必须转成结构化错误
10. 不允许静默吞掉错误
```

函数风格：

```txt
1. 小函数
2. 明确输入输出
3. 避免隐藏全局状态
4. IO 操作与纯逻辑分离
5. 优先组合，不要过早抽象复杂类层级
```

---

# 19. 错误处理规范

错误结构：

```ts
export interface ForgeAgentErrorPayload {
  code: string
  message: string
  details?: unknown
}
```

常见错误码：

```txt
WORKSPACE_NOT_FOUND
INVALID_GIT_REPO
PATH_ESCAPE_DETECTED
SENSITIVE_FILE_BLOCKED
TASK_NOT_FOUND
TASK_NOT_RUNNING
APPROVAL_NOT_FOUND
APPROVAL_ALREADY_RESOLVED
COMMAND_REJECTED
COMMAND_TIMEOUT
MODEL_REQUEST_FAILED
MODEL_RESPONSE_INVALID
TOOL_EXECUTION_FAILED
DIFF_EMPTY
PATCH_APPLY_FAILED
```

不要只返回 `Error: failed` 这种无上下文错误。

---

# 20. 审计要求

即使是 MVP，也必须记录基础审计。

至少记录：

```txt
task.created
task.status_changed
tool.started
tool.finished
approval.required
approval.approved
approval.rejected
command.started
command.finished
file.changed
diff.generated
task.applied
task.committed
task.discarded
```

每条审计包含：

```ts
{
  id: string
  taskId: string
  type: string
  payload: unknown
  createdAt: string
}
```

---

# 21. 文档要求

每个阶段完成后更新 README。

README 必须包含：

```txt
1. 项目定位
2. 快速开始
3. 配置模型
4. 启动 runner
5. 添加 workspace
6. 创建任务
7. 命令审批
8. apply / commit / discard
9. 安全说明
10. 当前限制
```

MVP 阶段还要提供：

```txt
docs/mvp.md
docs/security.md
docs/runner.md
docs/agent-loop.md
docs/workflows.md
docs/reviewer.md
docs/roadmap.md
```

---

# 22. 开发优先级

优先级从高到低：

```txt
P0:
  worktree 隔离
  task 状态机
  tool 安全边界
  command approval
  diff / apply / discard

P1:
  Web Console Lite
  SSE event stream
  OpenAI-compatible model
  CLI

P2:
  commit
  更好的 diff viewer
  审计查询
  配置文件
  demo 文档

P3:
  Docker Runner
  VS Code 插件
  Mobile 审批
  企业功能
```

不要在 P0 完成前做 P2/P3。

---

# 23. 完成标准

MVP 完成标准：

```txt
1. 能添加本地 Git 仓库
2. 能创建任务
3. 能创建隔离 worktree
4. Agent 能读取 / 搜索代码
5. Agent 能申请执行命令
6. 用户能审批命令
7. Agent 能修改 worktree 文件
8. Web 能实时显示事件
9. Web 能显示 diff
10. 用户能 apply / commit / discard
11. 原始仓库不会被 Agent 直接污染
12. 所有 tool call 和审批都有记录
13. 能在真实项目中完成一个小修复
```

推荐验收仓库：

```txt
zeus-ui
sql-studio-next
ai-ops
clash-helper
dev-vault
```

推荐验收任务：

```txt
1. 给某个函数补单元测试
2. 修复一个 TypeScript 类型错误
3. 修复一个 lint 错误
4. 增加一个 README 小节
5. 修复一个简单的解析函数 bug
```

---

# 24. Agent 行为约束

AI Agent 在本仓库工作时必须遵守：

```txt
1. 修改前先说明计划。
2. 不要一次性重构大量无关代码。
3. 不要引入大依赖，除非明确说明必要性。
4. 不要绕过 worktree 隔离。
5. 不要让 run_command 自动执行。
6. 不要默认读取敏感文件。
7. 不要直接删除用户代码。
8. 不要改动与任务无关的格式。
9. 不要为了测试通过而降低安全限制。
10. 不要把 MVP 做成企业平台。
```

---

# 25. 项目原则

ForgeAgent 的第一性原则：

```txt
Local-first
Private-first
Runner-based
Approval-first
Auditable
Model-agnostic
Git-native
```

解释：

```txt
Local-first:
  本机可运行，个人开发者先能用。

Private-first:
  默认尊重源码和上下文的数据边界。

Runner-based:
  所有执行都发生在 Runner，不在 Console 里执行。

Approval-first:
  高风险工具调用和命令执行必须由人确认。

Auditable:
  Prompt、工具调用、命令、文件变更都应可追踪。

Model-agnostic:
  不绑定某一个模型厂商。

Git-native:
  以 worktree、diff、patch、commit、MR 作为工程交付边界。
```

---

# 26. 当前阶段的一句话目标

```txt
先做一个能在真实本地仓库里安全完成小修复的 Coding Agent。
```

任何不服务于这句话的能力，都应推迟。
