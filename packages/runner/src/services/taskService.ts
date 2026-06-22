import type { Task, TaskStatus } from '@forgeagent/core'
import {
  canTransitionTaskStatus,
  createForgeAgentError,
} from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import type { RunnerConfig } from '../config'
import type { RunnerDb } from '../db'
import type { GitDiffService } from '../git/diff'
import type { GitRepositoryService } from '../git/repository'
import type { GitWorktreeService } from '../git/worktree'
import type { AuditService } from './auditService'
import type { EventService } from './eventService'
import type { WorkspaceService } from './workspaceService'

export interface CreateTaskInput {
  workspaceId: string
  prompt: string
}

export class TaskService {
  constructor(
    private readonly db: RunnerDb,
    private readonly config: RunnerConfig,
    private readonly workspaceService: WorkspaceService,
    private readonly gitRepositoryService: GitRepositoryService,
    private readonly gitWorktreeService: GitWorktreeService,
    private readonly gitDiffService: GitDiffService,
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
    const worktree = await this.gitWorktreeService.create({
      gitRoot: repositoryInfo.gitRoot,
      taskId,
      dataDir: this.config.dataDir,
    })
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
  }

  async transition(id: string, status: TaskStatus): Promise<Task> {
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
      },
    })

    await this.auditService.append({
      taskId: task.id,
      type: 'task.status_changed',
      payload: {
        previousStatus,
        status,
      },
    })

    return task
  }

  async getDiff(id: string): Promise<{ taskId: string; diff: string }> {
    const task = this.get(id)
    const diff = await this.gitDiffService.getDiff(task.worktreePath)

    return {
      taskId: id,
      diff,
    }
  }

  async apply(id: string): Promise<Task> {
    return this.transition(id, 'applied')
  }

  async commit(id: string): Promise<Task> {
    return this.transition(id, 'committed')
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

    const discardedTask = await this.transition(id, 'discarded')

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
    return this.transition(id, 'cancelled')
  }
}
