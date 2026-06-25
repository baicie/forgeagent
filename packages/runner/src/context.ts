import { ContextPackBuilder } from './context/contextPackBuilder'
import type { RunnerConfig } from './config'
import type { RunnerDb } from './db'
import { ForgeAgentLoop } from './agent/loop'
import {
  OpenAICompatibleModelGateway,
  loadModelGatewayConfigFromEnv,
} from './agent/model'
import { GitCommitService } from './git/commit'
import { GitDiffService } from './git/diff'
import { GitClient } from './git/gitClient'
import { GitPatchService } from './git/patch'
import { GitRepositoryService } from './git/repository'
import { GitWorktreeService } from './git/worktree'
import { GitWorkspaceSnapshotService } from './git/workspaceSnapshot'
import { ApprovalGate } from './shell/approvalGate'
import { CommandPolicy } from './shell/commandPolicy'
import { ShellExecutor } from './shell/shellExecutor'
import { ApprovalService } from './services/approvalService'
import { AuditService } from './services/auditService'
import { EventService } from './services/eventService'
import { TaskMemoryService } from './services/taskMemoryService'
import { TaskService } from './services/taskService'
import { WorkspaceService } from './services/workspaceService'
import { DiskSpaceService } from './storage/disk'

export interface RunnerContext {
  config: RunnerConfig
  db: RunnerDb
  modelGateway: OpenAICompatibleModelGateway
  agentLoop: ForgeAgentLoop
  gitClient: GitClient
  gitRepositoryService: GitRepositoryService
  gitWorktreeService: GitWorktreeService
  gitWorkspaceSnapshotService: GitWorkspaceSnapshotService
  gitDiffService: GitDiffService
  gitPatchService: GitPatchService
  gitCommitService: GitCommitService
  diskSpaceService: DiskSpaceService
  shellExecutor: ShellExecutor
  commandPolicy: CommandPolicy
  approvalGate: ApprovalGate
  workspaceService: WorkspaceService
  taskService: TaskService
  eventService: EventService
  approvalService: ApprovalService
  auditService: AuditService
  taskMemoryService: TaskMemoryService
  contextPackBuilder: ContextPackBuilder
}

export function createRunnerContext(
  config: RunnerConfig,
  db: RunnerDb,
): RunnerContext {
  const gitClient = new GitClient()
  const gitRepositoryService = new GitRepositoryService(gitClient)
  const gitWorktreeService = new GitWorktreeService(gitClient)
  const gitWorkspaceSnapshotService = new GitWorkspaceSnapshotService(gitClient)
  const gitDiffService = new GitDiffService(gitClient)
  const gitPatchService = new GitPatchService(gitClient, gitDiffService)
  const gitCommitService = new GitCommitService(gitClient, gitDiffService)
  const diskSpaceService = new DiskSpaceService()

  const shellExecutor = new ShellExecutor()
  const commandPolicy = new CommandPolicy()

  const eventService = new EventService(db)
  const auditService = new AuditService(db)
  const taskMemoryService = new TaskMemoryService(config, eventService)
  const contextPackBuilder = new ContextPackBuilder(
    config,
    taskMemoryService,
    gitDiffService,
  )
  const workspaceService = new WorkspaceService(db, gitRepositoryService)
  const taskService = new TaskService(
    db,
    config,
    workspaceService,
    gitRepositoryService,
    gitWorktreeService,
    gitDiffService,
    gitPatchService,
    gitCommitService,
    eventService,
    auditService,
    gitWorkspaceSnapshotService,
    diskSpaceService,
    taskMemoryService,
  )

  const approvalService = new ApprovalService(db, eventService, auditService)

  const approvalGate = new ApprovalGate({
    approvalService,
    taskService,
    eventService,
    auditService,
    shellExecutor,
    commandPolicy,
    taskMemoryService,
  })

  const modelGateway = new OpenAICompatibleModelGateway(
    loadModelGatewayConfigFromEnv(),
  )

  const context = {
    config,
    db,
    modelGateway,
    agentLoop: undefined as unknown as ForgeAgentLoop,
    gitClient,
    gitRepositoryService,
    gitWorktreeService,
    gitWorkspaceSnapshotService,
    gitDiffService,
    gitPatchService,
    gitCommitService,
    diskSpaceService,
    shellExecutor,
    commandPolicy,
    approvalGate,
    workspaceService,
    taskService,
    eventService,
    approvalService,
    auditService,
    taskMemoryService,
    contextPackBuilder,
  }

  context.agentLoop = new ForgeAgentLoop(context, modelGateway)

  return context
}
