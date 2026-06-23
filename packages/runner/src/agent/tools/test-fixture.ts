import type { Task, Workspace } from '@forgeagent/core'
import { loadRunnerConfig } from '../../config'
import { createInMemoryRunnerDb } from '../../db'
import { GitDiffService } from '../../git/diff'
import { GitClient } from '../../git/gitClient'
import { GitPatchService } from '../../git/patch'
import { GitCommitService } from '../../git/commit'
import { GitRepositoryService } from '../../git/repository'
import { GitWorktreeService } from '../../git/worktree'
import { createGitFixture } from '../../test/git-fixtures'
import type { GitFixture } from '../../test/git-fixtures'
import { ApprovalService } from '../../services/approvalService'
import { AuditService } from '../../services/auditService'
import { EventService } from '../../services/eventService'
import { TaskService } from '../../services/taskService'
import { WorkspaceService } from '../../services/workspaceService'
import type { RunnerToolContext } from './types'

export interface ToolTestFixture {
  gitFixture: GitFixture
  context: RunnerToolContext
  workspace: Workspace
  task: Task
  taskService: TaskService
  approvalService: ApprovalService
  eventService: EventService
  cleanup: () => Promise<void>
}

export async function createToolTestFixture(): Promise<ToolTestFixture> {
  const gitFixture = await createGitFixture()
  const config = loadRunnerConfig({
    dataDir: `${gitFixture.tempDir}/.forgeagent`,
  })
  const db = createInMemoryRunnerDb()

  const gitClient = new GitClient()
  const gitRepositoryService = new GitRepositoryService(gitClient)
  const gitWorktreeService = new GitWorktreeService(gitClient)
  const gitDiffService = new GitDiffService(gitClient)
  const gitPatchService = new GitPatchService(gitClient, gitDiffService)
  const gitCommitService = new GitCommitService(gitClient, gitDiffService)

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
    gitPatchService,
    gitCommitService,
    eventService,
    auditService,
  )
  const approvalService = new ApprovalService(db, eventService, auditService)

  const workspace = await workspaceService.create({
    repoPath: gitFixture.repoPath,
  })

  const task = await taskService.create({
    workspaceId: workspace.id,
    prompt: 'tool test',
  })

  return {
    gitFixture,
    workspace,
    task,
    taskService,
    approvalService,
    eventService,
    context: {
      task,
      workspace,
      worktreePath: task.worktreePath,
      taskService,
      approvalService,
    },
    async cleanup() {
      await gitFixture.cleanup()
    },
  }
}
