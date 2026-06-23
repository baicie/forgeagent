import {
  access,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRunnerConfig } from './config'
import { createInMemoryRunnerDb } from './db'
import { createRunnerServer } from './server'
import { createGitFixture, runGitFixture } from './test/git-fixtures'

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

  it('creates workspace with git metadata', async () => {
    const app = await createTestServer()
    const fixture = await createGitFixture()

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath: fixture.repoPath,
          name: 'repo',
        },
      })

      expect(createResponse.statusCode).toBe(201)

      const workspace = createResponse.json() as {
        id: string
        repoPath: string
        gitRoot: string
        currentBranch: string
        currentCommit: string
      }

      expect(workspace.repoPath).toBe(fixture.repoPath)
      const realGitRoot = await realpath(workspace.gitRoot)
      const realRepoPath = await realpath(fixture.repoPath)
      expect(realGitRoot).toBe(realRepoPath)
      expect(workspace.currentBranch).toBeTruthy()
      expect(workspace.currentCommit).toMatch(/^[0-9a-f]{40}$/)

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/workspaces',
      })

      expect(listResponse.statusCode).toBe(200)
      expect(listResponse.json().items).toHaveLength(1)
    } finally {
      await fixture.cleanup()
      await app.close()
    }
  })

  it('rejects non-git workspace', async () => {
    const app = await createTestServer()
    const repoPath = join(tempDir, 'not-git')
    await mkdir(repoPath, { recursive: true })

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath,
        },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('INVALID_GIT_REPO')
    } finally {
      await app.close()
    }
  })

  it('creates task with isolated worktree and keeps original repo clean', async () => {
    const app = await createTestServer()
    const fixture = await createGitFixture()

    try {
      const baseBranch = await runGitFixture(fixture.repoPath, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ])

      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath: fixture.repoPath,
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
        baseBranch: string
        baseCommit: string
        worktreePath: string
      }

      expect(task.baseBranch).toBe(baseBranch)
      expect(task.baseCommit).toMatch(/^[0-9a-f]{40}$/)
      expect(task.worktreePath).toContain(join(tempDir, 'worktrees'))

      await expect(access(task.worktreePath)).resolves.toBeUndefined()

      const originalStatus = await runGitFixture(fixture.repoPath, [
        'status',
        '--porcelain',
      ])

      expect(originalStatus).toBe('')

      const currentBranch = await runGitFixture(fixture.repoPath, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ])

      expect(currentBranch).toBe(baseBranch)
    } finally {
      await fixture.cleanup()
      await app.close()
    }
  })

  it('reads diff from task worktree', async () => {
    const app = await createTestServer()
    const fixture = await createGitFixture()

    try {
      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath: fixture.repoPath,
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

      const task = taskResponse.json() as {
        id: string
        worktreePath: string
      }

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Changed by worktree\n',
        'utf-8',
      )

      const diffResponse = await app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}/diff`,
      })

      expect(diffResponse.statusCode).toBe(200)
      expect(diffResponse.json().diff).toContain('# Changed by worktree')

      const originalReadmeStatus = await runGitFixture(fixture.repoPath, [
        'status',
        '--porcelain',
      ])

      expect(originalReadmeStatus).toBe('')
    } finally {
      await fixture.cleanup()
      await app.close()
    }
  })

  it('discards task worktree and temporary branch', async () => {
    const app = await createTestServer()
    const fixture = await createGitFixture()

    try {
      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath: fixture.repoPath,
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

      const task = taskResponse.json() as {
        id: string
        worktreePath: string
      }

      const branchName = `forgeagent/task-${task.id}`

      await expect(access(task.worktreePath)).resolves.toBeUndefined()

      const discardResponse = await app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/discard`,
      })

      expect(discardResponse.statusCode).toBe(200)
      expect(discardResponse.json().status).toBe('discarded')

      await expect(access(task.worktreePath)).rejects.toThrow()

      const branch = await runGitFixture(fixture.repoPath, [
        'branch',
        '--list',
        branchName,
      ])

      expect(branch).toBe('')
    } finally {
      await fixture.cleanup()
      await app.close()
    }
  })

  it('returns 400 for invalid workspace body', async () => {
    const app = await createTestServer()

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {},
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('BAD_REQUEST')
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

  it('returns 409 when applying a task that is not completed', async () => {
    const app = await createTestServer()
    const fixture = await createGitFixture()

    try {
      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath: fixture.repoPath,
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

      const applyResponse = await app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/apply`,
      })

      expect(applyResponse.statusCode).toBe(409)
      expect(applyResponse.json().error.code).toBe('DIFF_EMPTY')
    } finally {
      await fixture.cleanup()
      await app.close()
    }
  })

  it('replays historical task events after refresh', async () => {
    const app = await createTestServer()
    const fixture = await createGitFixture()

    try {
      const workspaceResponse = await app.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: {
          repoPath: fixture.repoPath,
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

      await app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/prepare`,
      })

      await app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/start`,
      })

      const eventsResponse = await app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}/events?once=1`,
      })

      expect(eventsResponse.statusCode).toBe(200)
      expect(eventsResponse.body).toContain('event: task.status')
      expect(eventsResponse.body).toContain('"status":"created"')
      expect(eventsResponse.body).toContain('"status":"preparing"')
      expect(eventsResponse.body).toContain('"status":"running"')
    } finally {
      await fixture.cleanup()
      await app.close()
    }
  })
})
