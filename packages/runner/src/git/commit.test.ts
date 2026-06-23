import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GitCommitService } from './commit'
import { GitDiffService } from './diff'
import { GitClient } from './gitClient'
import { GitWorktreeService } from './worktree'
import { createGitFixture, runGitFixture } from '../test/git-fixtures'

describe('gitCommitService', () => {
  it('commits changes in task worktree', async () => {
    const fixture = await createGitFixture()
    const gitClient = new GitClient()
    const diffService = new GitDiffService(gitClient)
    const worktreeService = new GitWorktreeService(gitClient)
    const commitService = new GitCommitService(gitClient, diffService)

    try {
      const worktree = await worktreeService.create({
        gitRoot: fixture.repoPath,
        taskId: 'task_commit',
        dataDir: join(fixture.tempDir, '.forgeagent'),
      })

      await writeFile(
        join(worktree.worktreePath, 'README.md'),
        '# Committed by ForgeAgent\n',
        'utf-8',
      )

      const result = await commitService.commitWorktree(
        worktree.worktreePath,
        'test: commit worktree changes',
      )

      expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/)

      const message = await runGitFixture(worktree.worktreePath, [
        'log',
        '-1',
        '--format=%s',
      ])

      expect(message).toBe('test: commit worktree changes')
    } finally {
      await fixture.cleanup()
    }
  })

  it('returns DIFF_EMPTY when there is nothing to commit', async () => {
    const fixture = await createGitFixture()
    const gitClient = new GitClient()
    const diffService = new GitDiffService(gitClient)
    const worktreeService = new GitWorktreeService(gitClient)
    const commitService = new GitCommitService(gitClient, diffService)

    try {
      const worktree = await worktreeService.create({
        gitRoot: fixture.repoPath,
        taskId: 'task_empty_commit',
        dataDir: join(fixture.tempDir, '.forgeagent'),
      })

      await expect(
        commitService.commitWorktree(
          worktree.worktreePath,
          'test: empty commit',
        ),
      ).rejects.toMatchObject({
        code: 'DIFF_EMPTY',
      })
    } finally {
      await fixture.cleanup()
    }
  })
})
