import {
  WorkflowDefinitionSchema,
  createInitialWorkflowRun,
  getNextWorkflowStep,
  getWorkflowStep,
  isWorkflowReadOnlyStep,
} from './workflow'

describe('workflow domain', () => {
  const workflow = WorkflowDefinitionSchema.parse({
    id: 'bugfix',
    name: 'Bugfix Workflow',
    steps: [
      { id: 'context', type: 'context_pack', output: 'context_pack.md' },
      { id: 'edit', type: 'agent_loop', tools: ['read_file'] },
      { id: 'review', type: 'readonly_review' },
    ],
  })

  it('parses workflow definition', () => {
    expect(workflow.id).toBe('bugfix')
    expect(workflow.steps).toHaveLength(3)
    expect(workflow.steps[1].tools).toEqual(['read_file'])
  })

  it('creates initial workflow run', () => {
    const run = createInitialWorkflowRun({
      taskId: 'task_1',
      workflow,
      now: '2026-06-26T00:00:00.000Z',
    })

    expect(run.status).toBe('pending')
    expect(run.currentStepId).toBe('context')
    expect(run.steps[0].status).toBe('pending')
    expect(run.workflowId).toBe('bugfix')
  })

  it('gets step by id', () => {
    expect(getWorkflowStep(workflow, 'edit').type).toBe('agent_loop')
  })

  it('gets next step', () => {
    expect(getNextWorkflowStep(workflow, 'context')?.id).toBe('edit')
    expect(getNextWorkflowStep(workflow, 'review')).toBeUndefined()
  })

  it('throws when step not found', () => {
    expect(() => getWorkflowStep(workflow, 'nonexistent')).toThrow(
      'Workflow step not found',
    )
    expect(() => getNextWorkflowStep(workflow, 'nonexistent')).toThrow(
      'Workflow step not found',
    )
  })

  it('detects read-only review step', () => {
    expect(isWorkflowReadOnlyStep(getWorkflowStep(workflow, 'review'))).toBe(
      true,
    )
    expect(isWorkflowReadOnlyStep(getWorkflowStep(workflow, 'edit'))).toBe(
      false,
    )
  })

  it('parses step with memory policy', () => {
    const wf = WorkflowDefinitionSchema.parse({
      id: 'test',
      name: 'Test',
      steps: [
        {
          id: 'plan',
          type: 'llm',
          memory: {
            write: ['task_plan.md', 'decisions.md'],
            read: ['context_pack.md'],
          },
        },
      ],
    })

    const step = getWorkflowStep(wf, 'plan')
    expect(step.memory.write).toEqual(['task_plan.md', 'decisions.md'])
    expect(step.memory.read).toEqual(['context_pack.md'])
  })

  it('parses approval step', () => {
    const wf = WorkflowDefinitionSchema.parse({
      id: 'test',
      name: 'Test',
      steps: [
        {
          id: 'final_approval',
          type: 'approval',
          actions: ['apply', 'commit', 'discard'],
        },
      ],
    })

    const step = getWorkflowStep(wf, 'final_approval')
    expect(step.type).toBe('approval')
    expect(step.actions).toEqual(['apply', 'commit', 'discard'])
  })
})
