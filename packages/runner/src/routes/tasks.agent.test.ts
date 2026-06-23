import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import { createRunnerServer } from '../server'

describe('task agent route', () => {
  it('runs agent loop through task route with injectable loop', async () => {
    const db = createInMemoryRunnerDb({
      workspaces: [],
      tasks: [
        {
          id: 'task_1',
          workspaceId: 'ws_1',
          prompt: 'test',
          status: 'running',
          baseBranch: 'main',
          baseCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          worktreePath: '/tmp/worktree',
          createdAt: '2026-06-22T00:00:00.000Z',
          updatedAt: '2026-06-22T00:00:00.000Z',
        },
      ],
      events: [],
      approvals: [],
      audits: [],
    })

    const app = await createRunnerServer({
      config: loadRunnerConfig({
        dataDir: '/tmp/forgeagent-agent-route-test',
      }),
      db,
    })

    app.forgeagent.agentLoop = {
      run: vi.fn(async taskId => ({
        task: app.forgeagent.taskService.get(taskId),
        status: 'completed',
        finalMessage: 'done',
      })),
    } as unknown as typeof app.forgeagent.agentLoop

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks/task_1/run',
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        status: 'completed',
        finalMessage: 'done',
      })
      expect((app.forgeagent.agentLoop as any).run).toHaveBeenCalledWith(
        'task_1',
      )
    } finally {
      await app.close()
    }
  })
})
