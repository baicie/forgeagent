import type { FastifyInstance } from 'fastify'
import type { RunnerContext } from '../context'

export function registerApprovalRoutes(
  app: FastifyInstance,
  context: RunnerContext,
): void {
  app.post<{
    Params: { id: string }
  }>('/api/approvals/:id/approve', async request =>
    context.approvalService.approve(request.params.id),
  )

  app.post<{
    Params: { id: string }
  }>('/api/approvals/:id/reject', async request =>
    context.approvalService.reject(request.params.id),
  )
}
