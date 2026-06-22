import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  MAX_LIST_ENTRIES,
  assertSafeReadablePath,
  normalizeToolPath,
} from './common'
import type { RunnerToolContext } from './types'

export const ListFilesArgsSchema = z.object({
  path: z.string().default('.'),
  recursive: z.boolean().default(false),
  maxEntries: z.number().int().positive().max(MAX_LIST_ENTRIES).default(200),
})

export type ListFilesArgs = z.infer<typeof ListFilesArgsSchema>

export interface ListFilesEntry {
  path: string
  type: 'file' | 'directory'
  size: number
}

export interface ListFilesResult {
  entries: ListFilesEntry[]
  truncated: boolean
}

export async function listFilesTool(
  context: RunnerToolContext,
  rawArgs: unknown,
): Promise<ListFilesResult> {
  const args = ListFilesArgsSchema.parse(rawArgs)
  const root = assertSafeReadablePath(context, args.path)
  const entries: ListFilesEntry[] = []

  async function visit(currentPath: string): Promise<void> {
    if (entries.length >= args.maxEntries) {
      return
    }

    const children = await readdir(currentPath, {
      withFileTypes: true,
    })

    children.sort((a, b) => a.name.localeCompare(b.name))

    for (const child of children) {
      if (entries.length >= args.maxEntries) {
        return
      }

      const absolutePath = path.join(currentPath, child.name)
      const relativePath = path.relative(context.worktreePath, absolutePath)

      try {
        assertSafeReadablePath(context, relativePath)
      } catch {
        continue
      }

      const childStat = await stat(absolutePath)
      const type = child.isDirectory() ? 'directory' : 'file'

      entries.push({
        path: normalizeToolPath(relativePath),
        type,
        size: childStat.size,
      })

      if (args.recursive && child.isDirectory()) {
        await visit(absolutePath)
      }
    }
  }

  await visit(root.absolutePath)

  return {
    entries,
    truncated: entries.length >= args.maxEntries,
  }
}
