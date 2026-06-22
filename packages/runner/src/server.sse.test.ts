import { loadRunnerConfig } from './config'
import { createInMemoryRunnerDb } from './db'
import { createRunnerServer } from './server'

describe('runner SSE stream', () => {
  it(
    'streams events appended after the connection is opened',
    async () => {
      const db = createInMemoryRunnerDb({
        workspaces: [],
        tasks: [
          {
            id: 'task_1',
            workspaceId: 'ws_1',
            prompt: 'fix bug',
            status: 'created',
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
          dataDir: '/tmp/forgeagent-sse-test',
        }),
        db,
      })

      const address = await app.listen({
        host: '127.0.0.1',
        port: 0,
      })

      try {
        const response = await fetch(`${address}/api/tasks/task_1/events`)

        expect(response.status).toBe(200)
        expect(response.body).toBeTruthy()

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        const chunks: string[] = []

        const readLoop = async () => {
          try {
            let keepReading = true
            while (keepReading) {
              const result = await reader.read()
              keepReading = !result.done
              if (result.value) {
                chunks.push(decoder.decode(result.value, { stream: true }))
              }
            }
          } catch {
            // stream closed
          }
        }

        readLoop()

        await new Promise(resolve => setTimeout(resolve, 100))

        await app.forgeagent.eventService.append({
          taskId: 'task_1',
          type: 'agent.message',
          payload: {
            message: 'hello from live stream',
          },
        })

        await new Promise(resolve => setTimeout(resolve, 500))

        const body = chunks.join('')

        expect(body).toContain('event: agent.message')
        expect(body).toContain('hello from live stream')

        reader.cancel()
      } finally {
        await app.close()
      }
    },
    30_000,
  )

  it(
    'does not miss events appended while historical events are being replayed',
    async () => {
      const db = createInMemoryRunnerDb({
        workspaces: [],
        tasks: [
          {
            id: 'task_1',
            workspaceId: 'ws_1',
            prompt: 'fix bug',
            status: 'created',
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
          dataDir: '/tmp/forgeagent-sse-race-test',
        }),
        db,
      })

      const historical = await app.forgeagent.eventService.append({
        taskId: 'task_1',
        type: 'task.status',
        payload: {
          status: 'created',
        },
      })

      const address = await app.listen({
        host: '127.0.0.1',
        port: 0,
      })

      try {
        const response = await fetch(
          `${address}/api/tasks/task_1/events?afterId=${historical.id}`,
        )

        expect(response.status).toBe(200)
        expect(response.body).toBeTruthy()

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        const chunks: string[] = []

        const readLoop = async () => {
          try {
            let keepReading = true
            while (keepReading) {
              const result = await reader.read()
              keepReading = !result.done
              if (result.value) {
                chunks.push(decoder.decode(result.value, { stream: true }))
              }
            }
          } catch {
            // stream closed
          }
        }

        readLoop()

        await app.forgeagent.eventService.append({
          taskId: 'task_1',
          type: 'agent.message',
          payload: {
            message: 'live event after subscribe',
          },
        })

        await new Promise(resolve => setTimeout(resolve, 300))

        const body = chunks.join('')

        expect(body).toContain('event: agent.message')
        expect(body).toContain('live event after subscribe')

        reader.cancel()
      } finally {
        await app.close()
      }
    },
    30_000,
  )
})
