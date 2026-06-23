import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GitDiffService } from './diff'
import { GitClient } from './gitClient'
import { GitWorktreeService } from './worktree'
import { createGitFixture, runGitFixture } from '../test/git-fixtures'

describe('gitDiffService', () => {
  it('reads modified, added and deleted files from worktree diff', async () => {
    const fixture = await createGitFixture()

    try {
      await writeFile(join(fixture.repoPath, 'delete-me.txt'), 'delete me\n')
      await runGitFixture(fixture.repoPath, ['add', 'delete-me.txt'])
      await runGitFixture(fixture.repoPath, [
        'commit',
        '-m',
        'add delete fixture',
      ])

      const gitClient = new GitClient()
      const worktreeService = new GitWorktreeService(gitClient)
      const diffService = new GitDiffService(gitClient)

      const worktree = await worktreeService.create({
        gitRoot: fixture.repoPath,
        taskId: 'task_diff_all',
        dataDir: join(fixture.tempDir, '.forgeagent'),
      })

      await writeFile(
        join(worktree.worktreePath, 'README.md'),
        '# Modified\n',
        'utf-8',
      )
      await writeFile(
        join(worktree.worktreePath, 'new-file.txt'),
        'new file\n',
        'utf-8',
      )
      await rm(join(worktree.worktreePath, 'delete-me.txt'))

      const diff = await diffService.getDiff(worktree.worktreePath)

      expect(diff).toContain('README.md')
      expect(diff).toContain('new-file.txt')
      expect(diff).toContain('delete-me.txt')
      expect(diff).toContain('new file mode')
      expect(diff).toContain('deleted file mode')
    } finally {
      await fixture.cleanup()
    }
  })
})
