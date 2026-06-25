# Tool Layer

ForgeAgent 的工具层分为三类：

```txt
Core Harness Tools
MCP Tools
Plugin Tools
```

## Core Harness Tools

Core Harness Tools 是 ForgeAgent 内置的安全执行能力，由 Runner 直接实现。

它们和 worktree、approval、audit、memory、context_pack 强绑定。

### Agent 可直接调用

| Tool        | Display     | Source | Type    | Permission        | Approval |
| ----------- | ----------- | ------ | ------- | ----------------- | -------- |
| list_files  | list        | core   | read    | allowed           | no       |
| read_file   | read        | core   | read    | allowed           | no       |
| search_text | search      | core   | read    | allowed           | no       |
| apply_patch | apply patch | core   | write   | allowed           | no       |
| run_command | run         | core   | execute | requires_approval | yes      |
| get_diff    | diff        | core   | read    | allowed           | no       |

### 用户触发的交付动作

| Action       | Source | Permission        |
| ------------ | ------ | ----------------- |
| apply_task   | core   | requires_approval |
| commit_task  | core   | requires_approval |
| discard_task | core   | requires_approval |

这些交付动作不开放给模型直接调用。

## MCP Tools

MCP Tools 用于连接外部系统，例如：

- GitHub
- GitLab
- Jira
- Slack
- Zabbix
- Kubernetes
- Database
- Browser

Phase 14.5 只预留 `MCPToolProvider` 接口，暂不连接真实 MCP Server。

## Plugin Tools

Plugin Tools 是未来扩展点。

Phase 14.5 只预留接口，不实现插件加载。

## ToolRegistry

所有工具调用必须经过 ToolRegistry。

ToolRegistry 负责：

1. 查找工具描述。
2. 判断 source/type/permission。
3. 创建 ToolCallRecord。
4. 输出 tool.started/tool.finished 结构化事件。
5. 为 Console 展示提供统一字段。

## Boundary

```txt
Core Tool = ForgeAgent 安全执行内核
MCP Tool  = 外部系统能力
Skill     = 任务方法论
Workflow  = 步骤编排
Runner    = 执行和隔离环境
```

文件、patch、diff、shell、worktree、memory、context_pack、audit 这些不要 MCP 化。它们属于 ForgeAgent 的可信执行内核。
