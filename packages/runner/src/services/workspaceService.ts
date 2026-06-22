import type { CreateWorkspaceInput, Workspace } from '@forgeagent/core'
import {
  createForgeAgentError,
  isIgnoredPath,
  isSensitivePath,
} from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import { basename, resolve } from 'node:path'
import type { RunnerDb } from '../db'
import type { GitRepositoryService } from '../git/repository'

export class WorkspaceService {
  constructor(
    private readonly db: RunnerDb,
    private readonly gitRepositoryService: GitRepositoryService,
  ) {}

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

    const repositoryInfo =
      await this.gitRepositoryService.getRepositoryInfo(repoPath)

    const now = new Date().toISOString()
    const existing = this.db.state.workspaces.find(
      workspace => workspace.gitRoot === repositoryInfo.gitRoot,
    )

    if (existing) {
      existing.repoPath = repositoryInfo.repoPath
      existing.currentBranch = repositoryInfo.currentBranch
      existing.currentCommit = repositoryInfo.currentCommit
      existing.updatedAt = now

      await this.db.save()

      return existing
    }

    const workspace: Workspace = {
      id: `ws_${randomUUID()}`,
      name: input.name || basename(repositoryInfo.gitRoot),
      repoPath: repositoryInfo.repoPath,
      gitRoot: repositoryInfo.gitRoot,
      currentBranch: repositoryInfo.currentBranch,
      currentCommit: repositoryInfo.currentCommit,
      createdAt: now,
      updatedAt: now,
    }

    this.db.state.workspaces.push(workspace)
    await this.db.save()

    return workspace
  }
}
