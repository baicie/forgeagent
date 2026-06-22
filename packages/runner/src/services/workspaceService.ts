import type { CreateWorkspaceInput, Workspace } from '@forgeagent/core'
import {
  createForgeAgentError,
  isIgnoredPath,
  isSensitivePath,
} from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { RunnerDb } from '../db'

export class WorkspaceService {
  constructor(private readonly db: RunnerDb) {}

  list(): Workspace[] {
    return this.db.state.workspaces
  }

  get(id: string): Workspace {
    const workspace = this.db.state.workspaces.find(item => item.id === id)

    if (!workspace) {
      throw createForgeAgentError(
        'WORKSPACE_NOT_FOUND',
        `Workspace not found: ${id}`,
        { id },
      )
    }

    return workspace
  }

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const repoPath = resolve(input.repoPath)

    if (isSensitivePath(repoPath)) {
      throw createForgeAgentError(
        'SENSITIVE_FILE_BLOCKED',
        `Workspace path is sensitive: ${repoPath}`,
        { repoPath },
      )
    }

    if (isIgnoredPath(repoPath)) {
      throw createForgeAgentError(
        'IGNORED_PATH_BLOCKED',
        `Workspace path is ignored: ${repoPath}`,
        { repoPath },
      )
    }

    await access(repoPath)

    const now = new Date().toISOString()
    const existing = this.db.state.workspaces.find(
      workspace => workspace.repoPath === repoPath,
    )

    if (existing) {
      return existing
    }

    const workspace: Workspace = {
      id: `ws_${randomUUID()}`,
      name: input.name || basename(repoPath),
      repoPath,
      gitRoot: repoPath,
      createdAt: now,
      updatedAt: now,
    }

    this.db.state.workspaces.push(workspace)
    await this.db.save()

    return workspace
  }
}
