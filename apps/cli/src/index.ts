#!/usr/bin/env node
import pc from 'picocolors'
import { createCliProgram } from './cli'

createCliProgram()
  .parseAsync()
  .catch(error => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined

    if (code) {
      console.error(pc.red(`[${code}] ${error.message}`))
    } else {
      console.error(
        pc.red(error instanceof Error ? error.message : String(error)),
      )
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'details' in error &&
      (error as { details?: unknown }).details !== undefined
    ) {
      console.error(
        pc.dim(
          JSON.stringify((error as { details: unknown }).details, null, 2),
        ),
      )
    }

    process.exitCode = 1
  })
