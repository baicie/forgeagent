import { createForgeAgentError } from '@forgeagent/core'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { GitClient } from './gitClient'

export interface GitRepositoryInfo {
  repoPath: string
  gitRoot: string
  currentBranch: string
  currentCommit: string
  isDirty: boolean
}

export class GitRepositoryService {
  constructor(private readonly gitClient: GitClient) {}

  async getRepositoryInfo(repoPath: string): Promise<GitRepositoryInfo> {
    const resolvedRepoPath = resolve(repoPath)

    try {
      await access(resolvedRepoPath)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if (code === 'ENOENT' || code === 'EACCES') {
        throw createForgeAgentError(
          'INVALID_GIT_REPO',
          `Git repository path is not accessible: ${repoPath}`,
          {
            repoPath,
            resolvedRepoPath,
            cause: error instanceof Error ? error.message : String(error),
          },
        )
      }

      throw error
    }

    const gitRoot = await this.getGitRoot(resolvedRepoPath)
    const currentBranch = await this.getCurrentBranch(gitRoot)
    const currentCommit = await this.getCurrentCommit(gitRoot)
    const isDirty = await this.isDirty(gitRoot)

    return {
      repoPath: resolvedRepoPath,
      gitRoot,
      currentBranch,
      currentCommit,
      isDirty,
    }
  }

  async getGitRoot(repoPath: string): Promise<string> {
    const gitRoot = await this.gitClient.output(
      ['rev-parse', '--show-toplevel'],
      {
        cwd: repoPath,
      },
    )

    if (!gitRoot) {
      throw createForgeAgentError(
        'INVALID_GIT_REPO',
        `Not a git repository: ${repoPath}`,
        {
          repoPath,
        },
      )
    }

    return resolve(gitRoot)
  }

  async getCurrentBranch(gitRoot: string): Promise<string> {
    const branch = await this.gitClient.output(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      {
        cwd: gitRoot,
      },
    )

    return branch || 'HEAD'
  }

  async getCurrentCommit(gitRoot: string): Promise<string> {
    return this.gitClient.output(['rev-parse', 'HEAD'], {
      cwd: gitRoot,
    })
  }

  async isDirty(gitRoot: string): Promise<boolean> {
    const status = await this.gitClient.output(['status', '--porcelain'], {
      cwd: gitRoot,
    })

    return status.length > 0
  }
}
