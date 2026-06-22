import type { TaskEvent } from '@forgeagent/core'
import type { FastifyInstance } from 'fastify'
import type { ServerResponse } from 'node:http'
import type { RunnerContext } from '../context'

export function toSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function writeSse(
  response: ServerResponse,
  event: string,
  data: unknown,
): boolean {
  if (response.destroyed || response.writableEnded) {
    return false
  }

  response.write(toSse(event, data))

  return true
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined
  }

  return parsed
}

export function registerEventRoutes(
  app: FastifyInstance,
  context: RunnerContext,
): void {
  app.get<{
    Params: { id: string }
    Querystring: {
      once?: string
      afterId?: string
      limit?: string
    }
  }>('/api/tasks/:id/events', async (request, reply) => {
    context.taskService.get(request.params.id)

    const events = context.eventService.listTaskEvents(request.params.id, {
      afterId: request.query.afterId,
      limit: parseLimit(request.query.limit),
    })

    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    })

    for (const event of events) {
      writeSse(reply.raw, event.type, event)
    }

    if (request.query.once === '1') {
      reply.raw.end()
      return
    }

    const unsubscribe = context.eventService.subscribe(
      request.params.id,
      (event: TaskEvent) => {
        writeSse(reply.raw, event.type, event)
      },
    )

    const heartbeat = setInterval(() => {
      if (!reply.raw.destroyed && !reply.raw.writableEnded) {
        reply.raw.write(': heartbeat\n\n')
      }
    }, 15_000)

    request.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })
}
