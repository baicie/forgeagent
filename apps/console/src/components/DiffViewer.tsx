export interface DiffViewerProps {
  diff: string
  lastEventId?: string
  worktreePath?: string
}

export function DiffViewer(props: DiffViewerProps) {
  if (!props.diff.trim()) {
    return (
      <div className="diff-viewer">
        <p className="muted">暂无 diff</p>
        <p className="muted">
          Agent 的修改会先写入隔离 worktree。原仓库只有在 Apply 后才会变化。
        </p>
      </div>
    )
  }

  return (
    <div className="diff-viewer">
      <div className="notice">
        当前 diff 来自 task worktree，尚未代表原仓库已修改。
        {props.worktreePath ? (
          <>
            <br />
            Worktree: <code>{props.worktreePath}</code>
          </>
        ) : null}
      </div>

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
