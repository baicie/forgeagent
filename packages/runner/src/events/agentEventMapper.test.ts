import type { AgentEvent } from '@forgeagent/core'
import { mapAgentEventToTaskEvents } from './agentEventMapper'

describe('mapAgentEventToTaskEvents', () => {
  it('maps tool call events', () => {
    const event: AgentEvent = {
      type: 'tool.call.started',
      sessionId: 'session_1',
      toolName: 'read_file',
      args: {
        path: 'README.md',
      },
    }

    expect(mapAgentEventToTaskEvents('task_1', event)).toEqual([
      {
        taskId: 'task_1',
        type: 'tool.started',
        payload: {
          toolName: 'read_file',
          args: {
            path: 'README.md',
          },
        },
      },
    ])
  })

  it('maps approval events', () => {
    const event: AgentEvent = {
      type: 'approval.requested',
      sessionId: 'session_1',
      toolName: 'run_command',
      args: {
        command: 'pnpm test',
      },
    }

    expect(mapAgentEventToTaskEvents('task_1', event)).toEqual([
      {
        taskId: 'task_1',
        type: 'approval.required',
        payload: {
          toolName: 'run_command',
          args: {
            command: 'pnpm test',
          },
        },
      },
    ])
  })

  it('maps run finished events', () => {
    const event: AgentEvent = {
      type: 'run.finished',
      sessionId: 'session_1',
      output: 'done',
    }

    expect(mapAgentEventToTaskEvents('task_1', event)).toEqual([
      {
        taskId: 'task_1',
        type: 'task.completed',
        payload: {
          output: 'done',
        },
      },
    ])
  })

  it('maps run failed events', () => {
    const event: AgentEvent = {
      type: 'run.failed',
      sessionId: 'session_1',
      error: 'boom',
    }

    expect(mapAgentEventToTaskEvents('task_1', event)).toEqual([
      {
        taskId: 'task_1',
        type: 'task.failed',
        payload: {
          error: 'boom',
        },
      },
    ])
  })
})
