import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { createForgeAgentError } from '../domain/error'

function isPathInside(parent: string, child: string): boolean {
  const normalizedParent = path.resolve(parent)
  const normalizedChild = path.resolve(child)

  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(normalizedParent + path.sep)
  )
}

function findNearestExistingPath(targetPath: string): string | undefined {
  let current = path.resolve(targetPath)

  while (!existsSync(current)) {
    const parent = path.dirname(current)

    if (parent === current) {
      return undefined
    }

    current = parent
  }

  return current
}

export function assertInsideWorkspace(
  workspaceRoot: string,
  targetPath: string,
): string {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot)
  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(resolvedWorkspaceRoot, targetPath)

  if (!isPathInside(resolvedWorkspaceRoot, resolvedTarget)) {
    throw createForgeAgentError(
      'PATH_ESCAPE_DETECTED',
      `Path escapes workspace: ${targetPath}`,
      {
        workspaceRoot,
        targetPath,
        resolvedTarget,
      },
    )
  }

  const existingWorkspaceRoot = findNearestExistingPath(resolvedWorkspaceRoot)

  if (
    !existingWorkspaceRoot ||
    !isPathInside(resolvedWorkspaceRoot, existingWorkspaceRoot)
  ) {
    throw createForgeAgentError(
      'WORKSPACE_NOT_FOUND',
      `Workspace root does not exist: ${workspaceRoot}`,
      {
        workspaceRoot,
      },
    )
  }

  const realWorkspaceRoot = realpathSync.native(existingWorkspaceRoot)
  const nearestExistingTarget = findNearestExistingPath(resolvedTarget)

  if (!nearestExistingTarget) {
    return resolvedTarget
  }

  const realExistingTarget = realpathSync.native(nearestExistingTarget)

  if (!isPathInside(realWorkspaceRoot, realExistingTarget)) {
    throw createForgeAgentError(
      'PATH_ESCAPE_DETECTED',
      `Path escapes workspace through symlink: ${targetPath}`,
      {
        workspaceRoot,
        targetPath,
        resolvedTarget,
        realWorkspaceRoot,
        realExistingTarget,
      },
    )
  }

  return resolvedTarget
}
