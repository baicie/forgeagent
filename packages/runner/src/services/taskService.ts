import type { Task, TaskStatus } from '@forgeagent/core'
import {
  canTransitionTaskStatus,
  createForgeAgentError,
} from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import type { RunnerConfig } from '../config'
import type { RunnerDb } from '../db'
import type { GitCommitService } from '../git/commit'
import type { GitDiffService } from '../git/diff'
import { assertOriginalRepoReadyForApply } from '../git/deliveryGuard'
import type { GitPatchService } from '../git/patch'
import type { GitRepositoryService } from '../git/repository'
import type { GitWorktreeService } from '../git/worktree'
import type { AuditService } from './auditService'
import type { EventService } from './eventService'
import type { WorkspaceService } from './workspaceService'

export interface CreateTaskInput {
  workspaceId: string
  prompt: string
}

export interface CommitTaskInput {
  message?: string
}

function createDefaultCommitMessage(task: Task): string {
  const prompt = task.prompt.trim().replace(/\s+/g, ' ').slice(0, 72)

  return prompt ? `forgeagent: ${prompt}` : `forgeagent: ${task.id}`
}

function normalizeCommitMessage(task: Task, message?: string): string {
  const normalized = message?.trim()

  return normalized || createDefaultCommitMessage(task)
}

export class TaskService {
  constructor(
    private readonly db: RunnerDb,
    private readonly config: RunnerConfig,
    private readonly workspaceService: WorkspaceService,
    private readonly gitRepositoryService: GitRepositoryService,
    private readonly gitWorktreeService: GitWorktreeService,
    private readonly gitDiffService: GitDiffService,
    private readonly gitPatchService: GitPatchService,
    private readonly gitCommitService: GitCommitService,
    private readonly eventService: EventService,
    private readonly auditService: AuditService,
  ) {}

  list(): Task[] {
    return this.db.state.tasks
  }

  get(id: string): Task {
    const task = this.db.state.tasks.find(item => item.id === id)

    if (!task) {
      throw createForgeAgentError('TASK_NOT_FOUND', `Task not found: ${id}`, {
        id,
      })
    }

    return task
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const workspace = this.workspaceService.get(input.workspaceId)
    const repositoryInfo = await this.gitRepositoryService.getRepositoryInfo(
      workspace.gitRoot,
    )
    const taskId = `task_${randomUUID()}`

    let worktreePath: string | undefined

    try {
      const worktree = await this.gitWorktreeService.create({
        gitRoot: repositoryInfo.gitRoot,
        taskId,
        dataDir: this.config.dataDir,
      })

      worktreePath = worktree.worktreePath

      const now = new Date().toISOString()

      const task: Task = {
        id: taskId,
        workspaceId: workspace.id,
        prompt: input.prompt,
        status: 'created',
        baseBranch: repositoryInfo.currentBranch,
        baseCommit: repositoryInfo.currentCommit,
        worktreePath: worktree.worktreePath,
        createdAt: now,
        updatedAt: now,
      }

      this.db.state.tasks.push(task)
      await this.db.save()

      await this.eventService.append({
        taskId: task.id,
        type: 'task.status',
        payload: {
          status: task.status,
          worktreePath: task.worktreePath,
          baseBranch: task.baseBranch,
          baseCommit: task.baseCommit,
        },
      })

      await this.auditService.append({
        taskId: task.id,
        type: 'task.created',
        payload: {
          workspaceId: task.workspaceId,
          prompt: task.prompt,
          baseBranch: task.baseBranch,
          baseCommit: task.baseCommit,
          worktreePath: task.worktreePath,
        },
      })

      return task
    } catch (error) {
      await this.cleanupFailedTaskCreate({
        gitRoot: repositoryInfo.gitRoot,
        taskId,
        worktreePath,
      })

      throw error
    }
  }

  async prepare(id: string, reason?: string): Promise<Task> {
    return this.transition(id, 'preparing', reason)
  }

  async start(id: string, reason?: string): Promise<Task> {
    return this.transition(id, 'running', reason)
  }

  async waitForApproval(id: string, reason?: string): Promise<Task> {
    return this.transition(id, 'waiting_approval', reason)
  }

  async resume(id: string, reason?: string): Promise<Task> {
    return this.transition(id, 'running', reason)
  }

  async complete(id: string, output?: unknown): Promise<Task> {
    const task = await this.transition(id, 'completed', 'Task completed')

    await this.eventService.append({
      taskId: task.id,
      type: 'task.completed',
      payload: {
        output,
      },
    })

    return task
  }

  async fail(id: string, error: unknown): Promise<Task> {
    const task = await this.transition(id, 'failed', 'Task failed')

    await this.eventService.append({
      taskId: task.id,
      type: 'task.failed',
      payload: {
        error,
      },
    })

    return task
  }

