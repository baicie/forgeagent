import { mkdtemp, rm, writeFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GitClient } from './gitClient'
import { GitRepositoryService } from './repository'
import { createGitFixture } from '../test/git-fixtures'

describe('gitRepositoryService', () => {
  it('reads git root, branch and commit', async () => {
    const fixture = await createGitFixture()
    const service = new GitRepositoryService(new GitClient())

    try {
      const info = await service.getRepositoryInfo(fixture.repoPath)
      const realGitRoot = await realpath(info.gitRoot)
      const realRepoPath = await realpath(fixture.repoPath)

      expect(realGitRoot).toBe(realRepoPath)
      expect(info.currentBranch).toBeTruthy()
      expect(info.currentCommit).toMatch(/^[0-9a-f]{40}$/)
      expect(info.isDirty).toBe(false)
    } finally {
      await fixture.cleanup()
    }
  })

  it('detects dirty repository', async () => {
    const fixture = await createGitFixture()
    const service = new GitRepositoryService(new GitClient())

    try {
      await writeFile(
        join(fixture.repoPath, 'new-file.txt'),
        'dirty content\n',
        'utf-8',
      )
      const info = await service.getRepositoryInfo(fixture.repoPath)

      expect(info.isDirty).toBe(true)
    } finally {
      await fixture.cleanup()
    }
  })

  it('throws structured error for non-git directory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-non-git-'))
    const service = new GitRepositoryService(new GitClient())

    try {
      await expect(service.getRepositoryInfo(tempDir)).rejects.toMatchObject({
        code: 'INVALID_GIT_REPO',
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('throws structured error for missing repository path (ENOENT)', async () => {
    const missingPath = join(tmpdir(), 'this-path-does-not-exist-at-all')
    const service = new GitRepositoryService(new GitClient())

    await expect(
      service.getRepositoryInfo(missingPath),
    ).rejects.toMatchObject({
      code: 'INVALID_GIT_REPO',
    })
  })

  it('throws structured error for inaccessible repository path (EACCES)', async () => {
    const service = new GitRepositoryService(new GitClient())

    await expect(
      service.getRepositoryInfo('/path/that/does/not/exist'),
    ).rejects.toMatchObject({
      code: 'INVALID_GIT_REPO',
    })
  })
})
