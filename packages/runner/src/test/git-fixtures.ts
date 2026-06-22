import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface GitFixture {
  tempDir: string
  repoPath: string
  cleanup: () => Promise<void>
}

export async function runGitFixture(
  repoPath: string,
  args: string[],
): Promise<string> {
  const result = await execFileAsync('git', args, {
    cwd: repoPath,
    windowsHide: true,
  })

  return String(result.stdout).trim()
}

export async function createGitFixture(): Promise<GitFixture> {
  const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-git-'))
  const repoPath = join(tempDir, 'repo')

  await mkdir(repoPath, { recursive: true })
  await runGitFixture(repoPath, ['init'])
  await runGitFixture(repoPath, ['config', 'user.email', 'test@example.com'])
  await runGitFixture(repoPath, ['config', 'user.name', 'ForgeAgent Test'])

  await writeFile(join(repoPath, 'README.md'), '# Test Repo\n', 'utf-8')
  await runGitFixture(repoPath, ['add', 'README.md'])
  await runGitFixture(repoPath, ['commit', '-m', 'initial commit'])

  return {
    tempDir,
    repoPath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}
