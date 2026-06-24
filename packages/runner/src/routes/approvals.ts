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
  }>('/api/approvals/:id/approve', async request => {
    const response = await context.approvalGate.approve(request.params.id)

    await continueTaskAfterResolution(context, response.approval.taskId)

    return response
  })

  app.post<{
    Params: { id: string }
    Body: RejectBody
  }>('/api/approvals/:id/reject', async request => {
    const response = await context.approvalGate.reject(
      request.params.id,
      request.body?.reason,
    )

    await continueTaskAfterResolution(context, response.approval.taskId)

    return response
  })
}

async function continueTaskAfterResolution(
  context: RunnerContext,
  taskId: string,
): Promise<void> {
  const task = context.taskService.get(taskId)

  if (task.status === 'running') {
    await context.agentLoop.run(taskId)
  }
}
