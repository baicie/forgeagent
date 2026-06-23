import type { Task } from '@forgeagent/core'
import type { GitRepositoryService } from './repository'
import { assertOriginalRepoReadyForApply } from './deliveryGuard'

function createTask(): Task {
  return {
    id: 'task_1',
    workspaceId: 'ws_1',
    prompt: 'test',
    status: 'completed',
    baseBranch: 'main',
    baseCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    worktreePath: '/tmp/worktree',
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }
}

describe('assertOriginalRepoReadyForApply', () => {
  it('passes when original repo is still at base commit and clean', async () => {
    const gitRepositoryService = {
      getRepositoryInfo: vi.fn(async () => ({
        repoPath: '/repo',
        gitRoot: '/repo',
        currentBranch: 'main',
        currentCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        isDirty: false,
      })),
    } as unknown as GitRepositoryService

    await expect(
      assertOriginalRepoReadyForApply({
        task: createTask(),
        gitRoot: '/repo',
        gitRepositoryService,
      }),
    ).resolves.toBeUndefined()
  })

  it('blocks when original repo HEAD changed', async () => {
    const gitRepositoryService = {
      getRepositoryInfo: vi.fn(async () => ({
        repoPath: '/repo',
        gitRoot: '/repo',
        currentBranch: 'main',
        currentCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        isDirty: false,
      })),
    } as unknown as GitRepositoryService

    await expect(
      assertOriginalRepoReadyForApply({
        task: createTask(),
        gitRoot: '/repo',
        gitRepositoryService,
      }),
    ).rejects.toMatchObject({
      code: 'PATCH_APPLY_FAILED',
    })
  })

  it('blocks when original repo is dirty', async () => {
    const gitRepositoryService = {
      getRepositoryInfo: vi.fn(async () => ({
        repoPath: '/repo',
        gitRoot: '/repo',
        currentBranch: 'main',
        currentCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        isDirty: true,
      })),
    } as unknown as GitRepositoryService

    await expect(
      assertOriginalRepoReadyForApply({
        task: createTask(),
        gitRoot: '/repo',
        gitRepositoryService,
      }),
    ).rejects.toMatchObject({
      code: 'PATCH_APPLY_FAILED',
    })
  })
})
