import type { TaskEvent, ToolEventPayload } from '../types'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function asToolPayload(value: unknown): ToolEventPayload {
  return asRecord(value) as ToolEventPayload
}

export function createToolEventKey(event: TaskEvent, index: number): string {
  const payload = asRecord(event.payload)
  const toolCallId = payload.toolCallId

  if (typeof toolCallId === 'string') {
    return `${toolCallId}:${event.type}:${event.id}:${index}`
  }

  return `${event.id}:${index}`
}

function getToolLabel(payload: ToolEventPayload): string {
  return payload.displayName || payload.toolName || 'unknown'
}

function getToolTarget(payload: ToolEventPayload): string {
  if (typeof payload.command === 'string') {
    return payload.command
  }

  const args = asRecord(payload.args)

  if (typeof args.path === 'string') return args.path
  if (typeof args.query === 'string') return args.query
  if (typeof args.command === 'string') return args.command

  return ''
}

function getStatusIcon(event: TaskEvent, payload: ToolEventPayload): string {
  if (payload.approvalStatus === 'pending') return '⏳'
  if (payload.approvalStatus === 'denied' || payload.rejected) return '✗'
  if (payload.error) return '✗'
  if (event.type === 'tool.started') return '…'
  if (event.type === 'tool.finished') return '✓'

  return '•'
}

function getPermissionLabel(payload: ToolEventPayload): string {
  if (payload.permission === 'requires_approval') return 'requires approval'
  if (payload.permission === 'denied') return 'denied'

  return 'allowed'
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
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
        const payload = asToolPayload(event.payload)
        const source = payload.source || 'core'
        const permission = getPermissionLabel(payload)
        const statusIcon = getStatusIcon(event, payload)
        const target = getToolTarget(payload)

        return (
          <article
            className={`tool-event tool-source-${source}`}
            key={createToolEventKey(event, index)}
          >
            <div className="event-meta">
              <span className="tool-source">[{source}]</span>
              <strong>{getToolLabel(payload)}</strong>
              {target ? <code>{target}</code> : null}
              <span
                className={`tool-permission permission-${payload.permission || 'allowed'}`}
              >
                {permission}
              </span>
              <span
                className={`tool-approval approval-${payload.approvalStatus || 'not_required'}`}
              >
                {payload.approvalStatus || 'not_required'}
              </span>
              <span>{statusIcon}</span>
              <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
            </div>

            <details>
              <summary>{event.type}</summary>
              <pre>{formatJson(payload)}</pre>
            </details>
          </article>
        )
      })}
    </div>
  )
}
