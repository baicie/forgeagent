import type {
  Task,
  ValidationPlan,
  ValidationResult,
  ValidationSummary,
} from '@forgeagent/core'
import {
  ValidationPlanSchema,
  normalizeValidationCommands,
} from '@forgeagent/core'
import type { ApprovalService } from '../services/approvalService'
import type { EventService } from '../services/eventService'
import type { TaskMemoryService } from '../services/taskMemoryService'
import { loadValidationConfig } from './validationConfig'

export interface CreateValidationPlanInput {
  task: Task
  taskValidation?: {
    commands?: Array<
      string | { command: string; cwd?: string; reason?: string }
    >
    maxFixAttempts?: number
  }
}

export interface RequestNextValidationInput {
  task: Task
  plan: ValidationPlan
}

function now(): string {
  return new Date().toISOString()
}

function summarizeText(text: string | undefined, maxLines = 40): string {
  if (!text) return ''

  const lines = text.split(/\r?\n/).filter(Boolean)

  return lines.slice(-maxLines).join('\n')
}

function createFailureSummary(results: ValidationResult[]): string | undefined {
  const failed = results.find(result => result.status === 'failed')
  const rejected = results.find(result => result.status === 'rejected')

  const target = failed ?? rejected

  if (!target) return undefined

  const chunks = [
    `Command ${target.status}: ${target.command}`,
    target.exitCode !== undefined ? `Exit code: ${target.exitCode}` : undefined,
    target.error ? `Error: ${target.error}` : undefined,
    target.stderr ? `stderr:\n${summarizeText(target.stderr)}` : undefined,
    target.stdout ? `stdout:\n${summarizeText(target.stdout, 20)}` : undefined,
  ].filter(Boolean)

  return chunks.join('\n\n')
}

export class ValidationService {
  private readonly plans = new Map<string, ValidationPlan>()

  constructor(
    private readonly approvalService: ApprovalService,
    private readonly eventService: EventService,
    private readonly taskMemoryService: TaskMemoryService,
  ) {}

  getPlan(taskId: string): ValidationPlan | undefined {
    return this.plans.get(taskId)
  }

  listPlans(): ValidationPlan[] {
    return [...this.plans.values()]
  }

