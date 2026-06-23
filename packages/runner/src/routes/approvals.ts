import type { FastifyInstance } from 'fastify'
import type { RunnerContext } from '../context'

interface RejectBody {
  reason?: string
}

export function registerApprovalRoutes(
  app: FastifyInstance,
  context: RunnerContext,
): void {
  app.post<{
    Params: { id: string }
  }>('/api/approvals/:id/approve', async request =>
    context.approvalGate.approve(request.params.id),
  )

  app.post<{
    Params: { id: string }
    Body: RejectBody
  }>('/api/approvals/:id/reject', async request =>
    context.approvalGate.reject(request.params.id, request.body?.reason),
  )
}
