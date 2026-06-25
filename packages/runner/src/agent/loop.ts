import type { Task } from '@forgeagent/core'
import {
  canTransitionTaskStatus,
  createForgeAgentError,
} from '@forgeagent/core'
import type { RunnerContext } from '../context'
import type { RunnerToolContext } from './tools'
import { serializeToolRecordForEvent } from './tools/registry'
import type {
  ChatMessage,
  ModelGenerateInput,
  OpenAICompatibleModelGateway,
} from './model'
import {
  createCompactToolResultPrompt,
  createContextPackPrompt,
  createJsonRetryPrompt,
  createSystemPrompt,
  createTaskEventHistoryPrompt,
  createTaskPrompt,
  createValidationFeedbackPrompt,
  createValidationFinalRiskPrompt,
} from './prompts'
import { normalizeFinalSummary, parseAgentStepResponse } from './json'
import type { AgentStepResponse, AgentToolName } from './json'
import { createAgentRunContext } from './context'

export const DEFAULT_MAX_AGENT_STEPS = 30
export const DEFAULT_MAX_TOOL_OUTPUT_CHARS = 20_000
export const DEFAULT_JSON_RETRY_LIMIT = 2
export const DEFAULT_MAX_EVENT_HISTORY_CHARS = 8_000
export const DEFAULT_COMPACT_TOOL_RESULT_CHARS = 8_000

export interface AgentLoopOptions {
  maxSteps?: number
  maxToolOutputChars?: number
  jsonRetryLimit?: number
  maxEventHistoryChars?: number
  compactToolResultChars?: number
}

export interface AgentLoopResult {
  task: Task
  status: 'completed' | 'failed' | 'waiting_approval'
  finalMessage?: string
}

export class ForgeAgentLoop {
  constructor(
    private readonly runner: RunnerContext,
    private readonly model: OpenAICompatibleModelGateway,
    private readonly options: AgentLoopOptions = {},
  ) {}

  async run(taskId: string): Promise<AgentLoopResult> {
    try {
      return await this.runUnsafe(taskId)
    } catch (error) {
      const failed = await this.failTaskIfPossible(taskId, error)

      if (failed) {
        return failed
      }

      throw error
    }
  }

