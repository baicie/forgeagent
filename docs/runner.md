# ForgeAgent Runner

Runner 是 ForgeAgent OS 的执行面。

Console、CLI、IDE、Mobile 都只是控制入口。真正的文件读写、命令执行、Git 操作、测试运行都必须发生在 Runner 中。

## MVP Runner

MVP 只实现 Local Runner。

启动方式：

```bash
forgeagent runner start
```

默认监听：

```txt
127.0.0.1:17890
```

默认数据目录：

```txt
~/.forgeagent
```

结构：

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

## Runner 职责

```txt
1. 管理 Workspace
2. 创建 Git Worktree
3. 管理 Task 状态
4. 执行 Agent Tool
5. 创建命令审批
6. 执行用户已批准的命令
7. 生成 Diff
8. Apply / Commit / Discard
9. 记录审计事件
10. 通过 SSE 输出事件流
```

## Runner 不做什么

```txt
1. 不直接暴露公网
2. 不绕过审批执行命令
3. 不默认读取敏感文件
4. 不直接修改原始仓库
5. 不默认访问企业内网服务
```

## 后续 Runner 类型

```txt
Local Runner
Docker Runner
K8s Runner Pool
Secure Runner
```

MVP 阶段只做 Local Runner。
