#!/usr/bin/env node
import { config as loadEnv } from 'dotenv'
import pc from 'picocolors'
import { createCliProgram } from './cli'

loadEnv()

function readHint(details: unknown): string | undefined {
  if (typeof details !== 'object' || details === null) {
    return undefined
  }

  const hint = (details as { hint?: unknown }).hint

  return typeof hint === 'string' ? hint : undefined
}

createCliProgram()
  .parseAsync()
  .catch(error => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined

    const details =
      typeof error === 'object' && error !== null && 'details' in error
        ? (error as { details?: unknown }).details
        : undefined

    if (code) {
      console.error(pc.red(`[${code}] ${error.message}`))
    } else {
      console.error(
        pc.red(error instanceof Error ? error.message : String(error)),
      )
    }

    const hint = readHint(details)

    if (hint) {
      console.error('')
      console.error(pc.yellow('Hint:'))
      console.error(pc.dim(hint))
    }

    if (details !== undefined) {
      console.error('')
      console.error(pc.dim(JSON.stringify(details, null, 2)))
    }

    process.exitCode = 1
  })
