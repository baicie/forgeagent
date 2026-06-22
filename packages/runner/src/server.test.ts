import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRunnerConfig } from './config'
import { createInMemoryRunnerDb } from './db'
import { createRunnerServer } from './server'

describe('runner server', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-runner-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  async function createTestServer() {
    const app = await createRunnerServer({
      config: loadRunnerConfig({
        dataDir: tempDir,
      }),
      db: createInMemoryRunnerDb(),
    })

    return app
  }

  it('returns health payload', async () => {
    const app = await createTestServer()

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        ok: true,
        name: 'forgeagent-runner',
        version: '0.1.0',
        host: '127.0.0.1',
        port: 17890,
      })
    } finally {
      await app.close()
    }
  })

  it('creates and lists workspaces', async () => {
    const app = await createTestServer()
    const repoPath = join(tempDir, 'repo')
    await mkdir(repoPath, { recursive: true })

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath,
          name: 'repo',
        },
      })

      expect(createResponse.statusCode).toBe(201)

      const workspace = createResponse.json() as {
        id: string
        repoPath: string
        gitRoot: string
      }

      expect(workspace.repoPath).toBe(repoPath)
      expect(workspace.gitRoot).toBe(repoPath)

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/workspaces',
      })

      expect(listResponse.statusCode).toBe(200)
      expect(listResponse.json().items).toHaveLength(1)
    } finally {
      await app.close()
    }
  })

  it('returns 404 for missing workspace', async () => {
    const app = await createTestServer()

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workspaces/ws_missing',
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error.code).toBe('WORKSPACE_NOT_FOUND')
    } finally {
      await app.close()
    }
  })

  it('creates task for an existing workspace', async () => {
    const app = await createTestServer()
    const repoPath = join(tempDir, 'repo')
    await mkdir(repoPath, { recursive: true })

    try {
      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath,
        },
      })

      const workspace = workspaceResponse.json() as { id: string }

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: {
          workspaceId: workspace.id,
          prompt: 'fix bug',
        },
      })

      expect(taskResponse.statusCode).toBe(201)

      const task = taskResponse.json() as {
        id: string
        workspaceId: string
        status: string
      }

      expect(task.workspaceId).toBe(workspace.id)
      expect(task.status).toBe('created')

      const eventsResponse = await app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}/events?once=1`,
      })

      expect(eventsResponse.statusCode).toBe(200)
      expect(eventsResponse.body).toContain('event: task.status')
    } finally {
      await app.close()
    }
  })

  it('returns 404 when creating task for missing workspace', async () => {
    const app = await createTestServer()

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: {
          workspaceId: 'ws_missing',
          prompt: 'fix bug',
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error.code).toBe('WORKSPACE_NOT_FOUND')
    } finally {
      await app.close()
    }
  })

  it('returns empty diff placeholder for Phase 2', async () => {
    const app = await createTestServer()
    const repoPath = join(tempDir, 'repo')
    await mkdir(repoPath, { recursive: true })

    try {
      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath,
        },
      })

      const workspace = workspaceResponse.json() as { id: string }

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: {
          workspaceId: workspace.id,
          prompt: 'fix bug',
        },
      })

      const task = taskResponse.json() as { id: string }

      const diffResponse = await app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}/diff`,
      })

      expect(diffResponse.statusCode).toBe(200)
      expect(diffResponse.json()).toEqual({
        taskId: task.id,
        diff: '',
      })
    } finally {
      await app.close()
    }
  })

  it('can cancel a created task', async () => {
    const app = await createTestServer()
    const repoPath = join(tempDir, 'repo')
    await mkdir(repoPath, { recursive: true })

    try {
      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath,
        },
      })

      const workspace = workspaceResponse.json() as { id: string }

      const taskResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: {
          workspaceId: workspace.id,
          prompt: 'fix bug',
        },
      })

      const task = taskResponse.json() as { id: string }

      const cancelResponse = await app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/cancel`,
      })

      expect(cancelResponse.statusCode).toBe(200)
      expect(cancelResponse.json().status).toBe('cancelled')
    } finally {
      await app.close()
    }
  })

  it('returns 404 for missing approval', async () => {
    const app = await createTestServer()

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/approvals/approval_missing/approve',
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error.code).toBe('APPROVAL_NOT_FOUND')
    } finally {
      await app.close()
    }
  })
})
