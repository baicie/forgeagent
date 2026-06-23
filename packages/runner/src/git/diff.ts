import type { GitClient } from './gitClient'

export interface GitDiffResult {
  diff: string
  changed: boolean
  bytes: number
}

function parseGitLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

export class GitDiffService {
  constructor(private readonly gitClient: GitClient) {}

  async getDiff(worktreePath: string): Promise<string> {
    await this.markUntrackedFilesForDiff(worktreePath)

    return this.gitClient.output(['diff', 'HEAD', '--'], {
      cwd: worktreePath,
    })
  }

  async getDiffResult(worktreePath: string): Promise<GitDiffResult> {
    const diff = await this.getDiff(worktreePath)

    return {
      diff,
      changed: diff.trim().length > 0,
      bytes: Buffer.byteLength(diff, 'utf-8'),
    }
  }

  private async markUntrackedFilesForDiff(worktreePath: string): Promise<void> {
    const output = await this.gitClient.output(
      ['ls-files', '--others', '--exclude-standard'],
      {
        cwd: worktreePath,
      },
    )

    const files = parseGitLines(output)

    if (files.length === 0) {
      return
    }

    await this.gitClient.run(['add', '-N', '--', ...files], {
      cwd: worktreePath,
    })
  }
}
