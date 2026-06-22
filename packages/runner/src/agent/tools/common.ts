import {
  assertInsideWorkspace,
  createForgeAgentError,
  isIgnoredPath,
  isSensitivePath,
} from '@forgeagent/core'
import path from 'node:path'
import type { RunnerToolContext } from './types'

export const MAX_READ_FILE_BYTES = 200 * 1024
export const MAX_SEARCH_RESULTS = 100
export const MAX_LIST_ENTRIES = 500

export interface ResolvedToolPath {
  absolutePath: string
  relativePath: string
}

export function resolveToolPath(
  context: RunnerToolContext,
  targetPath: string,
): ResolvedToolPath {
  const absolutePath = assertInsideWorkspace(context.worktreePath, targetPath)
  const relativePath = path.relative(context.worktreePath, absolutePath)

  return {
    absolutePath,
    relativePath: relativePath || '.',
  }
}

export function assertSafeReadablePath(
  context: RunnerToolContext,
  targetPath: string,
): ResolvedToolPath {
  const resolved = resolveToolPath(context, targetPath)

  if (
    isSensitivePath(resolved.relativePath) ||
    isSensitivePath(resolved.absolutePath)
  ) {
    throw createForgeAgentError(
      'SENSITIVE_FILE_BLOCKED',
      `Sensitive file is blocked: ${targetPath}`,
      {
        targetPath,
        relativePath: resolved.relativePath,
      },
    )
  }

  if (
    isIgnoredPath(resolved.relativePath) ||
    isIgnoredPath(resolved.absolutePath)
  ) {
    throw createForgeAgentError(
      'IGNORED_PATH_BLOCKED',
      `Ignored path is blocked: ${targetPath}`,
      {
        targetPath,
        relativePath: resolved.relativePath,
      },
    )
  }

  return resolved
}

export function assertSafeWritablePath(
  context: RunnerToolContext,
  targetPath: string,
): ResolvedToolPath {
  return assertSafeReadablePath(context, targetPath)
}

export function normalizeToolPath(relativePath: string): string {
  return relativePath.replaceAll(path.sep, '/')
}