  private async runUnsafe(taskId: string): Promise<AgentLoopResult> {
    const maxSteps = this.options.maxSteps ?? DEFAULT_MAX_AGENT_STEPS
    const maxToolOutputChars =
      this.options.maxToolOutputChars ?? DEFAULT_MAX_TOOL_OUTPUT_CHARS
    const jsonRetryLimit =
      this.options.jsonRetryLimit ?? DEFAULT_JSON_RETRY_LIMIT
    const maxEventHistoryChars =
      this.options.maxEventHistoryChars ?? DEFAULT_MAX_EVENT_HISTORY_CHARS
    const compactChars =
      this.options.compactToolResultChars ??
      this.runner.config.compactToolResultMaxChars ??
      DEFAULT_COMPACT_TOOL_RESULT_CHARS

    let hasAppliedPatch = false
    let hasCheckedDiffAfterChange = false

    const runContext = createAgentRunContext(this.runner, taskId)

    await this.runner.taskMemoryService?.ensureTaskMemory(runContext.task)

    await this.ensureRunning(runContext.task.id)

    const latestTask = this.runner.taskService.get(taskId)

    const contextPack = await this.runner.contextPackBuilder.build({
      task: latestTask,
      workspace: runContext.workspace,
    })

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: createSystemPrompt(),
      },
      {
        role: 'user',
        content: createTaskPrompt({
          prompt: latestTask.prompt,
          worktreePath: latestTask.worktreePath,
          baseBranch: latestTask.baseBranch,
          baseCommit: latestTask.baseCommit,
        }),
      },
      {
        role: 'user',
        content: createContextPackPrompt(contextPack.content),
      },
    ]

    // Attempt to load or create validation plan; best-effort so tests
    // with unmocked filesystems continue to work.
    let validationPlan = this.runner.validationService.getPlan(taskId)

    if (!validationPlan) {
      try {
        validationPlan = await this.runner.validationService.createPlan({
          task: latestTask,
          taskValidation: latestTask.validation,
        })
      } catch {
        // Best-effort: continue without validation plan.
      }
    }

    if (validationPlan) {
      const currentSummary =
        this.runner.validationService.summarize(validationPlan)

      if (
        currentSummary?.status === 'failed' &&
        currentSummary.fixAttempt < currentSummary.maxFixAttempts
      ) {
        this.runner.validationService.markFixAttempt(taskId)
        messages.push({
          role: 'user',
          content: createValidationFeedbackPrompt({
            failureSummary:
              currentSummary.failureSummary ?? 'Validation failed.',
            fixAttempt: currentSummary.fixAttempt + 1,
            maxFixAttempts: currentSummary.maxFixAttempts,
          }),
        })
      } else if (
        currentSummary?.status === 'failed' &&
        currentSummary.fixAttempt >= currentSummary.maxFixAttempts
      ) {
        messages.push({
          role: 'user',
          content: createValidationFinalRiskPrompt({
            failureSummary:
              currentSummary.failureSummary ?? 'Validation failed.',
            fixAttempt: currentSummary.fixAttempt,
            maxFixAttempts: currentSummary.maxFixAttempts,
          }),
        })
      }
    }

    const historyEvents = this.runner.eventService.listTaskEvents(taskId)

    if (historyEvents.length > 0) {
      messages.push({
        role: 'user',
        content: createTaskEventHistoryPrompt({
          events: historyEvents,
          maxChars: maxEventHistoryChars,
        }),
      })
    }

    for (let step = 1; step <= maxSteps; step += 1) {
      await this.runner.eventService.append({
        taskId,
        type: 'agent.message',
        payload: {
          role: 'system',
          message: `Agent step ${step}/${maxSteps}`,
        },
      })

      const response = await this.generateAndParseWithRetry(
        messages,
        jsonRetryLimit,
        taskId,
      )

      await this.runner.eventService.append({
        taskId,
        type: 'agent.message',
        payload: {
          role: 'assistant',
          message: response.message,
        },
      })

      await this.runner.taskMemoryService?.recordAgentStep({
        taskId,
        step,
        maxSteps,
        message: response.message,
        actionName: response.action?.name,
      })

      messages.push({
        role: 'assistant',
        content: JSON.stringify(response),
      })

      if (response.final) {
        const latestPlan =
          this.runner.validationService.getPlan(taskId) ?? validationPlan
        const hasDiff = await this.hasCurrentDiff(taskId)

        if (hasAppliedPatch && !hasCheckedDiffAfterChange) {
          messages.push({
            role: 'user',
            content:
              '你已经修改了文件，但还没有 get_diff。完成前必须先调用 get_diff 查看当前 diff。',
          })
          continue
        }

        if (
          latestPlan &&
          hasDiff &&
          this.runner.validationService.hasCommands(latestPlan)
        ) {
          if (this.runner.validationService.isWaitingApproval(latestPlan)) {
            return {
              task: this.runner.taskService.get(taskId),
              status: 'waiting_approval',
              finalMessage: 'Validation command is waiting for approval.',
            }
          }

          if (
            this.runner.validationService.requiresFixBeforeValidation(
              latestPlan,
            )
          ) {
            messages.push({
              role: 'user',
              content: createValidationFeedbackPrompt({
                failureSummary:
                  this.runner.validationService.summarize(latestPlan)
                    .failureSummary ?? 'Validation failed.',
                fixAttempt: latestPlan.fixAttempt,
                maxFixAttempts: latestPlan.maxFixAttempts,
              }),
            })
            continue
          }

          if (
            !this.runner.validationService.hasPassed(latestPlan) &&
            this.runner.validationService.shouldRequestValidation(latestPlan)
          ) {
            const pendingPlan =
              await this.runner.validationService.requestNextValidation({
                task: this.runner.taskService.get(taskId),
                plan: latestPlan,
              })

            await this.runner.taskService.waitForApproval(
              taskId,
              'Validation command requires approval',
            )

            return {
              task: this.runner.taskService.get(taskId),
              status: 'waiting_approval',
              finalMessage: `Validation approval requested: ${
                pendingPlan.results.at(-1)?.command ?? ''
              }`,
            }
          }

          if (
            !this.runner.validationService.hasPassed(latestPlan) &&
            !this.runner.validationService.canFinalizeWithFailedValidation(
              latestPlan,
            )
          ) {
            messages.push({
              role: 'user',
              content:
                '验证尚未通过，不能 final。请根据验证结果继续修复，修复后 get_diff 并重新验证。',
            })
            continue
          }
        }

        const summary = normalizeFinalSummary(
          response.message,
          response.summary,
        )

        const latestValidationPlan =
          this.runner.validationService.getPlan(taskId)
        const validationSummary = latestValidationPlan
          ? this.runner.validationService.summarize(latestValidationPlan)
          : undefined

        const finalMessage = JSON.stringify(
          {
            message: response.message,
            summary: {
              ...summary,
              validation: validationSummary,
            },
          },
          null,
          2,
        )

        await this.runner.taskService.complete(taskId, {
          message: response.message,
          summary: {
            ...summary,
            validation: validationSummary,
          },
        })

        return {
          task: this.runner.taskService.get(taskId),
          status: 'completed',
          finalMessage,
        }
      }

      const action = response.action

      if (!action) {
        throw createForgeAgentError(
          'MODEL_RESPONSE_INVALID',
          'Agent response does not contain action',
          {
            response,
          },
        )
      }

      const toolResult = await this.executeAction(
        runContext.toolContext,
        action.name,
        action.args,
      )

      if (action.name === 'apply_patch') {
        hasAppliedPatch = true
        hasCheckedDiffAfterChange = false

        // If validation failed before, a successful patch resets the plan so
        // the next final gate can request fresh validation.
        const plan = this.runner.validationService.getPlan(taskId)
        if (plan?.status === 'failed') {
          this.runner.validationService.resetForNextValidation(taskId)
        }
      }

      if (action.name === 'get_diff') {
        hasCheckedDiffAfterChange = true
      }

      const serializedToolResult = this.truncateToolOutput(
        toolResult,
        maxToolOutputChars,
      )

      messages.push({
        role: 'user',
        content: createCompactToolResultPrompt({
          toolName: action.name,
          result: serializedToolResult.value,
          truncated: serializedToolResult.truncated,
          maxChars: compactChars,
        }),
      })

      const currentTask = this.runner.taskService.get(taskId)

      if (currentTask.status === 'waiting_approval') {
        return {
          task: currentTask,
          status: 'waiting_approval',
        }
      }
    }

    const error = {
      message: `Agent exceeded maxSteps: ${maxSteps}`,
      maxSteps,
    }

    await this.runner.taskService.fail(taskId, error)

    return {
      task: this.runner.taskService.get(taskId),
      status: 'failed',
      finalMessage: error.message,
    }
  }

  private async ensureRunning(taskId: string): Promise<void> {
    const task = this.runner.taskService.get(taskId)

    switch (task.status) {
      case 'created':
        await this.runner.taskService.prepare(taskId, 'Preparing agent loop')
        await this.runner.taskService.start(taskId, 'Starting agent loop')
        return

      case 'preparing':
        await this.runner.taskService.start(taskId, 'Starting agent loop')
        return

      case 'running':
        return

      case 'waiting_approval':
        return

      default:
        throw createForgeAgentError(
          'TASK_NOT_RUNNING',
          `Cannot run agent from task status: ${task.status}`,
          {
            taskId,
            status: task.status,
          },
        )
    }
  }

  private async generateAndParseWithRetry(
    messages: ChatMessage[],
    retryLimit: number,
    taskId: string,
  ): Promise<AgentStepResponse> {
    let lastError: unknown
    const maxAttempts = retryLimit + 1

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = await this.model.generate({
        messages,
      } as ModelGenerateInput)

      try {
        return parseAgentStepResponse(result.content)
      } catch (error) {
        lastError = error

        if (attempt >= maxAttempts) {
          break
        }

        await this.runner.eventService.append({
          taskId,
          type: 'agent.message',
          payload: {
            role: 'system',
            message: `Model JSON parse failed, retry ${attempt}/${retryLimit}`,
          },
        })

        messages.push({
          role: 'assistant',
          content: result.content,
        })
        messages.push({
          role: 'user',
          content: createJsonRetryPrompt(
            error instanceof Error ? error.message : String(error),
          ),
        })
      }
    }

    throw lastError
  }

  /**
   * Execute a tool action via ToolRegistry.
   * All tools go through the registry so the loop emits structured
   * tool.started/tool.finished events with consistent metadata.
   */
  private async executeAction(
    context: RunnerToolContext,
    toolName: AgentToolName,
    args: unknown,
  ): Promise<unknown> {
    const descriptor = this.runner.toolRegistry.getDescriptor(toolName)
    const startedRecord = this.runner.toolRegistry.createStartedRecord({
      taskId: context.task.id,
      descriptor,
      args,
    })

    await this.runner.eventService.append({
      taskId: context.task.id,
      type: 'tool.started',
      payload: serializeToolRecordForEvent(startedRecord),
    })

    try {
      const result = await this.runner.toolRegistry.invokeExistingRecord({
        recordId: startedRecord.id,
        context,
        toolName,
        args,
      })

      const finishedRecord =
        this.runner.toolRegistry.getRecord(startedRecord.id) ?? startedRecord

      await this.runner.eventService.append({
        taskId: context.task.id,
        type: 'tool.finished',
        payload: {
          ...serializeToolRecordForEvent(finishedRecord),
          result,
        },
      })

      await this.runner.taskMemoryService?.recordToolResult({
        taskId: context.task.id,
        toolName,
        args,
        result,
      })

      return result
    } catch (error) {
      const finishedRecord =
        this.runner.toolRegistry.getRecord(startedRecord.id) ?? startedRecord

      await this.runner.eventService.append({
        taskId: context.task.id,
        type: 'tool.finished',
        payload: {
          ...serializeToolRecordForEvent(finishedRecord),
          error: error instanceof Error ? error.message : String(error),
        },
      })

      throw error
    }
  }

  private truncateToolOutput(
    value: unknown,
    maxChars: number,
  ): { value: unknown; truncated: boolean } {
    const serialized = JSON.stringify(value)

    if (serialized.length <= maxChars) {
      return {
        value,
        truncated: false,
      }
    }

    return {
      value: `${serialized.slice(0, maxChars)}\n...<truncated>`,
      truncated: true,
    }
  }

  /**
   * Check whether the worktree has uncommitted changes.
   * Used by the final gate to determine whether validation is required.
   */
  private async hasCurrentDiff(taskId: string): Promise<boolean> {
    try {
      const diff = await this.runner.taskService.getDiff(taskId)
      return diff.diff.trim().length > 0
    } catch {
      return false
    }
  }

  private async failTaskIfPossible(
    taskId: string,
    error: unknown,
  ): Promise<AgentLoopResult | undefined> {
    const task = this.runner.taskService.get(taskId)

    if (!canTransitionTaskStatus(task.status, 'failed')) {
      return undefined
    }

    const payload = {
      message: error instanceof Error ? error.message : String(error),
      code:
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : 'UNKNOWN_ERROR',
      details:
        typeof error === 'object' && error !== null && 'details' in error
          ? (error as { details: unknown }).details
          : undefined,
    }

    await this.runner.taskService.fail(taskId, payload)

    return {
      task: this.runner.taskService.get(taskId),
      status: 'failed',
      finalMessage: payload.message,
    }
  }
}
