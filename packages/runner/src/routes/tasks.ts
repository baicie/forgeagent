import {
  CreateTaskInputSchema,
  TaskMemoryFileNameSchema,
} from '@forgeagent/core'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RunnerContext } from '../context'
import { parseBody } from '../validation'

const CommitTaskBodySchema = z
  .object({
    message: z.string().min(1).optional(),
  })
  .default({})

const CleanupTasksBodySchema = z
  .object({
    taskId: z.string().min(1).optional(),
  })
  .default({})

export function registerTaskRoutes(
  app: FastifyInstance,
  context: RunnerContext,
): void {
  app.get('/api/tasks', async () => ({
    items: context.taskService.list(),
  }))

  app.get('/api/tasks/cleanup/preview', async request => {
    const query = request.query as { taskId?: string }

    return context.taskService.previewCleanup({
      taskId: query.taskId,
    })
  })

  app.get<{
    Params: { id: string }
  }>('/api/tasks/:id/memory', async request =>
    context.taskService.getMemory(request.params.id),
  )

  app.get<{
    Params: { id: string; file: string }
  }>('/api/tasks/:id/memory/:file', async request =>
    context.taskService.getMemoryFile(
      request.params.id,
      TaskMemoryFileNameSchema.parse(request.params.file),
    ),
  )

  app.get<{
    Params: { id: string }
  }>('/api/tasks/:id', async request =>
    context.taskService.get(request.params.id),
  )

  app.get<{
    Params: { id: string }
  }>('/api/tasks/:id/validation', async request => {
    const task = context.taskService.get(request.params.id)
    const plan = context.validationService.getPlan(task.id)

    if (plan) {
      return {
        plan,
        summary: context.validationService.summarize(plan),
        persisted: true,
      }
    }

    const preview = await context.validationService.previewPlan({ task })
    return {
      plan: preview,
      summary: context.validationService.summarize(preview),
      persisted: false,
    }
  })

  app.get<{
    Params: { id: string }
  }>('/api/tasks/:id/review', async request => {
    const review = context.reviewerService.getReview(request.params.id)
    return { review }
  })

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/review', async request => {
    const review = await context.reviewerService.review(request.params.id)
    return { review }
  })

  app.post('/api/tasks', async (request, reply) => {
    const input = parseBody(CreateTaskInputSchema, request.body)
    const task = await context.taskService.create(input)

    return reply.status(201).send(task)
  })

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/run', async request =>
    context.agentLoop.run(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/prepare', async request =>
    context.taskService.prepare(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/start', async request =>
    context.taskService.start(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/wait-approval', async request =>
    context.taskService.waitForApproval(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/complete', async request =>
    context.taskService.complete(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/tasks/:id/fail', async request =>
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
  }>('/api/tasks/:id/commit', async request => {
    const body = parseBody(CommitTaskBodySchema, request.body ?? {})

    return context.taskService.commit(request.params.id, body)
  })

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

  app.delete<{
    Params: { id: string }
  }>('/api/tasks/:id', async (request, reply) => {
    await context.taskService.delete(request.params.id)

    return reply.status(204).send()
  })

  app.post('/api/tasks/cleanup', async request => {
    const body = parseBody(CleanupTasksBodySchema, request.body ?? {})
    const result = await context.taskService.deleteAll(body)

    return result
  })
}
