import { CreateTaskInputSchema } from '@forgeagent/core'
import type { FastifyInstance } from 'fastify'
import type { RunnerContext } from '../context'
import { parseBody } from '../validation'

interface CommitTaskBody {
  message?: string
}

export function registerTaskRoutes(
  app: FastifyInstance,
  context: RunnerContext,
): void {
  app.get('/api/tasks', async () => ({
    items: context.taskService.list(),
  }))

  app.get<{
    Params: { id: string }
  }>('/api/tasks/:id', async request =>
    context.taskService.get(request.params.id),
  )

  app.post('/api/tasks', async (request: any, reply) => {
    const input = parseBody(CreateTaskInputSchema, request.body)
    const task = await context.taskService.create(input)

    return reply.status(201).send(task)
  })

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/run', async (request: any) =>
    context.agentLoop.run(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/prepare', async (request: any) =>
    context.taskService.prepare(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/start', async (request: any) =>
    context.taskService.start(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/wait-approval', async (request: any) =>
    context.taskService.waitForApproval(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/complete', async (request: any) =>
    context.taskService.complete(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/fail', async (request: any) =>
    context.taskService.fail(request.params.id, {
      message: 'Task failed',
    }),
  )

  app.get<{
    Params: { id: string }
  }>('/api/tasks/:id/diff', async request =>
    context.taskService.getDiff(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/apply', async request =>
    context.taskService.apply(request.params.id),
  )

  app.post<{
    Params: { id: string }
    Body: CommitTaskBody
  }>('/api/tasks/:id/commit', async (request: any) =>
    context.taskService.commit(request.params.id, {
      message: request.body?.message,
    }),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/discard', async request =>
    context.taskService.discard(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/cancel', async request =>
    context.taskService.cancel(request.params.id),
  )
}
