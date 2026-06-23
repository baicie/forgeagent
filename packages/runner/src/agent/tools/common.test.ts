import type { Task, Workspace } from '@forgeagent/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertSafeReadablePath } from './common'
import type { RunnerToolContext } from './types'

function createContext(worktreePath: string): RunnerToolContext {
  const task: Task = {
    id: 'task_1',
    workspaceId: 'ws_1',
    prompt: 'test',
    status: 'created',
    baseBranch: 'main',
    baseCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    worktreePath,
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }

  const workspace: Workspace = {
    id: 'ws_1',
    name: 'repo',
    repoPath: worktreePath,
    gitRoot: worktreePath,
    currentBranch: 'main',
    currentCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }

  return {
    task,
    workspace,
    worktreePath,
    taskService: {
      get: () => task,
      prepare: () => Promise.resolve(task),
      start: () => Promise.resolve(task),
      waitForApproval: () => Promise.resolve(task),
      getDiff: () => Promise.resolve({ taskId: task.id, diff: '' }),
    },
    approvalService: {
      create: () => Promise.resolve({} as never),
    },
  } as unknown as RunnerToolContext
}

describe('tool path safety', () => {
  it('does not treat ignored parent directory names as ignored worktree paths', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-tool-'))
    const worktreePath = join(tempDir, 'build', 'worktree')

    try {
      await mkdir(worktreePath, { recursive: true })
      await writeFile(join(worktreePath, 'README.md'), '# ok\n', 'utf-8')

      const resolved = assertSafeReadablePath(
        createContext(worktreePath),
        'README.md',
      )

      expect(resolved.relativePath).toBe('README.md')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('still blocks ignored paths relative to the worktree', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-tool-'))
    const worktreePath = join(tempDir, 'worktree')

    try {
      await mkdir(join(worktreePath, 'node_modules'), { recursive: true })

      expect(() =>
        assertSafeReadablePath(createContext(worktreePath), 'node_modules'),
      ).toThrow('Ignored path is blocked')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
