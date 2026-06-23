import { render, screen } from '@testing-library/react'
import { TaskTimeline } from './TaskTimeline'

describe('task timeline', () => {
  it('renders empty state', () => {
    render(<TaskTimeline events={[]} />)

    expect(screen.getByText(/暂无事件/)).toBeInTheDocument()
  })

  it('renders agent message event', () => {
    render(
      <TaskTimeline
        events={[
          {
            id: 'evt_1',
            taskId: 'task_1',
            type: 'agent.message',
            payload: {
              message: 'hello agent',
            },
            createdAt: '2026-06-22T00:00:00.000Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('agent.message')).toBeInTheDocument()
    expect(screen.getByText('hello agent')).toBeInTheDocument()
  })
})