  async createPlan(input: CreateValidationPlanInput): Promise<ValidationPlan> {
    const existing = this.plans.get(input.task.id)

    if (existing) {
      return existing
    }

    const config = await loadValidationConfig({
      repoRoot: input.task.worktreePath,
      taskValidation: input.taskValidation,
    })

    const timestamp = now()
    const plan = ValidationPlanSchema.parse({
      taskId: input.task.id,
      commands: normalizeValidationCommands(config.commands),
      maxFixAttempts: config.maxFixAttempts,
      fixAttempt: 0,
      status: config.commands.length > 0 ? 'pending' : 'skipped',
      results: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    this.plans.set(input.task.id, plan)

    await this.eventService.append({
      taskId: input.task.id,
      type: 'validation.planned',
      payload: {
        status: plan.status,
        fixAttempt: plan.fixAttempt,
        maxFixAttempts: plan.maxFixAttempts,
        summary: this.summarize(plan),
      },
    })

    // Memory append is best-effort; do not block plan creation on failure.
    try {
      await this.taskMemoryService.append({
        taskId: input.task.id,
        file: 'test_results.md',
        heading: 'Validation plan',
        reason: 'Validation plan created',
        content:
          plan.commands.length > 0
            ? plan.commands
                .map(
                  command => `- \`${command.command}\` cwd=\`${command.cwd}\``,
                )
                .join('\n')
            : 'No validation commands configured.',
      })
    } catch {
      // Best-effort memory write; plan is already stored.
    }

    return plan
  }

  hasCommands(plan: ValidationPlan): boolean {
    return plan.commands.length > 0
  }

  /**
   * Read-only preview of what the validation plan would look like.
   * Does NOT persist anything or write events/memory.
   */
  async previewPlan(input: { task: Task }): Promise<ValidationPlan> {
    const config = await loadValidationConfig({
      repoRoot: input.task.worktreePath,
    })

    const timestamp = now()
    return ValidationPlanSchema.parse({
      taskId: input.task.id,
      commands: normalizeValidationCommands(config.commands),
      maxFixAttempts: config.maxFixAttempts,
      fixAttempt: 0,
      status: config.commands.length > 0 ? 'pending' : 'skipped',
      results: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  hasPassed(plan: ValidationPlan): boolean {
    return plan.status === 'passed'
  }

  hasFailed(plan: ValidationPlan): boolean {
    return plan.status === 'failed'
  }

  isWaitingApproval(plan: ValidationPlan): boolean {
    return plan.status === 'waiting_approval'
  }

  isTerminal(plan: ValidationPlan): boolean {
    return ['passed', 'failed', 'rejected', 'skipped'].includes(plan.status)
  }

  shouldRequestValidation(plan: ValidationPlan): boolean {
    return (
      this.hasCommands(plan) &&
      !this.hasPassed(plan) &&
      plan.status !== 'waiting_approval' &&
      plan.status !== 'failed' &&
      plan.status !== 'rejected'
    )
  }

  requiresFixBeforeValidation(plan: ValidationPlan): boolean {
    return plan.status === 'failed' && this.canFixAgain(plan)
  }

  canFinalizeWithFailedValidation(plan: ValidationPlan): boolean {
    // Both 'failed' and 'rejected' are terminal failure states — allow
    // finalization after maxFixAttempts is exhausted (for 'failed') or
    // immediately (for 'rejected' since the user chose to reject).
    return (
      (plan.status === 'failed' || plan.status === 'rejected') &&
      !this.canFixAgain(plan)
    )
  }

  canFixAgain(plan: ValidationPlan): boolean {
    return plan.fixAttempt < plan.maxFixAttempts
  }

  nextPendingCommand(plan: ValidationPlan) {
    const completed = new Set(plan.results.map(result => result.command))

    return plan.commands.find(command => !completed.has(command.command))
  }

  async requestNextValidation(
    input: RequestNextValidationInput,
  ): Promise<ValidationPlan> {
    const next = this.nextPendingCommand(input.plan)

    if (!next) {
      return this.finalizePlan(input.plan.taskId)
    }

    const approval = await this.approvalService.create({
      taskId: input.task.id,
      toolCallId: `validation_${input.task.id}_${Date.now().toString(36)}`,
      command: next.command,
      cwd: input.task.worktreePath,
      reason: next.reason,
      risk: 'medium',
    })

    const updated: ValidationPlan = {
      ...input.plan,
      status: 'waiting_approval',
      results: [
        ...input.plan.results,
        {
          command: next.command,
          cwd: next.cwd,
          status: 'waiting_approval',
          approvalId: approval.id,
        },
      ],
      updatedAt: now(),
    }

    this.plans.set(input.task.id, updated)

    await this.eventService.append({
      taskId: input.task.id,
      type: 'validation.started',
      payload: {
        status: 'waiting_approval',
        command: next.command,
        approvalId: approval.id,
        fixAttempt: updated.fixAttempt,
        maxFixAttempts: updated.maxFixAttempts,
        summary: this.summarize(updated),
      },
    })

    return updated
  }

  async recordCommandResult(input: {
    taskId: string
    command: string
    cwd: string
    ok: boolean
    rejected?: boolean
    approvalId?: string
    exitCode?: number | null
    timedOut?: boolean
    stdout?: string
    stderr?: string
    error?: string
  }): Promise<ValidationPlan | undefined> {
    const plan = this.plans.get(input.taskId)

    if (!plan) return undefined

    const results = plan.results.map(result => {
      if (
        result.command === input.command &&
        (!input.approvalId || result.approvalId === input.approvalId)
      ) {
        return {
          ...result,
          status: input.rejected ? 'rejected' : input.ok ? 'passed' : 'failed',
          ok: input.ok,
          exitCode: input.exitCode,
          timedOut: input.timedOut,
          stdout: input.stdout,
          stderr: input.stderr,
          error: input.error,
          finishedAt: now(),
        } satisfies ValidationResult
      }

      return result
    })

    const hasRejected = results.some(result => result.status === 'rejected')
    const hasFailed = results.some(result => result.status === 'failed')
    const allFinished =
      results.length >= plan.commands.length &&
      results.every(result =>
        ['passed', 'failed', 'rejected'].includes(result.status),
      )

    const status = hasRejected
      ? 'rejected'
      : hasFailed
        ? 'failed'
        : allFinished
          ? 'passed'
          : 'pending'

    const updated: ValidationPlan = {
      ...plan,
      status,
      results,
      updatedAt: now(),
    }

    this.plans.set(input.taskId, updated)

    await this.eventService.append({
      taskId: input.taskId,
      type: 'validation.finished',
      payload: {
        status,
        command: input.command,
        approvalId: input.approvalId,
        fixAttempt: updated.fixAttempt,
        maxFixAttempts: updated.maxFixAttempts,
        summary: this.summarize(updated),
      },
    })

    return updated
  }

  markFixAttempt(taskId: string): ValidationPlan | undefined {
    const plan = this.plans.get(taskId)

    if (!plan) return undefined

    // Only increment fixAttempt, keep results so failureSummary is preserved.
    // Status stays 'failed' so the loop knows validation has not passed.
    const updated: ValidationPlan = {
      ...plan,
      fixAttempt: plan.fixAttempt + 1,
      updatedAt: now(),
    }

    this.plans.set(taskId, updated)

    return updated
  }

  resetForNextValidation(taskId: string): ValidationPlan | undefined {
    const plan = this.plans.get(taskId)

    if (!plan) return undefined

    // Reset only after a new apply_patch is confirmed.
    // Keep fixAttempt so we don't re-count attempts.
    const updated: ValidationPlan = {
      ...plan,
      status: 'pending',
      results: [],
      updatedAt: now(),
    }

    this.plans.set(taskId, updated)

    return updated
  }

  summarize(plan: ValidationPlan): ValidationSummary {
    const passed = plan.results.filter(
      result => result.status === 'passed',
    ).length
    const failed = plan.results.filter(
      result => result.status === 'failed',
    ).length
    const rejected = plan.results.filter(
      result => result.status === 'rejected',
    ).length

    return {
      status: plan.status,
      passed,
      failed,
      rejected,
      total: plan.commands.length,
      fixAttempt: plan.fixAttempt,
      maxFixAttempts: plan.maxFixAttempts,
      failureSummary: createFailureSummary(plan.results),
    }
  }

  createFeedbackPrompt(plan: ValidationPlan): string {
    const summary = this.summarize(plan)

    if (summary.status !== 'failed' && summary.status !== 'rejected') {
      return ''
    }

    return [
      'Validation failed. You must analyze the failure logs, fix the issue, then run validation again.',
      '',
      `Fix attempt: ${summary.fixAttempt}/${summary.maxFixAttempts}`,
      '',
      'Failure summary:',
      '',
      summary.failureSummary ?? 'No failure summary available.',
    ].join('\n')
  }

  private finalizePlan(taskId: string): ValidationPlan {
    const plan = this.plans.get(taskId)

    if (!plan) {
      throw new Error(`Validation plan not found: ${taskId}`)
    }

    const hasRejected = plan.results.some(
      result => result.status === 'rejected',
    )
    const hasFailed = plan.results.some(result => result.status === 'failed')
    const status = hasRejected ? 'rejected' : hasFailed ? 'failed' : 'passed'

    const updated: ValidationPlan = {
      ...plan,
      status,
      updatedAt: now(),
    }

    this.plans.set(taskId, updated)

    return updated
  }
}
