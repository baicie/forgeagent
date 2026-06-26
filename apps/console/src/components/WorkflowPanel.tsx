import type { WorkflowRun } from '../types'

function getStepIcon(status: string): string {
  if (status === 'completed') return '✓'
  if (status === 'running') return '●'
  if (status === 'waiting_approval') return '⏳'
  if (status === 'failed') return '✕'
  if (status === 'skipped') return '↷'
  return '○'
}

export function WorkflowPanel(props: {
  workflow?: {
    run: WorkflowRun
    currentStep?: {
      id: string
      name?: string
      type: string
      tools: string[]
      actions: string[]
    }
  }
  onRefresh: () => void
}) {
  if (!props.workflow) {
    return (
      <div className="workflow-panel">
        <p className="muted">暂无 workflow 状态。</p>
        <button type="button" onClick={props.onRefresh}>
          刷新
        </button>
      </div>
    )
  }

  const { run, currentStep } = props.workflow

  return (
    <div className="workflow-panel">
      <div className="event-meta">
        <strong>Workflow</strong>
        <span>{run.workflowId}</span>
        <span>{run.status}</span>
        {currentStep ? <span>当前：{currentStep.id}</span> : null}
        <button type="button" onClick={props.onRefresh}>
          刷新
        </button>
      </div>

      <ol className="workflow-steps">
        {run.steps.map(step => (
          <li
            key={step.stepId}
            className={
              step.stepId === run.currentStepId ? 'current' : undefined
            }
          >
            <span>{getStepIcon(step.status)}</span>
            <code>{step.stepId}</code>
            <span>{step.type}</span>
            <span>{step.status}</span>
            {step.error ? <span className="error">{step.error}</span> : null}
          </li>
        ))}
      </ol>

      {currentStep?.tools.length ? (
        <details>
          <summary>当前 step 允许工具</summary>
          <ul>
            {currentStep.tools.map(tool => (
              <li key={tool}>
                <code>{tool}</code>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
