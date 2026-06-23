import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GitDiffService } from './diff'
import { GitClient } from './gitClient'
import { GitPatchService } from './patch'
import { GitWorktreeService } from './worktree'
import { createGitFixture } from '../test/git-fixtures'

describe('gitPatchService', () => {
  it('creates patch from worktree and applies it to original repo', async () => {
    const fixture = await createGitFixture()
    const gitClient = new GitClient()
    const diffService = new GitDiffService(gitClient)
    const patchService = new GitPatchService(gitClient, diffService)
    const worktreeService = new GitWorktreeService(gitClient)

    try {
      const worktree = await worktreeService.create({
        gitRoot: fixture.repoPath,
        taskId: 'task_apply_patch',
        dataDir: join(fixture.tempDir, '.forgeagent'),
      })

      await writeFile(
        join(worktree.worktreePath, 'README.md'),
        '# Applied by ForgeAgent\n',
        'utf-8',
      )

      const patch = await patchService.createPatchFromWorktree(
        'task_apply_patch',
        worktree.worktreePath,
        join(fixture.tempDir, '.forgeagent'),
      )

      await patchService.applyPatch(fixture.repoPath, patch.patchFile)

      await expect(
        readFile(join(fixture.repoPath, 'README.md'), 'utf-8'),
      ).resolves.toContain('Applied by ForgeAgent')
    } finally {
      await fixture.cleanup()
    }
  })

  it('returns DIFF_EMPTY for empty worktree diff', async () => {
    const fixture = await createGitFixture()
    const gitClient = new GitClient()
    const diffService = new GitDiffService(gitClient)
    const patchService = new GitPatchService(gitClient, diffService)
    const worktreeService = new GitWorktreeService(gitClient)

    try {
      const worktree = await worktreeService.create({
        gitRoot: fixture.repoPath,
        taskId: 'task_empty_patch',
        dataDir: join(fixture.tempDir, '.forgeagent'),
      })

      await expect(
        patchService.createPatchFromWorktree(
          'task_empty_patch',
          worktree.worktreePath,
          join(fixture.tempDir, '.forgeagent'),
        ),
      ).rejects.toMatchObject({
        code: 'DIFF_EMPTY',
      })
    } finally {
      await fixture.cleanup()
    }
  })

  it('returns PATCH_APPLY_FAILED when original repo conflicts', async () => {
    const fixture = await createGitFixture()
    const gitClient = new GitClient()
    const diffService = new GitDiffService(gitClient)
    const patchService = new GitPatchService(gitClient, diffService)
    const worktreeService = new GitWorktreeService(gitClient)

    try {
      const worktree = await worktreeService.create({
        gitRoot: fixture.repoPath,
        taskId: 'task_patch_conflict',
        dataDir: join(fixture.tempDir, '.forgeagent'),
      })

      await writeFile(
        join(worktree.worktreePath, 'README.md'),
        '# Worktree change\n',
        'utf-8',
      )

      const patch = await patchService.createPatchFromWorktree(
        'task_patch_conflict',
        worktree.worktreePath,
        join(fixture.tempDir, '.forgeagent'),
      )

      await writeFile(
        join(fixture.repoPath, 'README.md'),
        '# Original repo changed\n',
        'utf-8',
      )

      await expect(
        patchService.applyPatch(fixture.repoPath, patch.patchFile),
      ).rejects.toMatchObject({
        code: 'PATCH_APPLY_FAILED',
      })
    } finally {
      await fixture.cleanup()
    }
  })
})
