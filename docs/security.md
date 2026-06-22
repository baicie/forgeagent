# ForgeAgent Security

ForgeAgent 的安全基线是：

```txt
Local-first
Private-first
Runner-based
Approval-first
Auditable
Git-native
```

## 核心安全原则

### 1. Agent 不直接修改原始仓库

所有任务必须在 git worktree 中执行。

```txt
原始仓库
  ↓
git worktree
  ↓
Agent 修改 worktree
  ↓
用户 apply / commit / discard
```

### 2. Console 不执行命令

命令执行只能发生在 Runner。

### 3. run_command 必须审批

任何 shell 命令都必须创建 Approval，等待用户 approve。

### 4. 默认拒绝敏感文件

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

### 5. 默认忽略大目录

默认忽略：

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

### 6. 高风险命令必须显式提示

危险命令包括：

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

## MVP 审计范围

必须记录：

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

## 当前 Phase 0

Phase 0 只做项目身份收敛，不实现安全执行逻辑。

安全执行逻辑从 Phase 1 开始逐步落地。
