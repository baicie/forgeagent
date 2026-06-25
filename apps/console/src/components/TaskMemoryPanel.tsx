import type { TaskMemorySnapshot } from '../types'

export interface TaskMemoryPanelProps {
  memory?: TaskMemorySnapshot
  onRefresh: () => void
}

export function TaskMemoryPanel(props: TaskMemoryPanelProps) {
  if (!props.memory) {
    return (
      <div>
        <button type="button" onClick={props.onRefresh}>
          加载任务记忆
        </button>
      </div>
    )
  }

  return (
    <div className="task-memory">
      <div className="memory-header">
        <div>
          <p className="muted">Run Dir</p>
          <code>{props.memory.runDir}</code>
        </div>
        <button type="button" onClick={props.onRefresh}>
          刷新
        </button>
      </div>

      <div className="memory-grid">
        {props.memory.files.map(file => (
          <details key={file.file} open={file.file === 'progress.md'}>
            <summary>
              <strong>{file.file}</strong>{' '}
              <span className="muted">
                {file.bytes} bytes
                {file.updatedAt ? ` · ${file.updatedAt}` : ''}
              </span>
            </summary>
            <pre className="memory-content">{file.content}</pre>
          </details>
        ))}
      </div>
    </div>
  )
}
