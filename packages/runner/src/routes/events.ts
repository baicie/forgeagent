import type { TaskEvent } from '@forgeagent/core'
import type { FastifyInstance } from 'fastify'
import type { RunnerContext } from '../context'

function toSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function registerEventRoutes(
  app: FastifyInstance,
  context: RunnerContext,
): void {
  app.get<{
    Params: { id: string }
    Querystring: { once?: string }
  }>('/api/tasks/:id/events', async (request, reply) => {
    context.taskService.get(request.params.id)

    const events = context.eventService.listTaskEvents(request.params.id)

    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    })

    for (const event of events) {
      reply.raw.write(toSse(event.type, event))
    }

    if (request.query.once === '1') {
      reply.raw.end()
      return
    }

    const unsubscribe = context.eventService.subscribe(
      request.params.id,
      (event: TaskEvent) => {
        reply.raw.write(toSse(event.type, event))
      },
    )

    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n')
    }, 15_000)

    request.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })
}
