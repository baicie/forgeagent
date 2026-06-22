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

        // Start reading in the background
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

        // Give the stream time to establish
        await new Promise(resolve => setTimeout(resolve, 100))

        // Append an event while the stream is open
        await app.forgeagent.eventService.append({
          taskId: 'task_1',
          type: 'agent.message',
          payload: {
            message: 'hello from live stream',
          },
        })

        // Wait for the event to be flushed
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
})
