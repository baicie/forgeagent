import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Task } from '@forgeagent/core'
import type { GitDiffService } from '../git/diff'
import type { TaskMemoryService } from '../services/taskMemoryService'
import { ReviewContextBuilder } from './reviewContextBuilder'

const fakeTask: Task = {
  id: 'task_review_ctx',
  workspaceId: 'ws_1',
  prompt: 'fix a bug',
  status: 'completed',
  baseBranch: 'main',
  baseCommit: 'a'.repeat(40),
  worktreePath: '/tmp/review-test-worktree',
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
}

describe('review context builder', () => {
  let taskMemoryService: TaskMemoryService
  let gitDiffService: GitDiffService

  beforeEach(() => {
    taskMemoryService = {
      readTaskMemoryFile: vi.fn().mockResolvedValue({
        content: '# Test Content',
      }),
    } as unknown as TaskMemoryService

    gitDiffService = {
      getDiff: vi.fn().mockResolvedValue('diff --git a/README.md'),
    } as unknown as GitDiffService
  })

  it('builds context with memory sections and diff', async () => {
    const builder = new ReviewContextBuilder(taskMemoryService, gitDiffService)

    const context = await builder.build({ task: fakeTask })

    expect(context).toContain('## Project Rules')
    expect(context).toContain('## Task Plan')
    expect(context).toContain('## Changed Files')
    expect(context).toContain('## Test Results')
    expect(context).toContain('## Final Summary')
    expect(context).toContain('## Git Diff')
    expect(context).toContain('diff --git a/README.md')
  })

  it('includes task plan from memory service', async () => {
    const builder = new ReviewContextBuilder(taskMemoryService, gitDiffService)

    await builder.build({ task: fakeTask })

    expect(taskMemoryService.readTaskMemoryFile).toHaveBeenCalledWith(
      fakeTask.id,
      'task_plan.md',
    )
    expect(taskMemoryService.readTaskMemoryFile).toHaveBeenCalledWith(
      fakeTask.id,
      'changed_files.md',
    )
    expect(taskMemoryService.readTaskMemoryFile).toHaveBeenCalledWith(
      fakeTask.id,
      'test_results.md',
    )
    expect(taskMemoryService.readTaskMemoryFile).toHaveBeenCalledWith(
      fakeTask.id,
      'final_summary.md',
    )
  })

  it('truncates context when exceeding maxChars', async () => {
    ;(
      taskMemoryService.readTaskMemoryFile as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      content: 'A'.repeat(50_000),
    })

    const builder = new ReviewContextBuilder(
      taskMemoryService,
      gitDiffService,
      { maxChars: 100 },
    )

    const context = await builder.build({ task: fakeTask })

    expect(context).toContain('...<truncated>')
  })
})
