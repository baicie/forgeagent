import type { GitClient } from './gitClient'

export class GitDiffService {
  constructor(private readonly gitClient: GitClient) {}

  async getDiff(worktreePath: string): Promise<string> {
    return this.gitClient.output(['diff', 'HEAD'], {
      cwd: worktreePath,
    })
  }
}
