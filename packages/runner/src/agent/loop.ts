import type { Task } from '@forgeagent/core'
import {
  canTransitionTaskStatus,
  createForgeAgentError,
} from '@forgeagent/core'
import type { RunnerContext } from '../context'
import {
  applyPatchTool,
  getDiffTool,
  listFilesTool,
  readFileTool,
  runCommandTool,
  searchTextTool,
} from './tools'
import type { RunnerToolContext } from './tools'
import type {
  ChatMessage,
  ModelGenerateInput,
  OpenAICompatibleModelGateway,
} from './model'
import {
  createJsonRetryPrompt,
  createSystemPrompt,
  createTaskEventHistoryPrompt,
  createTaskPrompt,
  createToolResultPrompt,
} from './prompts'
import { normalizeFinalSummary, parseAgentStepResponse } from './json'
import type { AgentStepResponse, AgentToolName } from './json'
import { createAgentRunContext } from './context'

export const DEFAULT_MAX_AGENT_STEPS = 30
export const DEFAULT_MAX_TOOL_OUTPUT_CHARS = 20_000
export const DEFAULT_JSON_RETRY_LIMIT = 2
export const DEFAULT_MAX_EVENT_HISTORY_CHARS = 30_000

export interface AgentLoopOptions {
  maxSteps?: number
  maxToolOutputChars?: number
  jsonRetryLimit?: number
  maxEventHistoryChars?: number
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

    const runContext = createAgentRunContext(this.runner, taskId)

    await this.ensureRunning(runContext.task.id)

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: createSystemPrompt(),
      },
      {
        role: 'user',
        content: createTaskPrompt({
          prompt: runContext.task.prompt,
          worktreePath: runContext.task.worktreePath,
          baseBranch: runContext.task.baseBranch,
          baseCommit: runContext.task.baseCommit,
        }),
      },
    ]

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
        const summary = normalizeFinalSummary(
          response.message,
          response.summary,
        )

        const finalMessage = JSON.stringify(
          {
            message: response.message,
            summary,
          },
          null,
          2,
        )

        await this.runner.taskService.complete(taskId, {
          message: response.message,
          summary,
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

      const serializedToolResult = this.truncateToolOutput(
        toolResult,
        maxToolOutputChars,
      )

      messages.push({
        role: 'user',
        content: createToolResultPrompt({
          toolName: action.name,
          result: serializedToolResult.value,
          truncated: serializedToolResult.truncated,
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

  private async executeAction(
    context: RunnerToolContext,
    toolName: AgentToolName,
    args: unknown,
  ): Promise<unknown> {
    await this.runner.eventService.append({
      taskId: context.task.id,
      type: 'tool.started',
      payload: {
        toolName,
        args,
      },
    })

    try {
      const result = await this.dispatchTool(context, toolName, args)

      await this.runner.eventService.append({
        taskId: context.task.id,
        type: 'tool.finished',
        payload: {
          toolName,
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
      await this.runner.eventService.append({
        taskId: context.task.id,
        type: 'tool.finished',
        payload: {
          toolName,
          error: error instanceof Error ? error.message : String(error),
        },
      })

      throw error
    }
  }

  private async dispatchTool(
    context: RunnerToolContext,
    toolName: AgentToolName,
    args: unknown,
  ): Promise<unknown> {
    return this._dispatchTool(context, toolName, args)
  }

  protected async _dispatchTool(
    context: RunnerToolContext,
    toolName: AgentToolName,
    args: unknown,
  ): Promise<unknown> {
    switch (toolName) {
      case 'list_files':
        return listFilesTool(context, args)

      case 'read_file':
        return readFileTool(context, args)

      case 'search_text':
        return searchTextTool(context, args)

      case 'apply_patch':
        return applyPatchTool(context, args)

      case 'run_command':
        return runCommandTool(context, args)

      case 'get_diff':
        return getDiffTool(context, args)
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
