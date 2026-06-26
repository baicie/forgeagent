import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GitClient } from './gitClient'
import { GitWorkspaceSnapshotService } from './workspaceSnapshot'
import { createGitFixture } from '../test/git-fixtures'

describe('gitWorkspaceSnapshotService', () => {
  function createWorktreeDir(gitRoot: string): string {
    const branchName = `test-wt-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const worktreeDir = join(
      tmpdir(),
      `forgeagent-wt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    execFileSync('git', ['worktree', 'add', worktreeDir, '-b', branchName], {
      cwd: gitRoot,
    })

    return worktreeDir
  }

  describe('capture', () => {
    it('captures a clean repository snapshot', async () => {
      const fixture = await createGitFixture()
      const service = new GitWorkspaceSnapshotService(new GitClient())

      try {
        const snapshot = await service.capture(fixture.repoPath)

        expect(snapshot.trackedPatch).toBe('')
        expect(snapshot.untrackedFiles).toEqual([])
        expect(snapshot.excludedPaths).toEqual([])
        expect(snapshot.hash).toBeTruthy()
      } finally {
        await fixture.cleanup()
      }
    })

    it('captures untracked files', async () => {
      const fixture = await createGitFixture()
      const service = new GitWorkspaceSnapshotService(new GitClient())

      try {
        await writeFile(
          join(fixture.repoPath, 'new-file.txt'),
          'untracked content\n',
        )
        const snapshot = await service.capture(fixture.repoPath)

        expect(snapshot.trackedPatch).toBe('')
        expect(snapshot.untrackedFiles).toHaveLength(1)
        expect(snapshot.untrackedFiles[0].path).toBe('new-file.txt')
        expect(snapshot.untrackedFiles[0].content.toString()).toBe(
          'untracked content\n',
        )
      } finally {
        await fixture.cleanup()
      }
    })
  })

  describe('initializeWorktree', () => {
    it('creates an initial commit even for empty snapshot', async () => {
      const fixture = await createGitFixture()
      const service = new GitWorkspaceSnapshotService(new GitClient())
      const worktreeDir = createWorktreeDir(fixture.repoPath)

      try {
        const emptySnapshot = await service.capture(fixture.repoPath)

        const commitSha = await service.initializeWorktree(
          emptySnapshot,
          worktreeDir,
        )

        expect(commitSha).toMatch(/^[0-9a-f]{40}$/)

        const diff = await new GitClient().output(['diff', 'HEAD', '--'], {
          cwd: worktreeDir,
        })

        expect(diff).toBe('')
      } finally {
        execFileSync('git', ['worktree', 'remove', worktreeDir, '--force'], {
          cwd: fixture.repoPath,
        })
        await fixture.cleanup()
      }
    })

    it('creates a worktree that can be diffed after init', async () => {
      const fixture = await createGitFixture()
      const service = new GitWorkspaceSnapshotService(new GitClient())
      const worktreeDir = createWorktreeDir(fixture.repoPath)

      try {
        const emptySnapshot = await service.capture(fixture.repoPath)

        await service.initializeWorktree(emptySnapshot, worktreeDir)

        const diff = await new GitClient().output(['diff', 'HEAD', '--'], {
          cwd: worktreeDir,
        })

        expect(diff).toBe('')
      } finally {
        execFileSync('git', ['worktree', 'remove', worktreeDir, '--force'], {
          cwd: fixture.repoPath,
        })
        await fixture.cleanup()
      }
    })

    it('preserves untracked files in initialized worktree', async () => {
      const fixture = await createGitFixture()
      const service = new GitWorkspaceSnapshotService(new GitClient())
      const worktreeDir = createWorktreeDir(fixture.repoPath)

      try {
        await writeFile(join(fixture.repoPath, 'untracked.txt'), 'hello\n')
        const snapshot = await service.capture(fixture.repoPath)

        await service.initializeWorktree(snapshot, worktreeDir)

        const status = await new GitClient().output(['status', '--porcelain'], {
          cwd: worktreeDir,
        })

        expect(status).toBe('')
      } finally {
        execFileSync('git', ['worktree', 'remove', worktreeDir, '--force'], {
          cwd: fixture.repoPath,
        })
        await fixture.cleanup()
      }
    })

    it('does not add placeholder when snapshot has changes', async () => {
      const fixture = await createGitFixture()
      const service = new GitWorkspaceSnapshotService(new GitClient())
      const worktreeDir = createWorktreeDir(fixture.repoPath)

      try {
        await writeFile(join(fixture.repoPath, 'untracked.txt'), 'hello\n')
        const snapshot = await service.capture(fixture.repoPath)

        await service.initializeWorktree(snapshot, worktreeDir)

        const status = await new GitClient().output(['status', '--porcelain'], {
          cwd: worktreeDir,
        })

        expect(status).toBe('')
        const files = await new GitClient().output(['ls-files'], {
          cwd: worktreeDir,
        })

        expect(files).not.toContain('.forgeagent-placeholder')
      } finally {
        execFileSync('git', ['worktree', 'remove', worktreeDir, '--force'], {
          cwd: fixture.repoPath,
        })
        await fixture.cleanup()
      }
    })
  })
})
