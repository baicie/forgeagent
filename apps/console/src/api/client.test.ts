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
})
