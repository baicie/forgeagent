import { Command } from 'commander'
import { createTaskCommand } from './task'
import type { RunnerApiClient } from '../client/runnerClient'

function createProgram(command: Command): Command {
  return new Command().exitOverride().addCommand(command)
}

function createClient(): RunnerApiClient {
  return {
    baseUrl: 'http://127.0.0.1:17890',
    createTask: vi.fn(async () => ({
      id: 'task_1',
      workspaceId: 'ws_1',
      prompt: 'fix bug',
      status: 'created',
      baseBranch: 'main',
      baseCommit: 'a'.repeat(40),
      worktreePath: '/tmp/worktree',
      createdAt: '2026-06-24T00:00:00.000Z',
      updatedAt: '2026-06-24T00:00:00.000Z',
    })),
    runTask: vi.fn(async () => ({})),
    getTask: vi.fn(async () => ({
      id: 'task_1',
      workspaceId: 'ws_1',
      prompt: 'fix bug',
      status: 'completed',
      baseBranch: 'main',
      baseCommit: 'a'.repeat(40),
      worktreePath: '/tmp/worktree',
      createdAt: '2026-06-24T00:00:00.000Z',
      updatedAt: '2026-06-24T00:00:00.000Z',
    })),
    getTaskDiff: vi.fn(async () => ({
      taskId: 'task_1',
      diff: 'diff --git a/index.ts b/index.ts\n+hello\n',
    })),
    applyTask: vi.fn(async () => ({
      id: 'task_1',
      workspaceId: 'ws_1',
      prompt: 'fix bug',
      status: 'applied',
      baseBranch: 'main',
      baseCommit: 'a'.repeat(40),
      worktreePath: '/tmp/worktree',
      createdAt: '2026-06-24T00:00:00.000Z',
      updatedAt: '2026-06-24T00:00:00.000Z',
    })),
    getWorkspace: vi.fn(async () => ({
      id: 'ws_1',
      name: 'repo',
      repoPath: '/repo',
      gitRoot: '/repo',
      currentBranch: 'main',
      currentCommit: 'a'.repeat(40),
      createdAt: '2026-06-24T00:00:00.000Z',
      updatedAt: '2026-06-24T00:00:00.000Z',
    })),
    cleanupTasks: vi.fn(async () => ({
      deleted: 0,
      failed: 0,
    })),
  } as unknown as RunnerApiClient
}

describe('task command phase 12', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('prints worktree warning after task creation', async () => {
    const client = createClient()
    const program = createProgram(createTaskCommand(() => client))

    await program.parseAsync([
      'node',
      'test',
      'task',
      'create',
      '--workspace',
      'ws_1',
      '--prompt',
      'fix bug',
    ])

    expect(logSpy.mock.calls.flat().join('\n')).toContain(
      'isolated task worktree',
    )
  })

  it('prints worktree warning before diff', async () => {
    const client = createClient()
    const program = createProgram(createTaskCommand(() => client))

    await program.parseAsync(['node', 'test', 'task', 'diff', 'task_1'])

    expect(logSpy.mock.calls.flat().join('\n')).toContain(
      'Diff is generated from the isolated task worktree',
    )
  })

  it('prints original repo hint after apply', async () => {
    const client = createClient()
    const program = createProgram(createTaskCommand(() => client))

    await program.parseAsync(['node', 'test', 'task', 'apply', 'task_1'])

    expect(logSpy.mock.calls.flat().join('\n')).toContain(
      'Patch applied to original repository',
    )
    expect(client.getWorkspace).toHaveBeenCalledWith('ws_1')
  })

  it('does not cleanup tasks without confirmation', async () => {
    const client = createClient()
    const program = createProgram(createTaskCommand(() => client))

    await program.parseAsync(['node', 'test', 'task', 'cleanup'])

    expect(client.cleanupTasks).not.toHaveBeenCalled()
    expect(logSpy.mock.calls.flat().join('\n')).toContain('Re-run with --yes')
  })

  it('cleans up tasks with confirmation', async () => {
    const client = createClient()
    const program = createProgram(createTaskCommand(() => client))

    await program.parseAsync(['node', 'test', 'task', 'cleanup', '--yes'])

    expect(client.cleanupTasks).toHaveBeenCalled()
    expect(logSpy.mock.calls.flat().join('\n')).toContain('deleted: 0')
  })
})
