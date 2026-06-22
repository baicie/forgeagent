import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { GitClient } from './gitClient'
import {
  GitWorktreeService,
  getTaskWorktreeBranch,
  getTaskWorktreePath,
} from './worktree'
import { createGitFixture, runGitFixture } from '../test/git-fixtures'

describe('gitWorktreeService', () => {
  it('creates and discards a task worktree', async () => {
    const fixture = await createGitFixture()
    const service = new GitWorktreeService(new GitClient())
    const dataDir = join(fixture.tempDir, '.forgeagent')
    const taskId = 'task_test_1'

    try {
      const info = await service.create({
        gitRoot: fixture.repoPath,
        taskId,
        dataDir,
      })

      expect(info.worktreePath).toBe(getTaskWorktreePath(dataDir, taskId))
      expect(info.branchName).toBe(getTaskWorktreeBranch(taskId))

      await expect(access(info.worktreePath)).resolves.toBeUndefined()

      const branches = await runGitFixture(fixture.repoPath, [
        'branch',
        '--list',
        info.branchName,
      ])

      expect(branches).toContain(info.branchName)

      await service.discard(fixture.repoPath, info.worktreePath, taskId)

      await expect(access(info.worktreePath)).rejects.toThrow()

      const branchesAfterDiscard = await runGitFixture(fixture.repoPath, [
        'branch',
        '--list',
        info.branchName,
      ])

      expect(branchesAfterDiscard).toBe('')
    } finally {
      await fixture.cleanup()
    }
  })
})
