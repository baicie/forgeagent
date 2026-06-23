import type { RunnerApiClient } from '../client/runnerClient'
import type { WatchTaskEventsInput } from '../client/sse'
import { createTaskCommand } from './task'

function createTask(id = 'task_1') {
  return {
    id,
    workspaceId: 'ws_1',
    prompt: 'fix README',
    status: 'created',
    baseBranch: 'main',
    baseCommit: 'a'.repeat(40),
    worktreePath: '/tmp/worktree',
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }
}

function createClient() {
  return {
    baseUrl: 'http://127.0.0.1:17890',
    createTask: vi.fn(async () => createTask()),
    listTasks: vi.fn(async () => [createTask()]),
    runTask: vi.fn(async () => ({
      status: 'completed',
    })),
    getTaskDiff: vi.fn(async () => ({
      taskId: 'task_1',
      diff: 'diff --git a/README.md b/README.md\n+hello\n',
    })),
    applyTask: vi.fn(async () => ({
      ...createTask(),
      status: 'applied',
    })),
    commitTask: vi.fn(async () => ({
      ...createTask(),
      status: 'committed',
    })),
    discardTask: vi.fn(async () => ({
      ...createTask(),
      status: 'discarded',
    })),
    cancelTask: vi.fn(async () => ({
      ...createTask(),
      status: 'cancelled',
    })),
  } as unknown as RunnerApiClient
}

describe('task command', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates task through runner API', async () => {
    const client = createClient()
    const command = createTaskCommand(() => client)

    await command.parseAsync([
      'node',
      'test',
      'create',
      '--workspace',
      'ws_1',
      '--prompt',
      'fix README',
    ])

    expect(client.createTask).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      prompt: 'fix README',
    })
  })

  it('creates and runs task with --run', async () => {
    const client = createClient()
    const command = createTaskCommand(() => client)

    await command.parseAsync([
      'node',
      'test',
      'create',
      '--workspace',
      'ws_1',
      '--prompt',
      'fix README',
      '--run',
    ])

    expect(client.runTask).toHaveBeenCalledWith('task_1')
  })

  it('prints task diff', async () => {
    const client = createClient()
    const command = createTaskCommand(() => client)

    await command.parseAsync(['node', 'test', 'diff', 'task_1'])

    expect(client.getTaskDiff).toHaveBeenCalledWith('task_1')
    expect(process.stdout.write).toHaveBeenCalledWith(
      'diff --git a/README.md b/README.md\n+hello\n',
    )
  })

  it('applies task', async () => {
    const client = createClient()
    const command = createTaskCommand(() => client)

    await command.parseAsync(['node', 'test', 'apply', 'task_1'])

    expect(client.applyTask).toHaveBeenCalledWith('task_1')
  })

  it('commits task with message', async () => {
    const client = createClient()
    const command = createTaskCommand(() => client)

    await command.parseAsync([
      'node',
      'test',
      'commit',
      'task_1',
      '--message',
      'feat: update README',
    ])

    expect(client.commitTask).toHaveBeenCalledWith('task_1', {
      message: 'feat: update README',
    })
  })

  it('discards task', async () => {
    const client = createClient()
    const command = createTaskCommand(() => client)

    await command.parseAsync(['node', 'test', 'discard', 'task_1'])

    expect(client.discardTask).toHaveBeenCalledWith('task_1')
  })

  it('watches task through SSE', async () => {
    const client = createClient()
    const watchTaskEvents = vi.fn(async (input: WatchTaskEventsInput) => {
      input.onEvent({
        id: 'evt_1',
        taskId: 'task_1',
        type: 'agent.message',
        payload: {
          message: 'hello',
        },
        createdAt: '2026-06-22T00:00:00.000Z',
      })
    })

    const command = createTaskCommand(() => client, {
      watchTaskEvents,
    })

    await command.parseAsync(['node', 'test', 'watch', 'task_1'])

    expect(watchTaskEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'http://127.0.0.1:17890',
        taskId: 'task_1',
      }),
    )
  })
})
