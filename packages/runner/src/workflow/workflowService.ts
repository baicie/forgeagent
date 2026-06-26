import type {
  Task,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepStatus,
} from '@forgeagent/core'
import {
  createInitialWorkflowRun,
  getNextWorkflowStep,
  getWorkflowStep,
} from '@forgeagent/core'
import type { EventService } from '../services/eventService'
import type { WorkspaceService } from '../services/workspaceService'
import { loadWorkflowDefinition } from './workflowConfig'

function now(): string {
  return new Date().toISOString()
}

export class WorkflowService {
  private readonly definitions = new Map<string, WorkflowDefinition>()
  private readonly runs = new Map<string, WorkflowRun>()

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly eventService: EventService,
  ) {}

  getRun(taskId: string): WorkflowRun | undefined {
    return this.runs.get(taskId)
  }

  getDefinition(workflowId: string): WorkflowDefinition | undefined {
    return this.definitions.get(workflowId)
  }

  getCurrentStep(taskId: string): WorkflowStep | undefined {
    const run = this.getRun(taskId)
    if (!run?.currentStepId) return undefined

    const definition = this.definitions.get(run.workflowId)
    if (!definition) return undefined

    try {
      return getWorkflowStep(definition, run.currentStepId)
    } catch {
      return undefined
    }
  }

  async startTaskWorkflow(input: {
    task: Task
    workflowId?: string
  }): Promise<WorkflowRun> {
    const existing = this.runs.get(input.task.id)
    if (existing) return existing

    const workspace = this.workspaceService.get(input.task.workspaceId)
    const definition = await loadWorkflowDefinition({
      repoRoot: input.task.worktreePath ?? workspace.gitRoot,
      workflowId: input.workflowId ?? input.task.workflowId,
    })

    const timestamp = now()
    const run = createInitialWorkflowRun({
      taskId: input.task.id,
      workflow: definition,
      now: timestamp,
    })

    this.definitions.set(definition.id, definition)
    this.runs.set(input.task.id, run)

    await this.eventService.append({
      taskId: input.task.id,
      type: 'workflow.started',
      payload: {
        workflowId: definition.id,
        stepId: run.currentStepId,
        runStatus: run.status,
      },
    })

    return run
  }

  async startCurrentStep(taskId: string): Promise<WorkflowRun> {
    const run = this.requireRun(taskId)
    const stepId = this.requireCurrentStepId(run)
    const definition = this.requireDefinition(run)
    const step = definition.steps.find(item => item.id === stepId)

    const updated = this.updateStep(taskId, stepId, 'running')

    await this.eventService.append({
      taskId,
      type: 'workflow.step.started',
      payload: {
        workflowId: run.workflowId,
        stepId,
        stepType: step?.type,
        status: 'running',
        runStatus: updated.status,
      },
    })

    return updated
  }

  async finishCurrentStep(input: {
    taskId: string
    status?: Extract<
      WorkflowStepStatus,
      'completed' | 'failed' | 'waiting_approval' | 'skipped'
    >
    error?: string
  }): Promise<WorkflowRun> {
    const run = this.requireRun(input.taskId)
    const definition = this.requireDefinition(run)
    const stepId = this.requireCurrentStepId(run)
    const step = getWorkflowStep(definition, stepId)
    const status = input.status ?? 'completed'

    let updated = this.updateStep(input.taskId, stepId, status, input.error)

    if (status === 'completed' || status === 'skipped') {
      const next = getNextWorkflowStep(definition, stepId)
      updated = {
        ...updated,
        currentStepId: next?.id,
        status: next ? 'running' : 'completed',
        updatedAt: now(),
      }
    } else if (status === 'waiting_approval') {
      updated = {
        ...updated,
        status: 'waiting_approval',
        updatedAt: now(),
      }
    } else if (status === 'failed') {
      updated = {
        ...updated,
        status: 'failed',
        updatedAt: now(),
      }
    }

    this.runs.set(input.taskId, updated)

    await this.eventService.append({
      taskId: input.taskId,
      type: 'workflow.step.finished',
      payload: {
        workflowId: run.workflowId,
        stepId,
        stepType: step.type,
        status,
        runStatus: updated.status,
        error: input.error,
      },
    })

    if (updated.status === 'completed') {
      await this.eventService.append({
        taskId: input.taskId,
        type: 'workflow.finished',
        payload: {
          workflowId: run.workflowId,
          runStatus: 'completed',
        },
      })
    }

    return updated
  }

  assertToolAllowed(taskId: string, toolName: string): void {
    const step = this.getCurrentStep(taskId)

    if (!step || step.tools.length === 0) {
      return
    }

    if (!step.tools.includes(toolName)) {
      throw new Error(
        `Tool ${toolName} is not allowed in workflow step ${step.id}`,
      )
    }
  }

  assertMemoryWriteAllowed(taskId: string, file: string): void {
    const step = this.getCurrentStep(taskId)

    if (!step || step.memory.write.length === 0) {
      return
    }

    if (!step.memory.write.includes(file)) {
      throw new Error(
        `Memory file ${file} is not writable in workflow step ${step.id}`,
      )
    }
  }

  private requireRun(taskId: string): WorkflowRun {
    const run = this.runs.get(taskId)
    if (!run) throw new Error(`Workflow run not found: ${taskId}`)
    return run
  }

  private requireDefinition(run: WorkflowRun): WorkflowDefinition {
    const definition = this.definitions.get(run.workflowId)
    if (!definition)
      throw new Error(`Workflow definition not found: ${run.workflowId}`)
    return definition
  }

  private requireCurrentStepId(run: WorkflowRun): string {
    if (!run.currentStepId) {
      throw new Error(`Workflow has no current step: ${run.taskId}`)
    }
    return run.currentStepId
  }

  private updateStep(
    taskId: string,
    stepId: string,
    status: WorkflowStepStatus,
    error?: string,
  ): WorkflowRun {
    const run = this.requireRun(taskId)
    const timestamp = now()

    const updated: WorkflowRun = {
      ...run,
      status:
        status === 'waiting_approval'
          ? 'waiting_approval'
          : status === 'failed'
            ? 'failed'
            : 'running',
      steps: run.steps.map(step =>
        step.stepId === stepId
          ? {
              ...step,
              status,
              startedAt: step.startedAt ?? timestamp,
              finishedAt:
                status === 'completed' ||
                status === 'failed' ||
                status === 'skipped'
                  ? timestamp
                  : step.finishedAt,
              error,
            }
          : step,
      ),
      updatedAt: timestamp,
    }

    this.runs.set(taskId, updated)
    return updated
  }
}
