import type { FastifyInstance } from 'fastify'
import type { RunnerContext } from '../context'

interface CreateWorkspaceBody {
  repoPath: string
  name?: string
}

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

  app.post<{
    Body: CreateWorkspaceBody
  }>('/api/workspaces', async (request, reply) => {
    const workspace = await context.workspaceService.create(request.body)

    return reply.status(201).send(workspace)
  })
}
