import type { ForgeAgentError } from '@forgeagent/core'
import type { FastifyInstance } from 'fastify'
import type { BadRequestError } from './validation'

export interface HttpErrorPayload {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function statusFromErrorCode(code: string): number {
  switch (code) {
    case 'BAD_REQUEST':
    case 'INVALID_GIT_REPO':
    case 'WORKSPACE_NOT_GIT_REPOSITORY':
    case 'WORKSPACE_EMPTY_GIT_REPOSITORY':
      return 400

    case 'WORKSPACE_NOT_FOUND':
    case 'TASK_NOT_FOUND':
    case 'APPROVAL_NOT_FOUND':
      return 404

    case 'INVALID_TASK_STATUS_TRANSITION':
    case 'APPROVAL_ALREADY_RESOLVED':
    case 'DIFF_EMPTY':
    case 'PATCH_APPLY_FAILED':
      return 409

    case 'SENSITIVE_FILE_BLOCKED':
    case 'IGNORED_PATH_BLOCKED':
    case 'PATH_ESCAPE_DETECTED':
      return 403

    default:
      return 500
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    const typedError = error as Error &
      Partial<ForgeAgentError> &
      Partial<BadRequestError>

    const code = typedError.code || 'UNKNOWN_ERROR'
    const status = statusFromErrorCode(code)

    const payload: HttpErrorPayload = {
      error: {
        code,
        message: typedError.message,
      },
    }

    if (typedError.details !== undefined) {
      payload.error.details = typedError.details
    }

    reply.status(status).send(payload)
  })
}
