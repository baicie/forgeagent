import {
  RunnerApiClient,
  RunnerApiError,
  getRunnerUrlFromEnv,
  normalizeRunnerUrl,
} from './runnerClient'

describe('runner api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes runner url', () => {
    expect(normalizeRunnerUrl('http://127.0.0.1:17890/')).toBe(
      'http://127.0.0.1:17890',
    )
  })

  it('loads runner url from env', () => {
    const oldValue = process.env.FORGEAGENT_RUNNER_URL

    process.env.FORGEAGENT_RUNNER_URL = 'http://localhost:9999/'

    try {
      expect(getRunnerUrlFromEnv()).toBe('http://localhost:9999')
    } finally {
      process.env.FORGEAGENT_RUNNER_URL = oldValue
    }
  })

  it('creates workspace through HTTP API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/json',
        }),
        json: async () => ({
          id: 'ws_1',
          name: 'repo',
          repoPath: '/repo',
          gitRoot: '/repo',
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        }),
      })),
    )

    const client = new RunnerApiClient('http://127.0.0.1:17890')
    const workspace = await client.createWorkspace({
      repoPath: '/repo',
      name: 'repo',
    })

    expect(workspace.id).toBe('ws_1')
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:17890/api/workspaces',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoPath: '/repo',
          name: 'repo',
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
        statusText: 'Conflict',
        headers: new Headers(),
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
      code: 'DIFF_EMPTY',
      status: 409,
    })

    await expect(client.applyTask('task_1')).rejects.toBeInstanceOf(
      RunnerApiError,
    )
  })

  it('wraps network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused')
      }),
    )

    const client = new RunnerApiClient()

    await expect(client.listTasks()).rejects.toMatchObject({
      name: 'RunnerApiError',
      code: 'NETWORK_ERROR',
      status: 0,
    })
  })

  it('wraps non-json success response as RUNNER_RESPONSE_INVALID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'text/plain',
        }),
        text: async () => 'ok',
      })),
    )

    const client = new RunnerApiClient()

    await expect(client.listTasks()).rejects.toMatchObject({
      name: 'RunnerApiError',
      code: 'RUNNER_RESPONSE_INVALID',
      status: 200,
    })
  })

  it('allows empty 204 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        text: async () => '',
      })),
    )

    const client = new RunnerApiClient()

    await expect(client.health()).resolves.toBeUndefined()
  })
})
