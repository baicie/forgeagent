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

  it('renders structured core tool metadata', () => {
    render(
      <ToolCallView
        events={[
          {
            id: 'evt_1',
            taskId: 'task_1',
            type: 'tool.started',
            payload: {
              toolCallId: 'tool_1',
              toolName: 'read_file',
              displayName: 'read',
              source: 'core',
              type: 'read',
              permission: 'allowed',
              requiresApproval: false,
              approvalStatus: 'not_required',
              args: {
                path: 'foo.ts',
              },
            },
            createdAt: '2026-06-25T00:00:00.000Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('[core]')).toBeInTheDocument()
    expect(screen.getByText('read')).toBeInTheDocument()
    expect(screen.getByText('allowed')).toBeInTheDocument()
    expect(screen.getByText('not_required')).toBeInTheDocument()
    expect(screen.getByText('foo.ts')).toBeInTheDocument()
  })

  it('renders pending approval for run command', () => {
    render(
      <ToolCallView
        events={[
          {
            id: 'evt_1',
            taskId: 'task_1',
            type: 'tool.started',
            payload: {
              toolCallId: 'tool_1',
              toolName: 'run_command',
              displayName: 'run',
              source: 'core',
              type: 'execute',
              permission: 'requires_approval',
              requiresApproval: true,
              approvalStatus: 'pending',
              command: 'pnpm test',
            },
            createdAt: '2026-06-25T00:00:00.000Z',
          },
        ]}
      />,
    )

    expect(screen.getByText('[core]')).toBeInTheDocument()
    expect(screen.getByText('run')).toBeInTheDocument()
    expect(screen.getByText('requires approval')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText('pnpm test')).toBeInTheDocument()
  })
})
