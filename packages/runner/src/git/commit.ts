import { createForgeAgentError } from '@forgeagent/core'
import type { GitClient } from './gitClient'
import type { GitDiffService } from './diff'

export interface CommitWorktreeResult {
  commitSha: string
  message: string
}

export class GitCommitService {
  constructor(
    private readonly gitClient: GitClient,
    private readonly diffService: GitDiffService,
  ) {}

  async commitWorktree(
    worktreePath: string,
    message: string,
  ): Promise<CommitWorktreeResult> {
    const diff = await this.diffService.getDiff(worktreePath)

    if (diff.trim().length === 0) {
      throw createForgeAgentError('DIFF_EMPTY', 'Task diff is empty', {
        worktreePath,
      })
    }

    await this.gitClient.run(['add', '-A'], {
      cwd: worktreePath,
    })

    await this.gitClient.run(['commit', '-m', message], {
      cwd: worktreePath,
    })

    const commitSha = await this.gitClient.output(['rev-parse', 'HEAD'], {
      cwd: worktreePath,
    })

    return {
      commitSha,
      message,
    }
  }
}
