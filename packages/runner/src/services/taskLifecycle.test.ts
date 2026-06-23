import type { Workspace } from '@forgeagent/core'
import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import type { GitDiffService } from '../git/diff'
import type { GitRepositoryService } from '../git/repository'
import type { GitWorktreeService } from '../git/worktree'
import type { GitPatchService } from '../git/patch'
import type { GitCommitService } from '../git/commit'
import { AuditService } from './auditService'
import { EventService } from './eventService'
import { TaskService } from './taskService'
import type { WorkspaceService } from './workspaceService'

function createTaskServiceFixture() {
  const workspace: Workspace = {
    id: 'ws_1',
    name: 'repo',
    repoPath: '/repo',
    gitRoot: '/repo',
    currentBranch: 'main',
    currentCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }

  const db = createInMemoryRunnerDb({
    workspaces: [workspace],
    tasks: [],
    events: [],
    approvals: [],
    audits: [],
  })

  const workspaceService = {
    get: vi.fn(() => workspace),
  } as unknown as WorkspaceService

  const gitRepositoryService = {
    getRepositoryInfo: vi.fn(async () => ({
      repoPath: '/repo',
      gitRoot: '/repo',
      currentBranch: 'main',
      currentCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      isDirty: false,
    })),
  } as unknown as GitRepositoryService

  const gitWorktreeService = {
    create: vi.fn(async (input: { dataDir: string; taskId: string }) => ({
      worktreePath: `${input.dataDir}/worktrees/${input.taskId}`,
      branchName: `forgeagent/task-${input.taskId}`,
    })),
    discard: vi.fn(async () => {}),
  } as unknown as GitWorktreeService

  const gitDiffService = {
    getDiff: vi.fn(async () => 'diff --git a/README.md b/README.md\n'),
  } as unknown as GitDiffService

  const gitPatchService = {
    createPatchFromWorktree: vi.fn(async () => ({
      patchFile: '/tmp/p.patch',
      diff: '',
      bytes: 0,
    })),
  } as unknown as GitPatchService

  const gitCommitService = {
    commitWorktree: vi.fn(async () => ({
      commitSha: 'a'.repeat(40),
      message: 'test',
    })),
  } as unknown as GitCommitService

  const eventService = new EventService(db)
  const auditService = new AuditService(db)

  const taskService = new TaskService(
    db,
    loadRunnerConfig({
      dataDir: '/tmp/forgeagent-test',
    }),
    workspaceService,
    gitRepositoryService,
    gitWorktreeService,
    gitDiffService,
    gitPatchService,
    gitCommitService,
    eventService,
    auditService,
  )

  return {
    db,
    taskService,
    gitWorktreeService,
  }
}

describe('taskService lifecycle', () => {
  it('creates task audit and initial task.status event', async () => {
    const { db, taskService } = createTaskServiceFixture()

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix bug',
    })

    expect(task.status).toBe('created')
    expect(db.state.audits).toEqual([
      expect.objectContaining({
        taskId: task.id,
        type: 'task.created',
      }),
    ])
    expect(db.state.events).toEqual([
      expect.objectContaining({
        taskId: task.id,
        type: 'task.status',
        payload: expect.objectContaining({
          status: 'created',
        }),
      }),
    ])
  })

  it('emits task.status event for every valid transition', async () => {
    const { db, taskService } = createTaskServiceFixture()

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix bug',
    })

    await taskService.prepare(task.id)
    await taskService.start(task.id)
    await taskService.waitForApproval(task.id)
    await taskService.resume(task.id)
    await taskService.complete(task.id, {
      summary: 'done',
    })

    expect(taskService.get(task.id).status).toBe('completed')

    const statusEvents = db.state.events.filter(
      event => event.type === 'task.status',
    )

    expect(statusEvents.map(event => event.payload)).toEqual([
      expect.objectContaining({ status: 'created' }),
      expect.objectContaining({
        previousStatus: 'created',
        status: 'preparing',
      }),
      expect.objectContaining({
        previousStatus: 'preparing',
        status: 'running',
      }),
      expect.objectContaining({
        previousStatus: 'running',
        status: 'waiting_approval',
      }),
      expect.objectContaining({
        previousStatus: 'waiting_approval',
        status: 'running',
      }),
      expect.objectContaining({
        previousStatus: 'running',
        status: 'completed',
      }),
    ])

    expect(db.state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'task.completed',
          payload: {
            output: {
              summary: 'done',
            },
          },
        }),
      ]),
    )
  })

  it('rejects invalid transitions', async () => {
    const { taskService } = createTaskServiceFixture()

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix bug',
    })

    await expect(taskService.complete(task.id)).rejects.toMatchObject({
      code: 'INVALID_TASK_STATUS_TRANSITION',
    })
  })

  it('emits task.failed when task fails', async () => {
    const { db, taskService } = createTaskServiceFixture()

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix bug',
    })

    await taskService.prepare(task.id)
    await taskService.fail(task.id, {
      message: 'boom',
    })

    expect(taskService.get(task.id).status).toBe('failed')
    expect(db.state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'task.failed',
          payload: {
            error: {
              message: 'boom',
            },
          },
        }),
      ]),
    )
  })

  it('emits diff.updated when reading diff', async () => {
    const { db, taskService } = createTaskServiceFixture()

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix bug',
    })

    const result = await taskService.getDiff(task.id)

    expect(result.diff).toContain('diff --git')
    expect(db.state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'diff.updated',
          payload: {
            changed: true,
            bytes: Buffer.byteLength(result.diff, 'utf-8'),
          },
        }),
      ]),
    )
  })

  it('discards task and emits status event', async () => {
    const { db, taskService, gitWorktreeService } = createTaskServiceFixture()

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix bug',
    })

    await taskService.discard(task.id)

    expect(gitWorktreeService.discard).toHaveBeenCalled()
    expect(taskService.get(task.id).status).toBe('discarded')
    expect(db.state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'task.status',
          payload: expect.objectContaining({
            previousStatus: 'created',
            status: 'discarded',
          }),
        }),
      ]),
    )
  })
})
