import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import { createRunnerServer } from '../server'
import { createGitFixture, runGitFixture } from '../test/git-fixtures'

async function createServerFixture() {
  const gitFixture = await createGitFixture()
  const app = await createRunnerServer({
    config: loadRunnerConfig({
      dataDir: join(gitFixture.tempDir, '.forgeagent'),
    }),
    db: createInMemoryRunnerDb(),
  })

  const workspaceResponse = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    payload: {
      repoPath: gitFixture.repoPath,
    },
  })

  const workspace = workspaceResponse.json() as { id: string }

  async function createTask(prompt = 'delivery test') {
    const taskResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        workspaceId: workspace.id,
        prompt,
      },
    })

    const task = taskResponse.json() as {
      id: string
      worktreePath: string
    }

    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/prepare`,
    })
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/start`,
    })
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/complete`,
    })

    return task
  }

  return {
    app,
    gitFixture,
    workspace,
    createTask,
    async cleanup() {
      await app.close()
      await gitFixture.cleanup()
    },
  }
}

describe('task delivery routes', { timeout: 20000 }, () => {
  it('shows diff for added, modified and deleted files', async () => {
    const fixture = await createServerFixture()

    try {
      await writeFile(join(fixture.gitFixture.repoPath, 'delete-me.txt'), 'x\n')
      await runGitFixture(fixture.gitFixture.repoPath, ['add', 'delete-me.txt'])
      await runGitFixture(fixture.gitFixture.repoPath, [
        'commit',
        '-m',
        'add delete fixture',
      ])

      const task = await fixture.createTask('diff all files')

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Modified by task\n',
      )
      await writeFile(join(task.worktreePath, 'new-file.txt'), 'new file\n')
      await import('node:fs/promises').then(fs =>
        fs.rm(join(task.worktreePath, 'delete-me.txt')),
      )

      const response = await fixture.app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}/diff`,
      })

      expect(response.statusCode).toBe(200)
      expect((response.json() as { diff: string }).diff).toContain('README.md')
      expect((response.json() as { diff: string }).diff).toContain(
        'new-file.txt',
      )
      expect((response.json() as { diff: string }).diff).toContain(
        'delete-me.txt',
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('applies worktree changes to original repo', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('apply changes')

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Applied through API\n',
        'utf-8',
      )

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/apply`,
      })

      expect(response.statusCode).toBe(200)
      expect((response.json() as { status: string }).status).toBe('applied')

      await expect(
        readFile(join(fixture.gitFixture.repoPath, 'README.md'), 'utf-8'),
      ).resolves.toContain('Applied through API')
    } finally {
      await fixture.cleanup()
    }
  })

  it('commits worktree changes', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('commit changes')

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Committed through API\n',
        'utf-8',
      )

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/commit`,
        payload: {
          message: 'test: commit delivery changes',
        },
      })

      expect(response.statusCode).toBe(200)
      expect((response.json() as { status: string }).status).toBe('committed')

      const message = await runGitFixture(task.worktreePath, [
        'log',
        '-1',
        '--format=%s',
      ])

      expect(message).toBe('test: commit delivery changes')
    } finally {
      await fixture.cleanup()
    }
  })

  it('discards worktree and leaves original repo clean', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('discard changes')

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Should be discarded\n',
        'utf-8',
      )

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/discard`,
      })

      expect(response.statusCode).toBe(200)
      expect((response.json() as { status: string }).status).toBe('discarded')

      await expect(access(task.worktreePath)).rejects.toThrow()

      const status = await runGitFixture(fixture.gitFixture.repoPath, [
        'status',
        '--porcelain',
      ])

      expect(status).toBe('')
    } finally {
      await fixture.cleanup()
    }
  })

  it('returns DIFF_EMPTY when applying empty diff', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('empty apply')

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/apply`,
      })

      expect(response.statusCode).toBe(409)
      expect((response.json() as { error: { code: string } }).error.code).toBe(
        'DIFF_EMPTY',
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('returns DIFF_EMPTY when committing empty diff', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('empty commit')

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/commit`,
        payload: {
          message: 'test: empty commit',
        },
      })

      expect(response.statusCode).toBe(409)
      expect((response.json() as { error: { code: string } }).error.code).toBe(
        'DIFF_EMPTY',
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('returns PATCH_APPLY_FAILED when patch conflicts', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('conflict apply')

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Worktree change\n',
        'utf-8',
      )

      await writeFile(
        join(fixture.gitFixture.repoPath, 'README.md'),
        '# Original changed\n',
        'utf-8',
      )

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/apply`,
      })

      expect(response.statusCode).toBe(409)
      expect((response.json() as { error: { code: string } }).error.code).toBe(
        'PATCH_APPLY_FAILED',
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('does not apply patch when task is not completed', async () => {
    const fixture = await createServerFixture()

    try {
      const taskResponse = await fixture.app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: {
          workspaceId: fixture.workspace.id,
          prompt: 'apply before completed',
        },
      })

      const task = taskResponse.json() as {
        id: string
        worktreePath: string
      }

      await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/prepare`,
      })

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Should not be applied\n',
        'utf-8',
      )

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/apply`,
      })

      expect(response.statusCode).toBe(409)
      expect((response.json() as { error: { code: string } }).error.code).toBe(
        'INVALID_TASK_STATUS_TRANSITION',
      )

      await expect(
        readFile(join(fixture.gitFixture.repoPath, 'README.md'), 'utf-8'),
      ).resolves.not.toContain('Should not be applied')
    } finally {
      await fixture.cleanup()
    }
  })

  it('does not commit worktree when task is not completed', async () => {
    const fixture = await createServerFixture()

    try {
      const taskResponse = await fixture.app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: {
          workspaceId: fixture.workspace.id,
          prompt: 'commit before completed',
        },
      })

      const task = taskResponse.json() as {
        id: string
        worktreePath: string
      }

      await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/prepare`,
      })

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Should not be committed\n',
        'utf-8',
      )

      const headBefore = await runGitFixture(task.worktreePath, [
        'rev-parse',
        'HEAD',
      ])

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/commit`,
        payload: {
          message: 'test: should not commit',
        },
      })

      expect(response.statusCode).toBe(409)
      expect((response.json() as { error: { code: string } }).error.code).toBe(
        'INVALID_TASK_STATUS_TRANSITION',
      )

      const headAfter = await runGitFixture(task.worktreePath, [
        'rev-parse',
        'HEAD',
      ])

      expect(headAfter).toBe(headBefore)
    } finally {
      await fixture.cleanup()
    }
  })

  it('returns 400 for invalid commit body', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('invalid commit body')

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/commit`,
        payload: {
          message: 123,
        },
      })

      expect(response.statusCode).toBe(400)
      expect((response.json() as { error: { code: string } }).error.code).toBe(
        'BAD_REQUEST',
      )
    } finally {
      await fixture.cleanup()
    }
  })

  it('blocks apply when original repo has local changes', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('apply with dirty original')

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Worktree change\n',
        'utf-8',
      )

      await writeFile(
        join(fixture.gitFixture.repoPath, 'local-only.txt'),
        'dirty\n',
        'utf-8',
      )

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/apply`,
      })

      expect(response.statusCode).toBe(409)
      expect((response.json() as { error: { code: string } }).error.code).toBe(
        'PATCH_APPLY_FAILED',
      )

      await expect(
        readFile(join(fixture.gitFixture.repoPath, 'README.md'), 'utf-8'),
      ).resolves.not.toContain('Worktree change')
    } finally {
      await fixture.cleanup()
    }
  })

  it('deletes task, worktree, and all associated records', async () => {
    const fixture = await createServerFixture()

    try {
      const task = await fixture.createTask('delete me')

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Will be deleted\n',
        'utf-8',
      )

      const listBefore = await fixture.app.inject({
        method: 'GET',
        url: '/api/tasks',
      })
      expect((listBefore.json() as { items: unknown[] }).items).toHaveLength(1)

      const deleteResponse = await fixture.app.inject({
        method: 'DELETE',
        url: `/api/tasks/${task.id}`,
      })

      expect(deleteResponse.statusCode).toBe(204)

      const listAfter = await fixture.app.inject({
        method: 'GET',
        url: '/api/tasks',
      })
      expect((listAfter.json() as { items: unknown[] }).items).toHaveLength(0)

      await expect(access(task.worktreePath)).rejects.toThrow()

      const getResponse = await fixture.app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}`,
      })
      expect(getResponse.statusCode).toBe(404)
    } finally {
      await fixture.cleanup()
    }
  })

  it('returns 404 when deleting non-existent task', async () => {
    const fixture = await createServerFixture()

    try {
      const response = await fixture.app.inject({
        method: 'DELETE',
        url: '/api/tasks/task_does_not_exist',
      })

      expect(response.statusCode).toBe(404)
    } finally {
      await fixture.cleanup()
    }
  })

  it('deletes all tasks and their worktrees', async () => {
    const fixture = await createServerFixture()

    try {
      await fixture.createTask('delete all 1')
      await fixture.createTask('delete all 2')
      await fixture.createTask('delete all 3')

      const listBefore = await fixture.app.inject({
        method: 'GET',
        url: '/api/tasks',
      })
      expect((listBefore.json() as { items: unknown[] }).items).toHaveLength(3)

      const cleanupResponse = await fixture.app.inject({
        method: 'POST',
        url: '/api/tasks/cleanup',
      })

      expect(cleanupResponse.statusCode).toBe(200)
      expect(cleanupResponse.json()).toEqual({ deleted: 3, failed: 0 })

      const listAfter = await fixture.app.inject({
        method: 'GET',
        url: '/api/tasks',
      })
      expect((listAfter.json() as { items: unknown[] }).items).toHaveLength(0)
    } finally {
      await fixture.cleanup()
    }
  })
})
