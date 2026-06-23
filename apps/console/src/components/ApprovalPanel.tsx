import type { ApprovalPayload, TaskEvent } from '../types'

function asApprovalPayload(value: unknown): ApprovalPayload {
  return typeof value === 'object' && value !== null
    ? (value as ApprovalPayload)
    : {}
}

export interface PendingApproval {
  approvalId: string
  command: string
  reason?: string
  cwd?: string
  risk?: string
  status: 'pending' | 'approved' | 'rejected'
}

export function collectApprovals(events: TaskEvent[]): PendingApproval[] {
  const approvals = new Map<string, PendingApproval>()

  for (const event of events) {
    if (event.type === 'approval.required') {
      const payload = asApprovalPayload(event.payload)

      if (!payload.approvalId) {
        continue
      }

      approvals.set(payload.approvalId, {
        approvalId: payload.approvalId,
        command: payload.command || '',
        reason: payload.reason,
        cwd: payload.cwd,
        risk: payload.risk,
        status: 'pending',
      })
    }

    if (event.type === 'approval.resolved') {
      const payload = asApprovalPayload(event.payload)

      if (!payload.approvalId) {
        continue
      }

      const current = approvals.get(payload.approvalId)

      if (current) {
        approvals.set(payload.approvalId, {
          ...current,
          status: payload.status || current.status,
        })
      }
    }
  }

  return [...approvals.values()].reverse()
}

export interface ApprovalPanelProps {
  events: TaskEvent[]
  onApprove: (approvalId: string) => Promise<void> | void
  onReject: (approvalId: string, reason?: string) => Promise<void> | void
}

export function ApprovalPanel(props: ApprovalPanelProps) {
  const approvals = collectApprovals(props.events)

  if (approvals.length === 0) {
    return <p className="muted">暂无审批请求</p>
  }

  return (
    <div className="approval-list">
      {approvals.map(approval => (
        <article
          className={`approval-card risk-${approval.risk || 'low'}`}
          key={approval.approvalId}
        >
          <div className="approval-header">
            <strong>{approval.status}</strong>
            <span>{approval.risk || 'low'}</span>
          </div>
          <pre>{approval.command}</pre>
          {approval.cwd ? (
            <p className="muted">
              cwd:
              {approval.cwd}
            </p>
          ) : null}
          {approval.reason ? <p>{approval.reason}</p> : null}

          {approval.status === 'pending' ? (
            <div className="approval-actions">
              <button
                type="button"
                onClick={() => props.onApprove(approval.approvalId)}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() =>
                  props.onReject(approval.approvalId, 'Rejected from console')
                }
              >
                Reject
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}
