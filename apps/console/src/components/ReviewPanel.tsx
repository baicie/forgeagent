import type { ReviewResult } from '../types'

export function ReviewRiskBanner(props: { review?: ReviewResult }) {
  if (!props.review) {
    return (
      <div className="notice notice-warning">
        尚未运行只读审查。Apply / Commit 前建议先审查。
      </div>
    )
  }

  if (props.review.status === 'passed') {
    return (
      <div className="notice notice-success">
        审查通过：{props.review.recommendation}
      </div>
    )
  }

  return (
    <div className="notice notice-warning">
      审查风险：{props.review.status}，建议 {props.review.recommendation}
      {props.review.findings.length > 0 && (
        <span> — {props.review.findings.length} 个问题见下方审查报告</span>
      )}
    </div>
  )
}

export function ReviewPanel(props: {
  review?: ReviewResult
  taskStatus?: string
  busy?: boolean
  onRunReview?: () => void
  onRefresh?: () => void
}) {
  const canReview = props.taskStatus === 'completed'

  if (!props.review && !canReview) {
    return (
      <div className="review-panel review-panel--empty">
        <span className="review-panel__hint">任务完成后可运行只读审查</span>
      </div>
    )
  }

  if (!props.review) {
    return (
      <div className="review-panel review-panel--empty">
        <button
          type="button"
          className="btn btn-primary"
          disabled={props.busy}
          onClick={props.onRunReview}
        >
          {props.busy ? '审查中...' : '运行只读审查'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={props.onRefresh}
        >
          刷新
        </button>
      </div>
    )
  }

  const statusColor =
    props.review.status === 'passed'
      ? 'var(--color-success)'
      : props.review.status === 'warning'
        ? 'var(--color-warning)'
        : 'var(--color-error)'

  const recommendationLabel =
    props.review.recommendation === 'apply'
      ? '建议 Apply'
      : props.review.recommendation === 'commit'
        ? '建议 Commit'
        : props.review.recommendation === 'needs_fix'
          ? '建议修复'
          : '建议拒绝'

  return (
    <div className="review-panel">
      <div className="review-panel__header">
        <div className="review-panel__title">
          <strong>只读审查</strong>
        </div>
        <div className="review-panel__meta">
          <span className="review-panel__status" style={{ color: statusColor }}>
            {props.review.status === 'passed'
              ? '通过'
              : props.review.status === 'warning'
                ? '警告'
                : '失败'}
          </span>
          <span className="review-panel__recommendation">
            {recommendationLabel}
          </span>
          <span className="review-panel__time">
            {new Date(props.review.reviewedAt).toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          className="review-panel__refresh"
          onClick={props.onRefresh}
        >
          刷新
        </button>
      </div>

      <div className="review-panel__summary">
        <div
          className={`review-panel__badge review-panel__badge--${props.review.status}`}
        >
          {props.review.status === 'passed'
            ? '✓ 通过'
            : props.review.status === 'warning'
              ? '⚠ 警告'
              : '✗ 失败'}
        </div>
        <p className="review-panel__summary-text">{props.review.summary}</p>
      </div>

      <div className="review-panel__checks">
        <div className="review-panel__check">
          <span
            className={`review-panel__check-icon ${props.review.goalCompleted ? 'ok' : 'fail'}`}
          >
            {props.review.goalCompleted ? '✓' : '✗'}
          </span>
          <span>目标完成</span>
        </div>
        <div className="review-panel__check">
          <span
            className={`review-panel__check-icon ${!props.review.hasUnrelatedChanges ? 'ok' : 'fail'}`}
          >
            {props.review.hasUnrelatedChanges ? '✗' : '✓'}
          </span>
          <span>无无关修改</span>
        </div>
        <div className="review-panel__check">
          <span
            className={`review-panel__check-icon ${!props.review.violatesProjectRules ? 'ok' : 'fail'}`}
          >
            {props.review.violatesProjectRules ? '✗' : '✓'}
          </span>
          <span>未违反规则</span>
        </div>
        <div className="review-panel__check">
          <span
            className={`review-panel__check-icon ${!props.review.missingTests ? 'ok' : 'warn'}`}
          >
            {props.review.missingTests ? '⚠' : '✓'}
          </span>
          <span>测试验证</span>
        </div>
        <div className="review-panel__check">
          <span
            className={`review-panel__check-icon ${!props.review.hasSecurityRisk ? 'ok' : 'fail'}`}
          >
            {props.review.hasSecurityRisk ? '✗' : '✓'}
          </span>
          <span>安全风险</span>
        </div>
        <div className="review-panel__check">
          <span
            className={`review-panel__check-icon ${!props.review.hasCompatibilityRisk ? 'ok' : 'warn'}`}
          >
            {props.review.hasCompatibilityRisk ? '⚠' : '✓'}
          </span>
          <span>兼容风险</span>
        </div>
      </div>

      {props.review.findings.length > 0 && (
        <div className="review-panel__findings">
          <h4>发现问题</h4>
          <ul>
            {props.review.findings.map((finding, i) => (
              <li
                key={i}
                className={`review-panel__finding review-panel__finding--${finding.severity}`}
              >
                <span
                  className={`review-panel__finding-severity review-panel__finding-severity--${finding.severity}`}
                >
                  {finding.severity === 'error'
                    ? '✗'
                    : finding.severity === 'warning'
                      ? '⚠'
                      : 'ℹ'}
                </span>
                <div className="review-panel__finding-content">
                  <span className="review-panel__finding-message">
                    [{finding.category}] {finding.message}
                  </span>
                  {finding.file && (
                    <span className="review-panel__finding-location">
                      {finding.file}
                      {finding.line ? `:${finding.line}` : ''}
                    </span>
                  )}
                  {finding.suggestion && (
                    <span className="review-panel__finding-suggestion">
                      建议：{finding.suggestion}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
