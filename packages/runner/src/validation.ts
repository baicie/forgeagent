import type { ZodSchema } from 'zod'

export class BadRequestError extends Error {
  readonly code = 'BAD_REQUEST'
  readonly details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'BadRequestError'
    this.details = details
  }
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body)

  if (!result.success) {
    throw new BadRequestError('Invalid request body', result.error.flatten())
  }

  return result.data
}
