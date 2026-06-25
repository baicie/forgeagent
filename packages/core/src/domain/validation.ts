import { z } from 'zod'

export const DEFAULT_MAX_FIX_ATTEMPTS = 3

export const ValidationCommandSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().default('.'),
  reason: z.string().default('Validate task changes'),
})

export type ValidationCommand = z.infer<typeof ValidationCommandSchema>

const StringToCommandSchema = z.string().transform(s => ({
  command: s,
  cwd: '.',
  reason: 'Validate task changes',
}))

export const ValidationConfigSchema = z.object({
  commands: z
    .array(z.union([StringToCommandSchema, ValidationCommandSchema]))
    .default([]),
  maxFixAttempts: z
    .number()
    .int()
    .nonnegative()
    .default(DEFAULT_MAX_FIX_ATTEMPTS),
})

export type ValidationConfig = z.infer<typeof ValidationConfigSchema>

// Input schema for API/RPC calls where command objects may have optional fields.
export const TaskValidationInputSchema = z.object({
  commands: z
    .array(
      z.union([
        z.string(),
        z.object({
          command: z.string().min(1),
          cwd: z.string().optional(),
          reason: z.string().optional(),
        }),
      ]),
    )
    .optional(),
  maxFixAttempts: z.number().int().nonnegative().optional(),
})

export type TaskValidationInput = z.infer<typeof TaskValidationInputSchema>

export const ValidationCommandStatusSchema = z.enum([
  'pending',
  'waiting_approval',
  'running',
  'passed',
  'failed',
  'rejected',
  'skipped',
])

export type ValidationCommandStatus = z.infer<
  typeof ValidationCommandStatusSchema
>

export const ValidationRunStatusSchema = z.enum([
  'pending',
  'waiting_approval',
  'running',
  'passed',
  'failed',
  'rejected',
  'skipped',
])

export type ValidationRunStatus = z.infer<typeof ValidationRunStatusSchema>

export const ValidationResultSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().default('.'),
  status: ValidationCommandStatusSchema,
  ok: z.boolean().optional(),
  approvalId: z.string().optional(),
  exitCode: z.number().int().nullable().optional(),
  timedOut: z.boolean().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
})

export type ValidationResult = z.infer<typeof ValidationResultSchema>

export const ValidationPlanSchema = z.object({
  taskId: z.string().min(1),
  commands: z.array(ValidationCommandSchema),
  maxFixAttempts: z.number().int().nonnegative(),
  fixAttempt: z.number().int().nonnegative().default(0),
  status: ValidationRunStatusSchema.default('pending'),
  results: z.array(ValidationResultSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ValidationPlan = z.infer<typeof ValidationPlanSchema>

export const ValidationSummarySchema = z.object({
  status: ValidationRunStatusSchema,
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  fixAttempt: z.number().int().nonnegative(),
  maxFixAttempts: z.number().int().nonnegative(),
  failureSummary: z.string().optional(),
})

export type ValidationSummary = z.infer<typeof ValidationSummarySchema>

export const ValidationEventPayloadSchema = z.object({
  status: ValidationRunStatusSchema,
  command: z.string().optional(),
  approvalId: z.string().optional(),
  fixAttempt: z.number().int().nonnegative().optional(),
  maxFixAttempts: z.number().int().nonnegative().optional(),
  summary: ValidationSummarySchema.optional(),
})

export type ValidationEventPayload = z.infer<
  typeof ValidationEventPayloadSchema
>

export function normalizeValidationCommands(
  commands: Array<string | ValidationCommand>,
): ValidationCommand[] {
  return commands.map(command =>
    typeof command === 'string'
      ? {
          command,
          cwd: '.',
          reason: 'Validate task changes',
        }
      : ValidationCommandSchema.parse(command),
  )
}
