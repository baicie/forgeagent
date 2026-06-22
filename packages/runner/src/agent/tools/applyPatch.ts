import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { createForgeAgentError } from '@forgeagent/core'
import { assertSafeWritablePath, normalizeToolPath } from './common'
import type { RunnerToolContext } from './types'

const WriteFileChangeSchema = z.object({
  type: z.literal('write_file'),
  path: z.string().min(1),
  content: z.string(),
})

const ReplaceTextChangeSchema = z.object({
  type: z.literal('replace_text'),
  path: z.string().min(1),
  search: z.string().min(1),
  replace: z.string(),
  replaceAll: z.boolean().default(false),
})

export const ApplyPatchArgsSchema = z.object({
  changes: z
    .array(
      z.discriminatedUnion('type', [
        WriteFileChangeSchema,
        ReplaceTextChangeSchema,
      ]),
    )
    .min(1)
    .max(20),
})

export type ApplyPatchArgs = z.infer<typeof ApplyPatchArgsSchema>

export interface ApplyPatchResult {
  changedFiles: string[]
}

export async function applyPatchTool(
  context: RunnerToolContext,
  rawArgs: unknown,
): Promise<ApplyPatchResult> {
  const args = ApplyPatchArgsSchema.parse(rawArgs)
  const changedFiles: string[] = []

  for (const change of args.changes) {
    const target = assertSafeWritablePath(context, change.path)

    if (change.type === 'write_file') {
      await mkdir(path.dirname(target.absolutePath), {
        recursive: true,
      })
      await writeFile(target.absolutePath, change.content, 'utf-8')
      changedFiles.push(normalizeToolPath(target.relativePath))
      continue
    }

    const oldContent = await readFile(target.absolutePath, 'utf-8')

    if (!oldContent.includes(change.search)) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Search text not found in file: ${change.path}`,
        {
          path: change.path,
        },
      )
    }

    const newContent = change.replaceAll
      ? oldContent.split(change.search).join(change.replace)
      : oldContent.replace(change.search, change.replace)

    await writeFile(target.absolutePath, newContent, 'utf-8')
    changedFiles.push(normalizeToolPath(target.relativePath))
  }

  return {
    changedFiles: [...new Set(changedFiles)],
  }
}
