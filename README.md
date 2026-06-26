# ForgeAgent OS

ForgeAgent OS 是一个面向开发者和企业私有化环境的工程 Agent 操作系统。

第一阶段目标不是做完整企业平台，也不是做完整 AI IDE，而是先完成：

```txt
Local-first Coding Agent + Web Console Lite
```

MVP 要跑通的最小闭环：

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

## 当前状态

当前仓库处于 MVP 阶段，已经跑通最小闭环：

```txt
Local Runner + Web Console Lite + CLI
```

最小闭环：

```txt
1. forgeagent runner start
2. 选择本地 Git 仓库
3. 输入任务
4. Agent 创建隔离 git worktree
5. Agent 搜索 / 读取代码
6. Agent 请求执行命令
7. 用户审批命令
8. Agent 修改 worktree 文件
9. 展示 diff
10. 用户 apply / commit / discard
```

详细规范见：

- [AGENTS.md](./AGENTS.md)
- [docs/roadmap.md](./docs/roadmap.md)
- [docs/mvp.md](./docs/mvp.md)
- [docs/security.md](./docs/security.md)
- [docs/runner.md](./docs/runner.md)
- [docs/agent-loop.md](./docs/agent-loop.md)
- [docs/tools.md](./docs/tools.md)

## 核心原则

```txt
Local-first
Private-first
Runner-based
Approval-first
Auditable
Model-agnostic
Git-native
```

## 快速开始：5 分钟跑通

ForgeAgent MVP 要求 workspace 是一个 **已经有至少一个 commit 的 Git 仓库**。

### 1. 安装依赖

```bash
pnpm install
pnpm build
```

### 2. 配置模型

ForgeAgent 使用 OpenAI-compatible Chat Completions 接口。

本地 Ollama 示例：

```bash
export FORGEAGENT_MODEL_BASE_URL="http://localhost:11434/v1"
export FORGEAGENT_MODEL_API_KEY="ollama"
export FORGEAGENT_MODEL_NAME="qwen2.5-coder"
```

OpenAI 示例：

```bash
export FORGEAGENT_MODEL_BASE_URL="https://api.openai.com/v1"
export FORGEAGENT_MODEL_API_KEY="sk-xxx"
export FORGEAGENT_MODEL_NAME="gpt-4.1-mini"
```

DeepSeek 示例：

```bash
export FORGEAGENT_MODEL_BASE_URL="https://api.deepseek.com/v1"
export FORGEAGENT_MODEL_API_KEY="sk-xxx"
export FORGEAGENT_MODEL_NAME="deepseek-chat"
```

### 3. 启动 Runner

```bash
forgeagent runner start
```

默认地址：

```txt
http://127.0.0.1:17890
```

端口占用时：

```bash
FORGEAGENT_RUNNER_PORT=17891 forgeagent runner start
```

### 4. 添加 Git 仓库

```bash
cd /path/to/your/repo
git status

forgeagent workspace add .
forgeagent workspace list
```

如果当前目录不是 Git 仓库，请先初始化：

```bash
git init
git add .
git commit -m "chore: initial commit"
```

### 5. 创建并运行任务

```bash
forgeagent task create \
  --workspace <workspaceId> \
  --prompt "给 README 增加一段配置说明" \
  --run

forgeagent task watch <taskId>
```

### 6. 查看 diff

```bash
forgeagent task diff <taskId>
```

注意：Agent 的修改只会写入隔离 worktree，原仓库不会立即变化。

### 7. 查看任务外部记忆

```bash
forgeagent task memory <taskId>
forgeagent task memory <taskId> --file findings.md
```

任务记忆位于：

```txt
~/.forgeagent/runs/<taskId>/
```

包含 task_plan、progress、findings、decisions、changed_files、test_results、context_pack 和 final_summary。

### 7.1 查看 Context Pack

```bash
forgeagent task memory <taskId> --file context_pack.md
```

Context Pack 每次 Agent Loop 开始前生成，包含任务目标、项目规则、相关文件、关键发现、当前进度、当前 diff、允许工具、禁止路径和验证命令。

项目级 Agent 规则从以下位置读取：

```txt
AGENTS.md
.agents/AGENTS.md
.agents/rules/*
.agents/skills/*
```

### 8. 自动验证反馈

在项目根目录添加 `.agents/validation.yaml`：

```yaml
validation:
  commands:
    - pnpm typecheck
    - pnpm test:run
  maxFixAttempts: 3
```

也可以通过 CLI 指定：

