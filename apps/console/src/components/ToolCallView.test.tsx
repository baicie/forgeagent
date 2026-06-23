import { render, screen } from '@testing-library/react'
import { ToolCallView } from './ToolCallView'

describe('tool call view', () => {
  it('renders empty state', () => {
    render(<ToolCallView events={[]} />)

    expect(screen.getByText('暂无工具调用')).toBeInTheDocument()
  })

  it('renders tool output', () => {
    render(
      <ToolCallView
        events={[
          {
            id: 'evt_1',
            taskId: 'task_1',
            type: 'tool.output',
            payload: {
              toolCallId: 'tool_1',
              stream: 'stdout',
              chunk: 'test passed',
            },
            createdAt: '2026-06-22T00:00:00.000Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('tool.output')).toBeInTheDocument()
    expect(screen.getByText(/test passed/)).toBeInTheDocument()
  })
})
