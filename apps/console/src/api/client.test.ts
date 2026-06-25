import { RunnerApiClient, RunnerApiError } from './client'

describe('runner api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists workspaces', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'ws_1',
              name: 'repo',
              repoPath: '/repo',
              gitRoot: '/repo',
              createdAt: '2026-06-22T00:00:00.000Z',
              updatedAt: '2026-06-22T00:00:00.000Z',
            },
          ],
        }),
      })),
    )

    const client = new RunnerApiClient('http://127.0.0.1:17890')
    const workspaces = await client.listWorkspaces()

    expect(workspaces).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:17890/api/workspaces',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('creates task with JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: 'task_1',
          workspaceId: 'ws_1',
          prompt: 'fix bug',
          status: 'created',
          baseBranch: 'main',
          baseCommit: 'a'.repeat(40),
          worktreePath: '/tmp/worktree',
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        }),
      })),
    )

    const client = new RunnerApiClient()
    const task = await client.createTask({
      workspaceId: 'ws_1',
      prompt: 'fix bug',
    })

    expect(task.id).toBe('task_1')
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ws_1',
          prompt: 'fix bug',
        }),
      }),
    )
  })

  it('throws RunnerApiError for error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'DIFF_EMPTY',
            message: 'Task diff is empty',
          },
        }),
      })),
    )

    const client = new RunnerApiClient()

    await expect(client.applyTask('task_1')).rejects.toMatchObject({
      name: 'RunnerApiError',
      status: 409,
      code: 'DIFF_EMPTY',
    })

    await expect(client.applyTask('task_1')).rejects.toBeInstanceOf(
      RunnerApiError,
    )
  })

  it('normalizes base URL without trailing slash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [],
        }),
      })),
    )

    const client = new RunnerApiClient('http://127.0.0.1:17890/')
    await client.listTasks()

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:17890/api/tasks',
      expect.anything(),
    )
  })

  it('wraps network errors as RunnerApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused')
      }),
    )

    const client = new RunnerApiClient()

    await expect(client.listTasks()).rejects.toMatchObject({
      name: 'RunnerApiError',
      status: 0,
      code: 'RUNNER_UNAVAILABLE',
    })
  })

  it('gets cleanup preview', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          count: 1,
          estimatedBytes: 1024,
          tasks: [
            {
              id: 'task_1',
              status: 'completed',
              worktreePath: '/tmp/worktree',
              estimatedBytes: 1024,
            },
          ],
        }),
      })),
    )

    const client = new RunnerApiClient('http://127.0.0.1:17890')
    const result = await client.getTaskCleanupPreview({
      taskId: 'task_1',
    })

    expect(result.count).toBe(1)
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:17890/api/tasks/cleanup/preview?taskId=task_1',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('cleans up tasks with JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          deleted: 1,
          failed: 0,
        }),
      })),
    )

    const client = new RunnerApiClient()
    const result = await client.cleanupTasks({
      taskId: 'task_1',
    })

    expect(result.deleted).toBe(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/cleanup',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          taskId: 'task_1',
        }),
      }),
    )
  })

  it('gets task memory snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          taskId: 'task_1',
          runDir: '/tmp/runs/task_1',
          files: [
            {
              file: 'task_plan.md',
              content: '# Task Plan',
              bytes: 11,
            },
          ],
        }),
      })),
    )

    const client = new RunnerApiClient()
    const result = await client.getTaskMemory('task_1')

    expect(result.taskId).toBe('task_1')
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/task_1/memory',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('gets one task memory file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          file: 'findings.md',
          content: '# Findings',
          bytes: 10,
        }),
      })),
    )

    const client = new RunnerApiClient()
    const result = await client.getTaskMemoryFile('task_1', 'findings.md')

    expect(result.file).toBe('findings.md')
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks/task_1/memory/findings.md',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })
})