```bash
forgeagent task create \
  --workspace <id> \
  --prompt "fix bug" \
  --validate "pnpm typecheck" "pnpm test:run" \
  --max-fix-attempts 3
```

Agent 修改文件并尝试 final 时，如果存在验证命令，Runner 会自动请求审批执行验证命令。验证失败后，Agent 会收到失败摘要并继续修复，最多尝试 `maxFixAttempts` 次。

### 9. 只读审查

任务 `completed` 后，可以运行只读审查：

```bash
forgeagent task review <taskId>
forgeagent task review <taskId> --show
forgeagent task memory <taskId> --file review_report.md
```

Reviewer 只允许 read_file / search_text / get_diff，不允许修改文件或执行命令。

### 10. 交付任务

把修改应用到原仓库：

```bash
forgeagent task apply <taskId>
```

在 worktree 分支中提交：

```bash
forgeagent task commit <taskId> --message "feat: update readme"
```

丢弃任务：

```bash
forgeagent task discard <taskId>
```

### 11. 清理所有任务

长期使用后可以一键清理所有 task worktree 和记录：

```bash
forgeagent task cleanup --yes
```

不传 `--yes` 会打印确认提示，不会真的执行。

## apply / commit / discard 的区别

```txt
apply:
  把 task worktree 中的 patch 应用到原仓库。
  原仓库文件会变化。

commit:
  在 task worktree 的临时分支上提交。
  原仓库当前分支不会变化。

discard:
  删除 task worktree 和临时分支。
  原仓库不会变化。
```

## Worktree 说明

ForgeAgent 不会让 Agent 直接修改你的原仓库。

每个 task 会创建一个隔离 worktree：

```txt
~/.forgeagent/worktrees/<taskId>
```

Agent 只在这个目录里读写文件。你确认 diff 后，再选择 apply / commit / discard。

## 磁盘空间不足

每个 task 都会创建一个隔离 worktree。Runner 默认要求 dataDir 所在磁盘至少有 `2GB`（`FORGEAGENT_MIN_FREE_DISK`）可用空间，否则创建 task 时会报 `DISK_SPACE_LOW` 并提示清理。

清理所有 task worktree 和记录：

```bash
forgeagent task cleanup --yes
```

只清理某个任务：

```bash
forgeagent task discard <taskId>
```

## 开发命令

```bash
pnpm install
pnpm build

pnpm dev         # 默认起 CLI 包
pnpm console:dev # 起 Web Console

pnpm test
pnpm test:run
pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

## CLI 命令一览

```bash
forgeagent runner start

forgeagent workspace add /path/to/repo
forgeagent workspace list

forgeagent task create --workspace <id> --prompt "..." --validate "pnpm typecheck" --max-fix-attempts 3
forgeagent task run <taskId>
forgeagent task watch <taskId>
forgeagent task diff <taskId>
forgeagent task review <taskId>
forgeagent task review <taskId> --show
forgeagent task memory <taskId>
forgeagent task memory <taskId> --file <file>
forgeagent task apply <taskId>
forgeagent task commit <taskId> --message "..."
forgeagent task discard <taskId>
forgeagent task cancel <taskId>
forgeagent task cleanup --yes
```

## 项目结构

```txt
forgeagent/
├─ apps/
│  ├─ cli/              # ForgeAgent CLI
│  └─ console/          # Web Console Lite
├─ packages/
│  ├─ core/             # ForgeAgent OS core runtime
│  └─ runner/           # Local Runner daemon
├─ skills/              # 内置 Skills
├─ docs/                # 项目文档
├─ scripts/             # 共享 tsconfig
└─ .github/workflows/   # CI
```

## 文档

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

重要文档：

```txt
docs/roadmap.md
docs/mvp.md
docs/security.md
docs/runner.md
docs/agent-loop.md
docs/tools.md
docs/validation.md
docs/reviewer.md
```

## Core Harness Tools

ForgeAgent 的内置工具称为 Core Harness Tools：

```txt
list_files
read_file
search_text
apply_patch
run_command
get_diff
```

这些工具由 Runner 直接实现，并受 worktree、approval、audit、memory 和 context_pack 约束。

MCP Tools 是未来外部系统扩展入口，不替代 Core Harness Tools。

### 交付动作（用户触发）

```txt
apply_task
commit_task
discard_task
```

这些交付动作不开放给模型直接调用。用户通过 Console/CLI 触发。

详细文档见 [docs/tools.md](./docs/tools.md)。

## License

MIT
