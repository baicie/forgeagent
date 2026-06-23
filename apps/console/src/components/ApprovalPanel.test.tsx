import { fireEvent, render, screen } from '@testing-library/react'
import type { TaskEvent } from '../types'
import { ApprovalPanel, collectApprovals } from './ApprovalPanel'

function event(input: Partial<TaskEvent>): TaskEvent {
  return {
    id: input.id || 'evt_1',
    taskId: input.taskId || 'task_1',
    type: input.type || 'approval.required',
    payload: input.payload ?? {},
    createdAt: input.createdAt || '2026-06-22T00:00:00.000Z',
  } as TaskEvent
}

describe('approval panel', () => {
  it('collects pending and resolved approvals', () => {
    const approvals = collectApprovals([
      event({
        id: 'evt_1',
        type: 'approval.required',
        payload: {
          approvalId: 'approval_1',
          command: 'pnpm test',
          risk: 'medium',
        },
      }),
      event({
        id: 'evt_2',
        type: 'approval.resolved',
        payload: {
          approvalId: 'approval_1',
          status: 'approved',
        },
      }),
    ])

    expect(approvals).toEqual([
      expect.objectContaining({
        approvalId: 'approval_1',
        status: 'approved',
      }),
    ])
  })

  it('renders pending approval actions', () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()

    render(
      <ApprovalPanel
        events={[
          event({
            type: 'approval.required',
            payload: {
              approvalId: 'approval_1',
              command: 'pnpm test',
              reason: '验证修改',
              risk: 'dangerous',
            },
          }),
        ]}
        onApprove={onApprove}
        onReject={onReject}
      />,
    )

    expect(screen.getByText('pnpm test')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Approve'))
    expect(onApprove).toHaveBeenCalledWith('approval_1')

    fireEvent.click(screen.getByText('Reject'))
    expect(onReject).toHaveBeenCalledWith('approval_1', 'Rejected from console')
  })
})
