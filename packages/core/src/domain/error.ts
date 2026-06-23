import { z } from 'zod'

export const ForgeAgentErrorCodeSchema = z.enum([
  'WORKSPACE_NOT_FOUND',
  'INVALID_GIT_REPO',
  'PATH_ESCAPE_DETECTED',
  'SENSITIVE_FILE_BLOCKED',
  'IGNORED_PATH_BLOCKED',
  'TASK_NOT_FOUND',
  'TASK_NOT_RUNNING',
  'INVALID_TASK_STATUS_TRANSITION',
  'APPROVAL_NOT_FOUND',
  'APPROVAL_ALREADY_RESOLVED',
  'COMMAND_REJECTED',
  'COMMAND_TIMEOUT',
  'COMMAND_DANGEROUS',
  'MODEL_REQUEST_FAILED',
  'MODEL_RESPONSE_INVALID',
  'TOOL_EXECUTION_FAILED',
  'RUNNER_REQUEST_FAILED',
  'RUNNER_RESPONSE_INVALID',
  'DIFF_EMPTY',
  'PATCH_APPLY_FAILED',
  'RUNNER_NOT_FOUND',
  'UNKNOWN_ERROR',
])

export type ForgeAgentErrorCode = z.infer<typeof ForgeAgentErrorCodeSchema>

export const ForgeAgentErrorPayloadSchema = z.object({
  code: ForgeAgentErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
})

export type ForgeAgentErrorPayload = z.infer<
  typeof ForgeAgentErrorPayloadSchema
>

export class ForgeAgentError extends Error {
  readonly code: ForgeAgentErrorCode
  readonly details?: unknown

  constructor(payload: ForgeAgentErrorPayload) {
    super(payload.message)
    this.name = 'ForgeAgentError'
    this.code = payload.code
    this.details = payload.details
  }

  toJSON(): ForgeAgentErrorPayload {
    const payload: ForgeAgentErrorPayload = {
      code: this.code,
      message: this.message,
    }

    if (this.details !== undefined) {
      payload.details = this.details
    }

    return payload
  }
}

export function createForgeAgentError(
  code: ForgeAgentErrorCode,
  message: string,
  details?: unknown,
) {
  return new ForgeAgentError({
    code,
    message,
    details,
  })
}
