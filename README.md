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

当前仓库处于 Phase 0：项目身份与模板收敛。

本阶段只做：

```txt
universal-agent → ForgeAgent
@agent/core     → @forgeagent/core
@agent/cli      → @forgeagent/cli
agent           → forgeagent
```

Runner、Web Console、worktree、审批、diff 等能力会在后续 Phase 中逐步实现。

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

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
pnpm dev

# 或直接运行 CLI 包
pnpm --filter @forgeagent/cli dev
```

### 构建

```bash
pnpm build
```

### 测试

```bash
pnpm test
pnpm test:run
pnpm test:coverage
```

### 类型检查

```bash
pnpm typecheck
```

### 代码检查

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

## CLI 命令

Phase 0 仍保留模板 CLI 能力，用于后续迁移。

```bash
forgeagent chat

forgeagent run "帮我分析这个 bug"

forgeagent skill list

forgeagent config init
```

后续 Phase 会新增：

```bash
forgeagent runner start
forgeagent workspace add /path/to/repo
forgeagent task create --workspace <id> --prompt "..."
forgeagent task watch <taskId>
forgeagent task diff <taskId>
forgeagent task apply <taskId>
forgeagent task commit <taskId> --message "..."
forgeagent task discard <taskId>
```

## 项目结构

```txt
forgeagent/
├─ apps/
│  └─ cli/              # ForgeAgent CLI
├─ packages/
│  └─ core/             # ForgeAgent OS core runtime
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
```

## License

MIT
