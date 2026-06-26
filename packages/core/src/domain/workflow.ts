import { z } from 'zod'

export const WorkflowStepTypeSchema = z.enum([
  'context_pack',
  'llm',
  'agent_loop',
  'tool',
  'validation',
  'readonly_review',
  'approval',
])
export type WorkflowStepType = z.infer<typeof WorkflowStepTypeSchema>

export const WorkflowApprovalModeSchema = z.enum(['none', 'required'])
export type WorkflowApprovalMode = z.infer<typeof WorkflowApprovalModeSchema>

export const WorkflowStepStatusSchema = z.enum([
  'pending',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'skipped',
])
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>

export const WorkflowRunStatusSchema = z.enum([
  'pending',
  'running',
  'waiting_approval',
  'completed',
  'failed',
])
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>

export const WorkflowMemoryPolicySchema = z.object({
  read: z.array(z.string()).default([]),
  write: z.array(z.string()).default([]),
})
export type WorkflowMemoryPolicy = z.infer<typeof WorkflowMemoryPolicySchema>

export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  type: WorkflowStepTypeSchema,
  tools: z.array(z.string()).default([]),
  actions: z.array(z.string()).default([]),
  output: z.string().optional(),
  approval: WorkflowApprovalModeSchema.default('none'),
  memory: WorkflowMemoryPolicySchema.default({ read: [], write: [] }),
})
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>

export const WorkflowDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
})
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>

export const WorkflowStepRunSchema = z.object({
  stepId: z.string().min(1),
  type: WorkflowStepTypeSchema,
  status: WorkflowStepStatusSchema,
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  error: z.string().optional(),
})
export type WorkflowStepRun = z.infer<typeof WorkflowStepRunSchema>

export const WorkflowRunSchema = z.object({
  taskId: z.string().min(1),
  workflowId: z.string().min(1),
  status: WorkflowRunStatusSchema,
  currentStepId: z.string().optional(),
  steps: z.array(WorkflowStepRunSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>

export const WorkflowEventPayloadSchema = z.object({
  workflowId: z.string().optional(),
  stepId: z.string().optional(),
  stepType: WorkflowStepTypeSchema.optional(),
  status: WorkflowStepStatusSchema.optional(),
  runStatus: WorkflowRunStatusSchema.optional(),
  error: z.string().optional(),
})
export type WorkflowEventPayload = z.infer<typeof WorkflowEventPayloadSchema>

export function createInitialWorkflowRun(input: {
  taskId: string
  workflow: WorkflowDefinition
  now: string
}): WorkflowRun {
  return WorkflowRunSchema.parse({
    taskId: input.taskId,
    workflowId: input.workflow.id,
    status: 'pending',
    currentStepId: input.workflow.steps[0]?.id,
    steps: input.workflow.steps.map(step => ({
      stepId: step.id,
      type: step.type,
      status: 'pending',
    })),
    createdAt: input.now,
    updatedAt: input.now,
  })
}

export function getWorkflowStep(
  workflow: WorkflowDefinition,
  stepId: string,
): WorkflowStep {
  const step = workflow.steps.find(item => item.id === stepId)

  if (!step) {
    throw new Error(`Workflow step not found: ${stepId}`)
  }

  return step
}

export function getNextWorkflowStep(
  workflow: WorkflowDefinition,
  stepId: string,
): WorkflowStep | undefined {
  const index = workflow.steps.findIndex(item => item.id === stepId)

  if (index < 0) {
    throw new Error(`Workflow step not found: ${stepId}`)
  }

  return workflow.steps[index + 1]
}

export function isWorkflowReadOnlyStep(step: WorkflowStep): boolean {
  return step.type === 'readonly_review'
}
