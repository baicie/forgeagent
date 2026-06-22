# ForgeAgent MVP

ForgeAgent MVP 的目标是跑通：

```txt
Local-first Coding Agent + Web Console Lite
```

## 最小闭环

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

## MVP 必须支持

```txt
Local Runner
Workspace 注册
Git worktree 隔离
Task 状态机
SSE Event Stream
Agent Loop
Tool 调用
Command Approval
Git Diff
Apply / Commit / Discard
OpenAI-compatible Model Gateway
基础审计日志
```

## MVP 暂不支持

```txt
企业 RBAC
SSO
多租户
K8s Runner
移动端
VS Code 插件
Tauri 桌面端
RUM / APM / AIOps
插件市场
复杂向量数据库
自动 merge
```

## 验收任务

推荐先使用真实小任务验收：

```txt
给一个纯函数补单元测试
修复一个 TypeScript 类型错误
给 README 增加配置说明
给解析函数补边界测试
修复一个 lint 错误
```

## 完成标准

```txt
1. 能添加本地 Git 仓库
2. 能创建隔离 worktree
3. Agent 能读取 / 搜索代码
4. Agent 能请求命令审批
5. 用户能 approve / reject
6. Agent 能修改 worktree 文件
7. Web 能看到实时事件
8. Web 能看到 diff
9. 用户能 apply / commit / discard
10. 原始仓库不会被 Agent 直接污染
```
