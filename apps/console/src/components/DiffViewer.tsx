export interface DiffViewerProps {
  diff: string
  lastEventId?: string
}

export function DiffViewer(props: DiffViewerProps) {
  if (!props.diff.trim()) {
    return <p className="muted">暂无 diff</p>
  }

  return (
    <div className="diff-viewer">
      {props.lastEventId ? (
        <p className="muted">
          last event:
          {props.lastEventId}
        </p>
      ) : null}
      <pre>{props.diff}</pre>
    </div>
  )
}
