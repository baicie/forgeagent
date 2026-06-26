import { describe, it, expect, vi } from 'vitest'
import type { Task } from '@forgeagent/core'
import type { OpenAICompatibleModelGateway } from '../agent/model'
import type { RunnerContext } from '../context'
import type { GitDiffService } from '../git/diff'
import type { EventService } from '../services/eventService'
import type { TaskMemoryService } from '../services/taskMemoryService'
import type { ToolRegistry } from '../agent/tools/registry'
import type { WorkspaceService } from '../services/workspaceService'
import type { ApprovalService } from '../services/approvalService'
import type { TaskService } from '../services/taskService'
import { ReviewerService } from './reviewerService'

const fakeTask: Task = {
  id: 'task_review_test',
  workspaceId: 'ws_1',
  prompt: 'fix a bug',
  status: 'completed',
  baseBranch: 'main',
  baseCommit: 'a'.repeat(40),
  worktreePath: '/tmp/review-test-worktree',
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
}

const fakeWorkspace = {
  id: 'ws_1',
  name: 'test-repo',
  repoPath: '/tmp/repo',
  gitRoot: '/tmp/repo',
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
}

function createReviewerServiceFixture(modelOutputs: string[]) {
  const taskService = {
    get: vi.fn(() => fakeTask),
  } as unknown as TaskService

  const workspaceService = {
    get: vi.fn(() => fakeWorkspace),
  } as unknown as WorkspaceService

  const gitDiffService = {
    getDiff: vi.fn().mockResolvedValue('diff --git a/README.md'),
  } as unknown as GitDiffService

  const eventService = {
    append: vi.fn().mockResolvedValue({}),
  } as unknown as EventService

  const taskMemoryService = {
    readTaskMemoryFile: vi.fn().mockResolvedValue({ content: '# Context' }),
    write: vi.fn().mockResolvedValue(undefined),
  } as unknown as TaskMemoryService

  const toolRegistry = {
    getDescriptor: vi.fn().mockReturnValue({
      source: 'core',
      type: 'read',
      permission: 'allowed',
    }),
    invoke: vi.fn().mockResolvedValue({ result: {} }),
  } as unknown as ToolRegistry

  const model = {
    generate: vi.fn().mockImplementation(() => {
      const output = modelOutputs.shift()
      if (!output) {
        return Promise.resolve({ content: '{}' })
      }
      return Promise.resolve({ content: output })
    }),
  } as unknown as OpenAICompatibleModelGateway

  const runner = {
    taskService,
    workspaceService,
    gitDiffService,
    eventService,
    taskMemoryService,
    toolRegistry,
    approvalService: {} as ApprovalService,
  } as unknown as RunnerContext

  const service = new ReviewerService(runner, model)

  return { service, runner, eventService, taskMemoryService }
}

describe('reviewer service', () => {
  it('throws when reviewing a non-completed task', async () => {
    const { service, runner } = createReviewerServiceFixture([])
    ;(runner.taskService.get as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      ...fakeTask,
      status: 'running',
    })

    await expect(service.review(fakeTask.id)).rejects.toThrow(
      'Only completed tasks can be reviewed',
    )
  })

  it('creates review.finished event and writes review report on success', async () => {
    const { service, eventService, taskMemoryService } =
      createReviewerServiceFixture([
        JSON.stringify({
          message: '审查完成',
          final: true,
          review: {
            status: 'passed',
            recommendation: 'apply',
            goalCompleted: true,
            hasUnrelatedChanges: false,
            violatesProjectRules: false,
            missingTests: false,
            hasSecurityRisk: false,
            hasCompatibilityRisk: false,
            summary: '审查通过。',
            findings: [],
          },
        }),
      ])

    const result = await service.review(fakeTask.id)

    expect(result.status).toBe('passed')
    expect(result.recommendation).toBe('apply')
    expect(result.goalCompleted).toBe(true)
    expect(result.findings).toHaveLength(0)

    expect(eventService.append).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review.started' }),
    )
    expect(eventService.append).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review.finished' }),
    )
    expect(taskMemoryService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        file: 'review_report.md',
      }),
    )
  })

  it('returns cached review result from getReview', async () => {
    const { service } = createReviewerServiceFixture([
      JSON.stringify({
        message: '审查完成',
        final: true,
        review: {
          status: 'passed',
          recommendation: 'apply',
          goalCompleted: true,
          hasUnrelatedChanges: false,
          violatesProjectRules: false,
          missingTests: false,
          hasSecurityRisk: false,
          hasCompatibilityRisk: false,
          summary: '审查通过。',
          findings: [],
        },
      }),
    ])

    await service.review(fakeTask.id)
    const cached = service.getReview(fakeTask.id)

    expect(cached?.status).toBe('passed')
    expect(cached?.summary).toBe('审查通过。')
  })

  it('rejects non-allowed tools', async () => {
    const { service, runner } = createReviewerServiceFixture([
      JSON.stringify({
        message: 'apply patch',
        final: false,
        action: {
          name: 'apply_patch',
          args: { changes: [] },
        },
      }),
    ])

    // Make the model output non-final first to trigger tool call
    ;(
      runner.gitDiffService.getDiff as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce('diff')
    ;(
      runner.toolRegistry.getDescriptor as ReturnType<typeof vi.fn>
    ).mockReturnValueOnce({
      source: 'core',
      type: 'write',
      permission: 'requires_approval',
    })

    await expect(service.review(fakeTask.id)).rejects.toThrow(
      'Reviewer is read-only',
    )
  })

  it('derives status and recommendation when not provided in output', async () => {
    const { service } = createReviewerServiceFixture([
      JSON.stringify({
        message: '审查完成',
        final: true,
        review: {
          goalCompleted: false,
          hasUnrelatedChanges: false,
          violatesProjectRules: false,
          missingTests: false,
          hasSecurityRisk: false,
          hasCompatibilityRisk: false,
          summary: '目标未完成。',
          findings: [],
        },
      }),
    ])

    const result = await service.review(fakeTask.id)

    expect(result.status).toBe('failed')
    expect(result.recommendation).toBe('reject')
  })

  it('parses findings from model output', async () => {
    const { service } = createReviewerServiceFixture([
      JSON.stringify({
        message: '审查完成',
        final: true,
        review: {
          status: 'warning',
          recommendation: 'needs_fix',
          goalCompleted: true,
          hasUnrelatedChanges: false,
          violatesProjectRules: false,
          missingTests: true,
          hasSecurityRisk: false,
          hasCompatibilityRisk: false,
          summary: '缺少测试。',
          findings: [
            {
              severity: 'warning',
              category: 'test',
              message: 'No test results found.',
              suggestion: 'Run tests before apply.',
            },
          ],
        },
      }),
    ])

    const result = await service.review(fakeTask.id)

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].severity).toBe('warning')
    expect(result.findings[0].category).toBe('test')
    expect(result.findings[0].suggestion).toBe('Run tests before apply.')
  })
})
