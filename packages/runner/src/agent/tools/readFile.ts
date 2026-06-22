import { readFile, stat } from 'node:fs/promises'
import { z } from 'zod'
import { createForgeAgentError } from '@forgeagent/core'
import {
  MAX_READ_FILE_BYTES,
  assertSafeReadablePath,
  normalizeToolPath,
} from './common'
import type { RunnerToolContext } from './types'

export const ReadFileArgsSchema = z.object({
  path: z.string().min(1),
})

export type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>

export interface ReadFileResult {
  path: string
  content: string
  bytes: number
}

export async function readFileTool(
  context: RunnerToolContext,
  rawArgs: unknown,
): Promise<ReadFileResult> {
  const args = ReadFileArgsSchema.parse(rawArgs)
  const target = assertSafeReadablePath(context, args.path)
  const fileStat = await stat(target.absolutePath)

  if (!fileStat.isFile()) {
    throw createForgeAgentError(
      'TOOL_EXECUTION_FAILED',
      `Path is not a file: ${args.path}`,
      {
        path: args.path,
      },
    )
  }

  if (fileStat.size > MAX_READ_FILE_BYTES) {
    throw createForgeAgentError(
      'TOOL_EXECUTION_FAILED',
      `File is too large to read: ${args.path}`,
      {
        path: args.path,
        size: fileStat.size,
        maxBytes: MAX_READ_FILE_BYTES,
      },
    )
  }

  const content = await readFile(target.absolutePath, 'utf-8')

  return {
    path: normalizeToolPath(target.relativePath),
    content,
    bytes: Buffer.byteLength(content, 'utf-8'),
  }
}
