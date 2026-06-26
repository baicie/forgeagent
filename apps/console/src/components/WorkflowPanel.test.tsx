import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkflowPanel } from './WorkflowPanel'

describe('workflow panel', () => {
  it('renders empty state', () => {
    render(<WorkflowPanel onRefresh={() => {}} />)
    expect(screen.getByText('暂无 workflow 状态。')).toBeTruthy()
  })

  it('renders workflow steps', () => {
    render(
      <WorkflowPanel
        onRefresh={() => {}}
        workflow={{
          run: {
            taskId: 'task_1',
            workflowId: 'bugfix',
            status: 'running',
            currentStepId: 'edit',
            createdAt: '2026-06-26T00:00:00.000Z',
            updatedAt: '2026-06-26T00:00:00.000Z',
            steps: [
              { stepId: 'context', type: 'context_pack', status: 'completed' },
              { stepId: 'edit', type: 'agent_loop', status: 'running' },
            ],
          },
          currentStep: {
            id: 'edit',
            type: 'agent_loop',
            tools: ['read_file', 'apply_patch'],
            actions: [],
          },
        }}
      />,
    )

    expect(screen.getByText('bugfix')).toBeTruthy()
    expect(screen.getByText('context')).toBeTruthy()
    expect(screen.getByText('edit')).toBeTruthy()
    expect(screen.getByText('read_file')).toBeTruthy()
  })

  it('shows current step indicator', () => {
    render(
      <WorkflowPanel
        onRefresh={() => {}}
        workflow={{
          run: {
            taskId: 'task_1',
            workflowId: 'bugfix',
            status: 'running',
            currentStepId: 'plan',
            createdAt: '2026-06-26T00:00:00.000Z',
            updatedAt: '2026-06-26T00:00:00.000Z',
            steps: [
              { stepId: 'context', type: 'context_pack', status: 'completed' },
              { stepId: 'plan', type: 'llm', status: 'running' },
            ],
          },
          currentStep: {
            id: 'plan',
            type: 'llm',
            tools: [],
            actions: [],
          },
        }}
      />,
    )

    const editItem = screen.getByText('plan').closest('li')
    expect(editItem?.className).toBe('current')
  })
})
