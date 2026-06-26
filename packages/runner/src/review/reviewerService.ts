import type { Task, ReviewResult } from '@forgeagent/core'
import {
  ReviewResultSchema,
  deriveReviewStatus,
  deriveReviewRecommendation,
  createForgeAgentError,
} from '@forgeagent/core'
import type { RunnerContext } from '../context'
import type { ChatMessage, OpenAICompatibleModelGateway } from '../agent/model'
import { parseAgentStepResponse } from '../agent/json'
import type { AgentToolName } from '../agent/json'
import {
  createReviewerSystemPrompt,
  createReviewerTaskPrompt,
  createReviewerToolResultPrompt,
  renderReviewMarkdown,
} from './reviewerPrompts'
import { ReviewContextBuilder } from './reviewContextBuilder'

const REVIEWER_ALLOWED_TOOLS = new Set<AgentToolName>([
  'read_file',
  'search_text',
  'get_diff',
])

export interface ReviewerServiceOptions {
  maxSteps?: number
  maxToolResultChars?: number
  maxContextChars?: number
}

interface ReviewerFinalResponse {
  message: string
  final: boolean
  review: {
    status?: 'passed' | 'warning' | 'failed'
    recommendation?: 'apply' | 'commit' | 'needs_fix' | 'reject'
    goalCompleted: boolean
    hasUnrelatedChanges: boolean
    violatesProjectRules: boolean
    missingTests: boolean
    hasSecurityRisk: boolean
    hasCompatibilityRisk: boolean
    summary: string
    findings?: Array<{
      severity: string
      category: string
      message: string
      file?: string
      line?: number
      suggestion?: string
    }>
  }
}

export class ReviewerService {
  private readonly results = new Map<string, ReviewResult>()
  private readonly contextBuilder: ReviewContextBuilder

  constructor(
    private readonly runner: RunnerContext,
    private readonly model: OpenAICompatibleModelGateway,
    private readonly options: ReviewerServiceOptions = {},
  ) {
    this.contextBuilder = new ReviewContextBuilder(
      runner.taskMemoryService,
      runner.gitDiffService,
      {
        maxChars: this.options.maxContextChars,
      },
    )
  }

  getReview(taskId: string): ReviewResult | undefined {
    return this.results.get(taskId)
  }

  async review(taskId: string): Promise<ReviewResult> {
    const task = this.runner.taskService.get(taskId)
    this.assertCanReview(task)

    const beforeDiff = await this.runner.gitDiffService.getDiff(
      task.worktreePath,
    )

    await this.runner.eventService.append({
      taskId,
      type: 'review.started',
      payload: {},
    })

    const context = await this.contextBuilder.build({ task })
    const messages: ChatMessage[] = [
      { role: 'system', content: createReviewerSystemPrompt() },
      {
        role: 'user',
        content: createReviewerTaskPrompt({
          taskId,
          taskPrompt: task.prompt,
          reviewContext: context,
        }),
      },
    ]

    for (let step = 1; step <= (this.options.maxSteps ?? 6); step += 1) {
      const output = await this.model.generate({ messages })

      let parsed: unknown
      try {
        parsed = JSON.parse(output.content)
      } catch {
        throw createForgeAgentError(
          'MODEL_RESPONSE_INVALID',
          'Reviewer output is not valid JSON',
          { taskId, content: output.content },
        )
      }

      const asReviewer = parsed as ReviewerFinalResponse

      if (asReviewer.final === true && asReviewer.review) {
        const result = await this.finalizeReview(task, asReviewer)
        await this.assertReadonly(task, beforeDiff)
        return result
      }

      const parsedResponse = parseAgentStepResponse(output.content)
      const action = parsedResponse.action

      if (!action) {
        throw createForgeAgentError(
          'MODEL_RESPONSE_INVALID',
          'Reviewer response must contain action or final review',
          { taskId },
        )
      }

      this.assertAllowedTool(action.name)

      const toolContext = {
        task,
        workspace: this.runner.workspaceService.get(task.workspaceId),
        worktreePath: task.worktreePath,
        taskService: this.runner.taskService,
        approvalService: this.runner.approvalService,
        toolRegistry: this.runner.toolRegistry,
      }

      const toolResult = await this.runner.toolRegistry.invoke({
        taskId,
        context: toolContext,
        toolName: action.name,
        args: action.args,
      })

      messages.push({ role: 'assistant', content: JSON.stringify(parsed) })
      messages.push({
        role: 'user',
        content: createReviewerToolResultPrompt({
          toolName: action.name,
          result: toolResult.result,
          maxChars: this.options.maxToolResultChars ?? 8_000,
        }),
      })
    }

    throw createForgeAgentError(
      'MODEL_RESPONSE_INVALID',
      'Reviewer exceeded max steps without producing final review',
      { taskId },
    )
  }

  private assertCanReview(task: Task): void {
    if (task.status !== 'completed') {
      throw createForgeAgentError(
        'TASK_NOT_RUNNING',
        `Cannot review task with status: ${task.status}. Only completed tasks can be reviewed.`,
        { taskId: task.id, status: task.status },
      )
    }
  }

  private assertAllowedTool(toolName: string): void {
    if (!REVIEWER_ALLOWED_TOOLS.has(toolName as AgentToolName)) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Reviewer is read-only and cannot call tool: ${toolName}`,
        { toolName },
      )
    }

    const descriptor = this.runner.toolRegistry.getDescriptor(toolName)

    if (
      descriptor.source !== 'core' ||
      descriptor.type !== 'read' ||
      descriptor.permission !== 'allowed'
    ) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Reviewer tool is not read-only: ${toolName}`,
        { toolName, descriptor },
      )
    }
  }

  private async assertReadonly(task: Task, beforeDiff: string): Promise<void> {
    const afterDiff = await this.runner.gitDiffService.getDiff(
      task.worktreePath,
    )

    if (afterDiff !== beforeDiff) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        'Reviewer mutated task worktree (diff changed during review)',
        { taskId: task.id },
      )
    }
  }

  private async finalizeReview(
    task: Task,
    response: ReviewerFinalResponse,
  ): Promise<ReviewResult> {
    const review = response.review
    const status = review.status ?? deriveReviewStatus(review)
    const recommendation =
      review.recommendation ?? deriveReviewRecommendation(status)

    const result = ReviewResultSchema.parse({
      ...review,
      taskId: task.id,
      status,
      recommendation,
      findings: (review.findings ?? []).map(f => ({
        severity: f.severity,
        category: f.category,
        message: f.message,
        file: f.file,
        line: f.line,
        suggestion: f.suggestion,
      })),
      reviewedAt: new Date().toISOString(),
    })

    this.results.set(task.id, result)

    await this.runner.taskMemoryService.write({
      taskId: task.id,
      file: 'review_report.md',
      content: renderReviewMarkdown(result),
      reason: 'Review result recorded',
    })

    await this.runner.eventService.append({
      taskId: task.id,
      type: 'review.finished',
      payload: {
        status: result.status,
        recommendation: result.recommendation,
        reviewedAt: result.reviewedAt,
        summary: result.summary,
        findingCount: result.findings.length,
      },
    })

    return result
  }
}
