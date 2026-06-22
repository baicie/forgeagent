# ForgeAgent Roadmap

ForgeAgent OS 的路线是：先用 Codex-like 的程序员体验切入，再逐步演进为私有化 Agent OS。

## Phase 0：项目身份与模板收敛

目标：

```txt
universal-agent → ForgeAgent
@agent/core     → @forgeagent/core
@agent/cli      → @forgeagent/cli
agent           → forgeagent
```

验收：

```bash
pnpm install
pnpm build
pnpm test:run
pnpm typecheck

pnpm --filter @forgeagent/cli dev
forgeagent --help
```

## Phase 1：Core Domain 与安全边界

新增 Workspace、Task、TaskEvent、Approval、AuditLog、Runner、ToolCall 等核心对象。

完成路径边界、安全文件拦截、危险命令识别。

## Phase 2：Local Runner Server

实现：

```txt
forgeagent runner start
```

默认监听：

```txt
127.0.0.1:17890
```

提供 workspace、task、approval、event、diff API。

## Phase 3：Workspace + Git Worktree

Agent 禁止直接修改原始仓库。

每个任务创建独立 worktree：

```txt
~/.forgeagent/worktrees/<taskId>
```

## Phase 4：Task 状态机 + Event Stream

实现任务状态机和 SSE 事件流。

## Phase 5：Tool Layer

实现 MVP 工具：

```txt
list_files
read_file
search_text
apply_patch
run_command
get_diff
```

## Phase 6：Command Approval

任何 run_command 都必须用户审批。

## Phase 7：Model Gateway + Agent Loop

支持 OpenAI-compatible Chat Completions。

兼容 DeepSeek、Qwen、GLM、Ollama、vLLM 等模型服务。

## Phase 8：Diff / Apply / Commit / Discard

完成 Git-native 的交付闭环。

## Phase 9：Web Console Lite

实现任务创建、事件流、审批、diff、apply/commit/discard。

## Phase 10：CLI 改造

实现 workspace/task/runner 命令。

## Phase 11：MVP 验收

至少在 3 个真实仓库完成小任务。

## Phase 12：Agent OS 扩展

增加 Docker Runner、GitLab/Gitee MR、Review Agent、CI Fix Agent、VS Code 插件、Mobile 审批。
