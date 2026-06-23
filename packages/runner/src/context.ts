import type { RunnerConfig } from './config'
import type { RunnerDb } from './db'
import { GitDiffService } from './git/diff'
import { GitClient } from './git/gitClient'
import { GitPatchService } from './git/patch'
import { GitRepositoryService } from './git/repository'
import { GitWorktreeService } from './git/worktree'
import { ApprovalGate } from './shell/approvalGate'
import { CommandPolicy } from './shell/commandPolicy'
import { ShellExecutor } from './shell/shellExecutor'
import { ApprovalService } from './services/approvalService'
import { AuditService } from './services/auditService'
import { EventService } from './services/eventService'
import { TaskService } from './services/taskService'
import { WorkspaceService } from './services/workspaceService'

export interface RunnerContext {
  config: RunnerConfig
  db: RunnerDb
  gitClient: GitClient
  gitRepositoryService: GitRepositoryService
  gitWorktreeService: GitWorktreeService
  gitDiffService: GitDiffService
  gitPatchService: GitPatchService
  shellExecutor: ShellExecutor
  commandPolicy: CommandPolicy
  approvalGate: ApprovalGate
  workspaceService: WorkspaceService
  taskService: TaskService
  eventService: EventService
  approvalService: ApprovalService
  auditService: AuditService
}

export function createRunnerContext(
  config: RunnerConfig,
  db: RunnerDb,
): RunnerContext {
  const gitClient = new GitClient()
  const gitRepositoryService = new GitRepositoryService(gitClient)
  const gitWorktreeService = new GitWorktreeService(gitClient)
  const gitDiffService = new GitDiffService(gitClient)
  const gitPatchService = new GitPatchService(gitClient, gitDiffService)

  const shellExecutor = new ShellExecutor()
  const commandPolicy = new CommandPolicy()

  const eventService = new EventService(db)
  const auditService = new AuditService(db)
  const workspaceService = new WorkspaceService(db, gitRepositoryService)
  const taskService = new TaskService(
    db,
    config,
    workspaceService,
    gitRepositoryService,
    gitWorktreeService,
    gitDiffService,
    eventService,
    auditService,
  )
  const approvalService = new ApprovalService(db, eventService, auditService)
  const approvalGate = new ApprovalGate({
    approvalService,
    taskService,
    eventService,
    auditService,
    shellExecutor,
    commandPolicy,
  })

  return {
    config,
    db,
    gitClient,
    gitRepositoryService,
    gitWorktreeService,
    gitDiffService,
    gitPatchService,
    shellExecutor,
    commandPolicy,
    approvalGate,
    workspaceService,
    taskService,
    eventService,
    approvalService,
    auditService,
  }
}
