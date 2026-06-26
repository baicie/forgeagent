import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReviewPanel, ReviewRiskBanner } from './ReviewPanel'
import type { ReviewResult } from '../types'

const passedReview: ReviewResult = {
  taskId: 'task_1',
  status: 'passed',
  recommendation: 'apply',
  goalCompleted: true,
  hasUnrelatedChanges: false,
  violatesProjectRules: false,
  missingTests: false,
  hasSecurityRisk: false,
  hasCompatibilityRisk: false,
  summary: '审查通过。',
  findings: [],
  reviewedAt: '2026-06-25T10:00:00.000Z',
}

const warningReview: ReviewResult = {
  taskId: 'task_1',
  status: 'warning',
  recommendation: 'needs_fix',
  goalCompleted: true,
  hasUnrelatedChanges: false,
  violatesProjectRules: false,
  missingTests: true,
  hasSecurityRisk: false,
  hasCompatibilityRisk: false,
  summary: '缺少测试。',
  findings: [
    {
      severity: 'warning',
      category: 'test',
      message: 'No test results found.',
      suggestion: 'Run tests before apply.',
    },
  ],
  reviewedAt: '2026-06-25T10:00:00.000Z',
}

describe('reviewRiskBanner', () => {
  it('shows suggestion when no review exists', () => {
    const { container } = render(<ReviewRiskBanner review={undefined} />)
    expect(container.textContent).toContain('尚未运行只读审查')
  })

  it('shows success when review passed', () => {
    const { container } = render(<ReviewRiskBanner review={passedReview} />)
    expect(container.textContent).toContain('审查通过')
    expect(container.textContent).toContain('apply')
  })

  it('shows warning when review has issues', () => {
    const { container } = render(<ReviewRiskBanner review={warningReview} />)
    expect(container.textContent).toContain('审查风险')
    expect(container.textContent).toContain('建议')
  })
})

describe('reviewPanel', () => {
  it('shows hint when task is not completed', () => {
    const { container } = render(<ReviewPanel taskStatus="running" />)
    expect(container.textContent).toContain('任务完成后可运行只读审查')
  })

  it('shows run button when task is completed and no review exists', () => {
    const { container } = render(
      <ReviewPanel taskStatus="completed" busy={false} />,
    )
    expect(container.textContent).toContain('运行只读审查')
  })

  it('disables run button when busy', () => {
    const { container } = render(
      <ReviewPanel taskStatus="completed" busy={true} />,
    )
    expect(container.textContent).toContain('审查中')
  })

  it('displays passed review with all checks', () => {
    const { container } = render(<ReviewPanel review={passedReview} />)
    expect(container.textContent).toContain('只读审查')
    expect(container.textContent).toContain('通过')
    expect(container.textContent).toContain('建议 Apply')
    expect(container.textContent).toContain('目标完成')
    expect(container.textContent).toContain('无无关修改')
    expect(container.textContent).toContain('未违反规则')
  })

  it('displays warning review with findings', () => {
    const { container } = render(<ReviewPanel review={warningReview} />)
    expect(container.textContent).toContain('警告')
    expect(container.textContent).toContain('建议修复')
    expect(container.textContent).toContain('发现问题')
    expect(container.textContent).toContain('No test results found')
    expect(container.textContent).toContain('Run tests before apply')
  })
})
