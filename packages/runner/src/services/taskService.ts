import type { Task, TaskStatus } from '@forgeagent/core'
import {
  canTransitionTaskStatus,
  createForgeAgentError,
} from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import type { RunnerDb } from '../db'
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
    private readonly workspaceService: WorkspaceService,
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
    const now = new Date().toISOString()

    const task: Task = {
      id: `task_${randomUUID()}`,
      workspaceId: workspace.id,
      prompt: input.prompt,
      status: 'created',
      baseBranch: 'unknown',
      baseCommit: 'unknown',
      worktreePath: workspace.gitRoot,
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
      },
    })

    await this.auditService.append({
      taskId: task.id,
      type: 'task.created',
      payload: {
        workspaceId: task.workspaceId,
        prompt: task.prompt,
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

  getDiff(id: string): { taskId: string; diff: string } {
    this.get(id)

    return {
      taskId: id,
      diff: '',
    }
  }

  async apply(id: string): Promise<Task> {
    return this.transition(id, 'applied')
  }

  async commit(id: string): Promise<Task> {
    return this.transition(id, 'committed')
  }

  async discard(id: string): Promise<Task> {
    return this.transition(id, 'discarded')
  }

  async cancel(id: string): Promise<Task> {
    return this.transition(id, 'cancelled')
  }
}
