import { CreateWorkspaceInputSchema } from '@forgeagent/core'
import type { FastifyInstance } from 'fastify'
import type { RunnerContext } from '../context'
import { parseBody } from '../validation'

export function registerWorkspaceRoutes(
  app: FastifyInstance,
  context: RunnerContext,
): void {
  app.get('/api/workspaces', async () => ({
    items: context.workspaceService.list(),
  }))

  app.get<{
    Params: { id: string }
  }>('/api/workspaces/:id', async request =>
    context.workspaceService.get(request.params.id),
  )

  app.post('/api/workspaces', async (request: any, reply) => {
    const input = parseBody(CreateWorkspaceInputSchema, request.body)
    const workspace = await context.workspaceService.create(input)

    return reply.status(201).send(workspace)
  })
}
