import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import { createRunnerServer } from '../server'
import { createGitFixture } from '../test/git-fixtures'

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

  return {
    app,
    gitFixture,
    workspace,
    async cleanup() {
      await app.close()
      await gitFixture.cleanup()
    },
  }
}

describe('task diff route', { timeout: 20000 }, () => {
  it('returns an empty diff after a task worktree is discarded', async () => {
    const fixture = await createServerFixture()

    try {
      const taskResponse = await fixture.app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: {
          workspaceId: fixture.workspace.id,
          prompt: 'discarded task diff',
        },
      })
      const task = taskResponse.json() as {
        id: string
        worktreePath: string
      }

      await writeFile(
        join(task.worktreePath, 'README.md'),
        '# Should be discarded\n',
        'utf-8',
      )

      const discardResponse = await fixture.app.inject({
        method: 'POST',
        url: `/api/tasks/${task.id}/discard`,
      })
      expect(discardResponse.statusCode).toBe(200)
      expect((discardResponse.json() as { status: string }).status).toBe(
        'discarded',
      )

      const diffResponse = await fixture.app.inject({
        method: 'GET',
        url: `/api/tasks/${task.id}/diff`,
      })

      expect(diffResponse.statusCode).toBe(200)
      expect(diffResponse.json()).toEqual({
        taskId: task.id,
        diff: '',
      })
    } finally {
      await fixture.cleanup()
    }
  })
})
