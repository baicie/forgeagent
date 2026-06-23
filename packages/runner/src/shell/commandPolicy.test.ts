import { CommandPolicy, getCommandRiskColor } from './commandPolicy'
import type { Task } from '@forgeagent/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function createTask(worktreePath: string): Task {
  return {
    id: 'task_1',
    workspaceId: 'ws_1',
    prompt: 'test',
    status: 'waiting_approval',
    baseBranch: 'main',
    baseCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    worktreePath,
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }
}

describe('commandPolicy', () => {
  it('marks dangerous commands as red', () => {
    const policy = new CommandPolicy()
    const evaluation = policy.evaluate('rm -rf dist')

    expect(evaluation.risk).toBe('dangerous')
    expect(evaluation.riskColor).toBe('red')
    expect(evaluation.requiresApproval).toBe(true)
  })

  it.each([
    ['low', 'green'],
    ['medium', 'yellow'],
    ['high', 'orange'],
    ['dangerous', 'red'],
  ] as const)('maps %s risk to %s', (risk, color) => {
    expect(getCommandRiskColor(risk)).toBe(color)
  })

  it('resolves cwd inside task worktree', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-policy-'))
    const worktreePath = join(tempDir, 'worktree')
    const srcPath = join(worktreePath, 'src')

    try {
      await mkdir(srcPath, { recursive: true })

      const policy = new CommandPolicy()

      expect(
        policy.resolveCwd({
          task: createTask(worktreePath),
          cwd: 'src',
        }),
      ).toBe(srcPath)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 20000)

  it('blocks cwd outside task worktree', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-policy-'))
    const worktreePath = join(tempDir, 'worktree')

    try {
      await mkdir(worktreePath, { recursive: true })

      const policy = new CommandPolicy()

      expect(() =>
        policy.resolveCwd({
          task: createTask(worktreePath),
          cwd: '..',
        }),
      ).toThrow('Path escapes workspace')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }, 20000)
})
