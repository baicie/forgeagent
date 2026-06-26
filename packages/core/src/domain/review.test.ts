import {
  ReviewResultSchema,
  deriveReviewRecommendation,
  deriveReviewStatus,
} from './review'

describe('review domain', () => {
  it('derives passed status', () => {
    expect(
      deriveReviewStatus({
        goalCompleted: true,
        hasUnrelatedChanges: false,
        violatesProjectRules: false,
        missingTests: false,
        hasSecurityRisk: false,
        hasCompatibilityRisk: false,
      }),
    ).toBe('passed')
  })

  it('derives warning status', () => {
    expect(
      deriveReviewStatus({
        goalCompleted: true,
        hasUnrelatedChanges: true,
        violatesProjectRules: false,
        missingTests: false,
        hasSecurityRisk: false,
        hasCompatibilityRisk: false,
      }),
    ).toBe('warning')
  })

  it('derives failed status', () => {
    expect(
      deriveReviewStatus({
        goalCompleted: false,
        hasUnrelatedChanges: false,
        violatesProjectRules: false,
        missingTests: false,
        hasSecurityRisk: false,
        hasCompatibilityRisk: false,
      }),
    ).toBe('failed')
  })

  it('derives recommendation', () => {
    expect(deriveReviewRecommendation('passed')).toBe('apply')
    expect(deriveReviewRecommendation('warning')).toBe('needs_fix')
    expect(deriveReviewRecommendation('failed')).toBe('reject')
  })

  it('parses review result', () => {
    const result = ReviewResultSchema.parse({
      taskId: 'task_1',
      status: 'passed',
      recommendation: 'apply',
      goalCompleted: true,
      hasUnrelatedChanges: false,
      violatesProjectRules: false,
      missingTests: false,
      hasSecurityRisk: false,
      hasCompatibilityRisk: false,
      summary: 'Looks good.',
      findings: [],
      reviewedAt: '2026-06-25T00:00:00.000Z',
    })

    expect(result.status).toBe('passed')
  })

  it('parses review result with findings', () => {
    const result = ReviewResultSchema.parse({
      taskId: 'task_1',
      status: 'warning',
      recommendation: 'needs_fix',
      goalCompleted: true,
      hasUnrelatedChanges: false,
      violatesProjectRules: false,
      missingTests: true,
      hasSecurityRisk: false,
      hasCompatibilityRisk: false,
      summary: 'Missing tests.',
      findings: [
        {
          severity: 'warning',
          category: 'test',
          message: 'No test results found.',
          suggestion: 'Run pnpm test before apply.',
        },
      ],
      reviewedAt: '2026-06-25T00:00:00.000Z',
    })

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].severity).toBe('warning')
    expect(result.findings[0].category).toBe('test')
  })
})