  async transition(
    id: string,
    status: TaskStatus,
    reason?: string,
  ): Promise<Task> {
    const task = this.get(id)

    if (!canTransitionTaskStatus(task.status, status)) {
      throw createForgeAgentError(
        'INVALID_TASK_STATUS_TRANSITION',
        `Invalid task status transition: ${task.status} -> ${status}`,
        {
          taskId: id,
          from: task.status,
          to: status,
        },
      )
    }

    const previousStatus = task.status

    task.status = status
    task.updatedAt = new Date().toISOString()

    await this.db.save()

    await this.eventService.append({
      taskId: task.id,
      type: 'task.status',
      payload: {
        previousStatus,
        status,
        reason,
      },
    })

    await this.auditService.append({
      taskId: task.id,
      type: 'task.status_changed',
      payload: {
        previousStatus,
        status,
        reason,
      },
    })

    return task
  }

  async getDiff(id: string): Promise<{ taskId: string; diff: string }> {
    const task = this.get(id)
    const diff = await this.gitDiffService.getDiff(task.worktreePath)

    await this.eventService.append({
      taskId: task.id,
      type: 'diff.updated',
      payload: {
        changed: diff.trim().length > 0,
        bytes: Buffer.byteLength(diff, 'utf-8'),
      },
    })

    await this.auditService.append({
      taskId: task.id,
      type: 'diff.generated',
      payload: {
        changed: diff.trim().length > 0,
        bytes: Buffer.byteLength(diff, 'utf-8'),
      },
    })

    return {
      taskId: id,
      diff,
    }
  }

  async apply(id: string): Promise<Task> {
    const task = this.get(id)
    this.assertCanDeliver(task, 'applied')

    const workspace = this.workspaceService.get(task.workspaceId)

    await assertOriginalRepoReadyForApply({
      task,
      gitRoot: workspace.gitRoot,
      gitRepositoryService: this.gitRepositoryService,
    })

    const patch = await this.gitPatchService.createPatchFromWorktree(
      task.id,
      task.worktreePath,
      this.config.dataDir,
    )

    await this.gitPatchService.applyPatch(workspace.gitRoot, patch.patchFile)

    const appliedTask = await this.transition(id, 'applied', 'Task applied')

    await this.eventService.append({
      taskId: task.id,
      type: 'agent.message',
      payload: {
        role: 'system',
        message: `Patch applied to original repository: ${patch.patchFile}`,
      },
    })

    await this.auditService.append({
      taskId: task.id,
      type: 'task.applied',
      payload: {
        patchFile: patch.patchFile,
        bytes: patch.bytes,
        gitRoot: workspace.gitRoot,
      },
    })

    return appliedTask
  }

  async commit(id: string, input: CommitTaskInput = {}): Promise<Task> {
    const task = this.get(id)
    this.assertCanDeliver(task, 'committed')

    const message = normalizeCommitMessage(task, input.message)

    const result = await this.gitCommitService.commitWorktree(
      task.worktreePath,
      message,
    )

    const committedTask = await this.transition(
      id,
      'committed',
      'Task committed',
    )

    await this.eventService.append({
      taskId: task.id,
      type: 'agent.message',
      payload: {
        role: 'system',
        message: `Worktree committed: ${result.commitSha}`,
      },
    })

    await this.auditService.append({
      taskId: task.id,
      type: 'task.committed',
      payload: {
        commitSha: result.commitSha,
        message: result.message,
        worktreePath: task.worktreePath,
      },
    })

    return committedTask
  }

  async discard(id: string): Promise<Task> {
    const task = this.get(id)

    if (task.status === 'discarded') {
      return task
    }

    const workspace = this.workspaceService.get(task.workspaceId)

    await this.gitWorktreeService.discard(
      workspace.gitRoot,
      task.worktreePath,
      task.id,
    )

    const discardedTask = await this.transition(
      id,
      'discarded',
      'Task discarded',
    )

    await this.auditService.append({
      taskId: task.id,
      type: 'task.discarded',
      payload: {
        worktreePath: task.worktreePath,
      },
    })

    return discardedTask
  }

  async cancel(id: string): Promise<Task> {
    return this.transition(id, 'cancelled', 'Task cancelled')
  }

  private assertCanDeliver(task: Task, status: 'applied' | 'committed'): void {
    if (!canTransitionTaskStatus(task.status, status)) {
      throw createForgeAgentError(
        'INVALID_TASK_STATUS_TRANSITION',
        `Invalid task status transition: ${task.status} -> ${status}`,
        {
          taskId: task.id,
          from: task.status,
          to: status,
        },
      )
    }
  }

  private async cleanupFailedTaskCreate(input: {
    gitRoot: string
    taskId: string
    worktreePath?: string
  }): Promise<void> {
    if (input.worktreePath) {
      try {
        await this.gitWorktreeService.discard(
          input.gitRoot,
          input.worktreePath,
          input.taskId,
        )
      } catch {
        // Best-effort cleanup. Keep the original create() error.
      }
    }

    this.db.state.tasks = this.db.state.tasks.filter(
      task => task.id !== input.taskId,
    )
    this.db.state.events = this.db.state.events.filter(
      event => event.taskId !== input.taskId,
    )
    this.db.state.audits = this.db.state.audits.filter(
      audit => audit.taskId !== input.taskId,
    )
    this.db.state.approvals = this.db.state.approvals.filter(
      approval => approval.taskId !== input.taskId,
    )

    try {
      await this.db.save()
    } catch {
      // Best-effort cleanup. Keep the original create() error.
    }
  }
}
