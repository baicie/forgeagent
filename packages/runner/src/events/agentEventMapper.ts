import type { AgentEvent, CreateTaskEventInput } from '@forgeagent/core'

export function mapAgentEventToTaskEvents(
  taskId: string,
  event: AgentEvent,
): CreateTaskEventInput[] {
  switch (event.type) {
    case 'run.started':
      return [
        {
          taskId,
          type: 'agent.message',
          payload: {
            role: 'system',
            message: `Agent run started: ${event.input}`,
          },
        },
      ]

    case 'skill.selected':
      return [
        {
          taskId,
          type: 'agent.message',
          payload: {
            role: 'system',
            message: `Selected skills: ${event.skills.join(', ')}`,
          },
        },
      ]

    case 'agent.thinking':
      return [
        {
          taskId,
          type: 'agent.message',
          payload: {
            role: 'assistant',
            message: 'Thinking...',
          },
        },
      ]

    case 'tool.call.started':
      return [
        {
          taskId,
          type: 'tool.started',
          payload: {
            toolName: event.toolName,
            args: event.args,
          },
        },
      ]

    case 'tool.call.finished':
      return [
        {
          taskId,
          type: 'tool.finished',
          payload: {
            toolName: event.toolName,
            result: event.result,
          },
        },
      ]

    case 'approval.requested':
      return [
        {
          taskId,
          type: 'approval.required',
          payload: {
            toolName: event.toolName,
            args: event.args,
          },
        },
      ]

    case 'run.finished':
      return [
        {
          taskId,
          type: 'task.completed',
          payload: {
            output: event.output,
          },
        },
      ]

    case 'run.failed':
      return [
        {
          taskId,
          type: 'task.failed',
          payload: {
            error: event.error,
          },
        },
      ]
  }
}
