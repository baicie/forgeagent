import { render, screen } from '@testing-library/react'
import { createToolEventKey, ToolCallView } from './ToolCallView'

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

  it('creates unique keys for events with the same toolCallId', () => {
    const base = {
      taskId: 'task_1',
      payload: {
        toolCallId: 'tool_1',
      },
      createdAt: '2026-06-22T00:00:00.000Z',
    }

    expect([
      createToolEventKey(
        {
          ...base,
          id: 'evt_1',
          type: 'tool.started',
        },
        0,
      ),
      createToolEventKey(
        {
          ...base,
          id: 'evt_2',
          type: 'tool.output',
        },
        1,
      ),
      createToolEventKey(
        {
          ...base,
          id: 'evt_3',
          type: 'tool.finished',
        },
        2,
      ),
    ]).toEqual([
      'tool_1:tool.started:evt_1:0',
      'tool_1:tool.output:evt_2:1',
      'tool_1:tool.finished:evt_3:2',
    ])
  })
})
