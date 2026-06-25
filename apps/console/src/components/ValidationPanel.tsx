import type { ValidationPlan, ValidationSummary } from '../types'

export function ValidationPanel(props: {
  plan?: ValidationPlan
  summary?: ValidationSummary
  onRefresh: () => void
}) {
  if (!props.plan || !props.summary) {
    return (
      <div className="validation-panel validation-panel--empty">
        <button type="button" onClick={props.onRefresh}>
          加载验证状态
        </button>
      </div>
    )
  }

  const statusColor =
    props.summary.status === 'passed'
      ? 'var(--color-success)'
      : props.summary.status === 'failed'
        ? 'var(--color-error)'
        : props.summary.status === 'waiting_approval'
          ? 'var(--color-warning)'
          : 'var(--color-text-muted)'

  return (
    <div className="validation-panel">
      <div className="validation-panel__header">
        <div className="validation-panel__title">
          <strong>自动验证反馈</strong>
        </div>
        <div className="validation-panel__meta">
          <span
            className="validation-panel__status"
            style={{ color: statusColor }}
          >
            {props.summary.status === 'waiting_approval'
              ? '等待审批'
              : props.summary.status === 'passed'
                ? '已通过'
                : props.summary.status === 'failed'
                  ? '已失败'
                  : props.summary.status === 'skipped'
                    ? '已跳过'
                    : '进行中'}
          </span>
          <span className="validation-panel__score">
            passed {props.summary.passed}/{props.summary.total}
          </span>
          <span className="validation-panel__attempts">
            fix attempts {props.summary.fixAttempt}/
            {props.summary.maxFixAttempts}
          </span>
        </div>
        <button
          type="button"
          className="validation-panel__refresh"
          onClick={props.onRefresh}
        >
          刷新
        </button>
      </div>

      {props.plan.commands.length === 0 ? (
        <div className="validation-panel__empty">
          <span>无验证命令配置</span>
        </div>
      ) : (
        <ul className="validation-panel__commands">
          {props.plan.commands.map(command => {
            const result = props.plan?.results.find(
              item => item.command === command.command,
            )
            const resultStatus = result?.status ?? 'pending'
            const statusIcon =
              resultStatus === 'passed'
                ? '✓'
                : resultStatus === 'failed'
                  ? '✗'
                  : resultStatus === 'waiting_approval'
                    ? '⏳'
                    : resultStatus === 'running'
                      ? '...'
                      : '○'
            const resultColor =
              resultStatus === 'passed'
                ? 'var(--color-success)'
                : resultStatus === 'failed'
                  ? 'var(--color-error)'
                  : resultStatus === 'waiting_approval'
                    ? 'var(--color-warning)'
                    : 'var(--color-text-muted)'

            return (
              <li key={command.command} className="validation-panel__command">
                <span
                  className="validation-panel__icon"
                  style={{ color: resultColor }}
                >
                  {statusIcon}
                </span>
                <code className="validation-panel__command-text">
                  {command.command}
                </code>
                <span
                  className="validation-panel__command-status"
                  style={{ color: resultColor }}
                >
                  {resultStatus === 'pending'
                    ? '待执行'
                    : resultStatus === 'passed'
                      ? '通过'
                      : resultStatus === 'failed'
                        ? '失败'
                        : resultStatus === 'waiting_approval'
                          ? '等待审批'
                          : resultStatus === 'rejected'
                            ? '已拒绝'
                            : resultStatus === 'running'
                              ? '执行中'
                              : resultStatus === 'skipped'
                                ? '已跳过'
                                : resultStatus}
                </span>
                {result?.exitCode !== undefined &&
                  result?.exitCode !== null && (
                    <span className="validation-panel__exit-code">
                      {' '}
                      exit={result.exitCode}
                    </span>
                  )}
              </li>
            )
          })}
        </ul>
      )}

      {props.summary.failureSummary ? (
        <details className="validation-panel__failure" open>
          <summary>失败摘要</summary>
          <pre className="validation-panel__failure-text">
            {props.summary.failureSummary}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
