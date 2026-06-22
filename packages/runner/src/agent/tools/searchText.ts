import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  MAX_READ_FILE_BYTES,
  MAX_SEARCH_RESULTS,
  assertSafeReadablePath,
  normalizeToolPath,
} from './common'
import type { RunnerToolContext } from './types'

export const SearchTextArgsSchema = z.object({
  query: z.string().min(1),
  path: z.string().default('.'),
  caseSensitive: z.boolean().default(false),
  maxResults: z.number().int().positive().max(MAX_SEARCH_RESULTS).default(100),
})

export type SearchTextArgs = z.infer<typeof SearchTextArgsSchema>

export interface SearchTextMatch {
  path: string
  line: number
  column: number
  text: string
}

export interface SearchTextResult {
  matches: SearchTextMatch[]
  truncated: boolean
}

function findColumn(
  line: string,
  query: string,
  caseSensitive: boolean,
): number {
  const source = caseSensitive ? line : line.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()

  return source.indexOf(needle)
}

export async function searchTextTool(
  context: RunnerToolContext,
  rawArgs: unknown,
): Promise<SearchTextResult> {
  const args = SearchTextArgsSchema.parse(rawArgs)
  const root = assertSafeReadablePath(context, args.path)
  const matches: SearchTextMatch[] = []

  async function visit(currentPath: string): Promise<void> {
    if (matches.length >= args.maxResults) {
      return
    }

    const currentStat = await stat(currentPath)

    if (currentStat.isDirectory()) {
      const children = await readdir(currentPath, {
        withFileTypes: true,
      })

      children.sort((a, b) => a.name.localeCompare(b.name))

      for (const child of children) {
        if (matches.length >= args.maxResults) {
          return
        }

        const absolutePath = path.join(currentPath, child.name)
        const relativePath = path.relative(context.worktreePath, absolutePath)

        try {
          assertSafeReadablePath(context, relativePath)
        } catch {
          continue
        }

        await visit(absolutePath)
      }

      return
    }

    if (!currentStat.isFile() || currentStat.size > MAX_READ_FILE_BYTES) {
      return
    }

    const relativePath = path.relative(context.worktreePath, currentPath)

    try {
      assertSafeReadablePath(context, relativePath)
    } catch {
      return
    }

    const content = await readFile(currentPath, 'utf-8')
    const lines = content.split(/\r?\n/)

    for (let index = 0; index < lines.length; index += 1) {
      if (matches.length >= args.maxResults) {
        return
      }

      const line = lines[index]
      const column = findColumn(line, args.query, args.caseSensitive)

      if (column >= 0) {
        matches.push({
          path: normalizeToolPath(relativePath),
          line: index + 1,
          column: column + 1,
          text: line,
        })
      }
    }
  }

  await visit(root.absolutePath)

  return {
    matches,
    truncated: matches.length >= args.maxResults,
  }
}
