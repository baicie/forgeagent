import { z } from 'zod'

export const ReviewStatusSchema = z.enum(['passed', 'warning', 'failed'])
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>

export const ReviewRecommendationSchema = z.enum([
  'apply',
  'commit',
  'needs_fix',
  'reject',
])
export type ReviewRecommendation = z.infer<typeof ReviewRecommendationSchema>

export const ReviewFindingSeveritySchema = z.enum(['info', 'warning', 'error'])
export type ReviewFindingSeverity = z.infer<typeof ReviewFindingSeveritySchema>

export const ReviewFindingCategorySchema = z.enum([
  'goal',
  'unrelated_change',
  'project_rule',
  'test',
  'security',
  'compatibility',
  'maintainability',
])
export type ReviewFindingCategory = z.infer<typeof ReviewFindingCategorySchema>

export const ReviewFindingSchema = z.object({
  severity: ReviewFindingSeveritySchema,
  category: ReviewFindingCategorySchema,
  message: z.string().min(1),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  suggestion: z.string().optional(),
})
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>

export const ReviewResultSchema = z.object({
  taskId: z.string().min(1),
  status: ReviewStatusSchema,
  recommendation: ReviewRecommendationSchema,
  goalCompleted: z.boolean(),
  hasUnrelatedChanges: z.boolean(),
  violatesProjectRules: z.boolean(),
  missingTests: z.boolean(),
  hasSecurityRisk: z.boolean(),
  hasCompatibilityRisk: z.boolean(),
  summary: z.string().min(1),
  findings: z.array(ReviewFindingSchema).default([]),
  reviewedAt: z.string().datetime(),
})
export type ReviewResult = z.infer<typeof ReviewResultSchema>

export const ReviewEventPayloadSchema = z.object({
  status: ReviewStatusSchema.optional(),
  recommendation: ReviewRecommendationSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  summary: z.string().optional(),
  findingCount: z.number().int().nonnegative().optional(),
})
export type ReviewEventPayload = z.infer<typeof ReviewEventPayloadSchema>

export function deriveReviewStatus(input: {
  goalCompleted: boolean
  hasUnrelatedChanges: boolean
  violatesProjectRules: boolean
  missingTests: boolean
  hasSecurityRisk: boolean
  hasCompatibilityRisk: boolean
}): ReviewStatus {
  if (
    !input.goalCompleted ||
    input.violatesProjectRules ||
    input.hasSecurityRisk
  ) {
    return 'failed'
  }

  if (
    input.hasUnrelatedChanges ||
    input.missingTests ||
    input.hasCompatibilityRisk
  ) {
    return 'warning'
  }

  return 'passed'
}

export function deriveReviewRecommendation(
  status: ReviewStatus,
): ReviewRecommendation {
  if (status === 'passed') return 'apply'
  if (status === 'warning') return 'needs_fix'
  return 'reject'
}
