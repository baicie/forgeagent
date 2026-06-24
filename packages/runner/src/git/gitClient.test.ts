import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GitClient } from './gitClient'

describe('gitClient error classification', () => {
  let client: GitClient
  let tempDir: string

  beforeEach(() => {
    client = new GitClient()
  })

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  async function setupTempRepo(): Promise<string> {
    const { execSync } = await import('node:child_process')
    tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-test-'))
    execSync('git init', { cwd: tempDir, stdio: 'ignore' })
    execSync('git config user.email "test@example.com"', {
      cwd: tempDir,
      stdio: 'ignore',
    })
    execSync('git config user.name "Test"', {
      cwd: tempDir,
      stdio: 'ignore',
    })
    await writeFile(join(tempDir, 'file.txt'), 'content\n', 'utf-8')
    execSync('git add file.txt', { cwd: tempDir, stdio: 'ignore' })
    execSync('git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' })
    return tempDir
  }

  it('classifies "not a git repository" as WORKSPACE_NOT_GIT_REPOSITORY', async () => {
    const nonGitDir = await mkdtemp(join(tmpdir(), 'forgeagent-not-git-'))
    tempDir = nonGitDir

    try {
      await expect(
        client.run(['status'], { cwd: nonGitDir }),
      ).rejects.toMatchObject({
        code: 'WORKSPACE_NOT_GIT_REPOSITORY',
        message: expect.stringContaining('git status'),
      })
    } finally {
      await rm(nonGitDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('classifies ambiguous HEAD as WORKSPACE_EMPTY_GIT_REPOSITORY', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'forgeagent-empty-'))
    tempDir = emptyDir
    const { execSync } = await import('node:child_process')

    try {
      execSync('git init', { cwd: emptyDir, stdio: 'ignore' })

      await expect(
        client.run(['diff', 'HEAD', '--'], { cwd: emptyDir }),
      ).rejects.toMatchObject({
        code: 'WORKSPACE_EMPTY_GIT_REPOSITORY',
        message: expect.stringContaining('git diff'),
      })
    } finally {
      await rm(emptyDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('classifies "no commits yet" as WORKSPACE_EMPTY_GIT_REPOSITORY', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'forgeagent-no-commits-'))
    tempDir = emptyDir
    const { execSync } = await import('node:child_process')

    try {
      execSync('git init', { cwd: emptyDir, stdio: 'ignore' })

      await expect(
        client.output(['rev-parse', 'HEAD'], { cwd: emptyDir }),
      ).rejects.toMatchObject({
        code: 'WORKSPACE_EMPTY_GIT_REPOSITORY',
      })
    } finally {
      await rm(emptyDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('succeeds on a valid repository with good error message on failure', async () => {
    const repoPath = await setupTempRepo()

    const result = await client.run(['status', '--porcelain'], { cwd: repoPath })

    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })

  it('classifies non-git status as WORKSPACE_NOT_GIT_REPOSITORY', async () => {
    const nonGitDir = await mkdtemp(join(tmpdir(), 'forgeagent-status-'))
    tempDir = nonGitDir

    try {
      await expect(
        client.run(['status'], { cwd: nonGitDir }),
      ).rejects.toMatchObject({
        code: 'WORKSPACE_NOT_GIT_REPOSITORY',
      })
    } finally {
      await rm(nonGitDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('returns error details including cwd, args, exitCode, stderr, message', async () => {
    const nonGitDir = await mkdtemp(join(tmpdir(), 'forgeagent-err-details-'))
    tempDir = nonGitDir

    try {
      await expect(
        client.run(['log'], { cwd: nonGitDir }),
      ).rejects.toMatchObject({
        code: 'WORKSPACE_NOT_GIT_REPOSITORY',
        details: expect.objectContaining({
          cwd: nonGitDir,
          args: ['log'],
          exitCode: 128,
          stderr: expect.any(String),
          message: expect.any(String),
        }),
      })
    } finally {
      await rm(nonGitDir, { recursive: true, force: true }).catch(() => {})
    }
  })
})
