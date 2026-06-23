import type { TaskEvent } from '../types'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

export function TaskTimeline(props: { events: TaskEvent[] }) {
  return (
    <div className="timeline">
      {props.events.map(event => {
        const payload = asRecord(event.payload)
        const message =
          typeof payload.message === 'string'
            ? payload.message
            : JSON.stringify(event.payload)

        return (
          <article className={`event event-${event.type}`} key={event.id}>
            <div className="event-meta">
              <span>{event.type}</span>
              <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
            </div>
            <pre>{message}</pre>
          </article>
        )
      })}

      {props.events.length === 0 ? (
        <p className="muted">暂无事件。启动 Agent 后这里会实时更新。</p>
      ) : null}
    </div>
  )
}
