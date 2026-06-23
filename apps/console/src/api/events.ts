import type { TaskEvent, TaskEventType } from '../types'

export const TASK_EVENT_TYPES: TaskEventType[] = [
  'task.status',
  'agent.message',
  'tool.started',
  'tool.output',
  'tool.finished',
  'approval.required',
  'approval.resolved',
  'diff.updated',
  'task.completed',
  'task.failed',
]

export interface SubscribeTaskEventsInput {
  baseUrl?: string
  taskId: string
  afterId?: string
  onEvent: (event: TaskEvent) => void
  onError?: (error: Event) => void
}

export function createTaskEventsUrl(input: {
  baseUrl?: string
  taskId: string
  afterId?: string
  once?: boolean
}): string {
  const params = new URLSearchParams()

  if (input.afterId) {
    params.set('afterId', input.afterId)
  }

  if (input.once) {
    params.set('once', '1')
  }

  const query = params.toString()
  const path = `/api/tasks/${encodeURIComponent(input.taskId)}/events`

  return `${input.baseUrl || ''}${path}${query ? `?${query}` : ''}`
}

export function parseTaskEventMessage(message: MessageEvent): TaskEvent {
  return JSON.parse(message.data) as TaskEvent
}

export function mergeTaskEvents(
  current: TaskEvent[],
  incoming: TaskEvent[],
): TaskEvent[] {
  const byId = new Map<string, TaskEvent>()

  for (const event of current) {
    byId.set(event.id, event)
  }

  for (const event of incoming) {
    byId.set(event.id, event)
  }

  return [...byId.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
}

export function subscribeTaskEvents(
  input: SubscribeTaskEventsInput,
): () => void {
  const source = new EventSource(
    createTaskEventsUrl({
      baseUrl: input.baseUrl,
      taskId: input.taskId,
      afterId: input.afterId,
    }),
  )

  const listeners = TASK_EVENT_TYPES.map(type => {
    const listener = (event: Event) => {
      input.onEvent(parseTaskEventMessage(event as MessageEvent))
    }

    source.addEventListener(type, listener)

    return {
      type,
      listener,
    }
  })

  source.onerror = error => {
    input.onError?.(error)
  }

  return () => {
    for (const { type, listener } of listeners) {
      source.removeEventListener(type, listener)
    }

    source.close()
  }
}
