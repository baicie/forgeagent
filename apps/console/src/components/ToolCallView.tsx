import type { TaskEvent } from '../types'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function eventKey(event: TaskEvent, index: number): string {
  const payload = asRecord(event.payload)
  const toolCallId = payload.toolCallId

  return typeof toolCallId === 'string' ? toolCallId : `${event.id}-${index}`
}

export function ToolCallView(props: { events: TaskEvent[] }) {
  const toolEvents = props.events.filter(event =>
    ['tool.started', 'tool.output', 'tool.finished'].includes(event.type),
  )

  if (toolEvents.length === 0) {
    return <p className="muted">暂无工具调用</p>
  }

  return (
    <div className="tool-list">
      {toolEvents.map((event, index) => {
        const payload = asRecord(event.payload)

        return (
          <article className="tool-event" key={eventKey(event, index)}>
            <div className="event-meta">
              <span>{event.type}</span>
              <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
            </div>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </article>
        )
      })}
    </div>
  )
}
