import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GitClient } from './gitClient'
import { GitDiffService } from './diff'
import { GitWorktreeService } from './worktree'
import { createGitFixture } from '../test/git-fixtures'

describe('gitDiffService', () => {
  it('reads diff from worktree', async () => {
    const fixture = await createGitFixture()
    const gitClient = new GitClient()
    const worktreeService = new GitWorktreeService(gitClient)
    const diffService = new GitDiffService(gitClient)

    try {
      const worktree = await worktreeService.create({
        gitRoot: fixture.repoPath,
        taskId: 'task_diff',
        dataDir: join(fixture.tempDir, '.forgeagent'),
      })

      await writeFile(
        join(worktree.worktreePath, 'README.md'),
        '# Changed\n',
        'utf-8',
      )

      const diff = await diffService.getDiff(worktree.worktreePath)

      expect(diff).toContain('README.md')
      expect(diff).toContain('# Changed')
    } finally {
      await fixture.cleanup()
    }
  })
})
