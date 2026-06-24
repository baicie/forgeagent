import {
  assertInsideWorkspace,
  isIgnoredPath,
  isSensitivePath,
} from '@forgeagent/core'
import { createHash } from 'node:crypto'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { GitClient } from './gitClient'

export interface WorkspaceSnapshotFile {
  path: string
  content: Buffer
}

export interface WorkspaceSnapshot {
  hash: string
  trackedPatch: string
  untrackedFiles: WorkspaceSnapshotFile[]
  excludedPaths: string[]
}

function hashSnapshot(
  trackedPatch: string,
  untrackedFiles: WorkspaceSnapshotFile[],
): string {
  const hash = createHash('sha256')

  hash.update('tracked\0')
  hash.update(trackedPatch, 'utf-8')

  for (const file of untrackedFiles) {
    hash.update('file\0')
    hash.update(file.path, 'utf-8')
    hash.update('\0')
    hash.update(String(file.content.byteLength), 'utf-8')
    hash.update('\0')
    hash.update(file.content)
  }

  return hash.digest('hex')
}

export class GitWorkspaceSnapshotService {
  constructor(private readonly gitClient: GitClient) {}

  async capture(gitRoot: string): Promise<WorkspaceSnapshot> {
    const tracked = await this.gitClient.run(
      ['diff', '--binary', 'HEAD', '--'],
      { cwd: gitRoot },
    )
    const untracked = await this.gitClient.run(
      ['ls-files', '--others', '--exclude-standard', '-z'],
      { cwd: gitRoot },
    )
    const paths = untracked.stdout
      .split('\0')
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    const untrackedFiles: WorkspaceSnapshotFile[] = []
    const excludedPaths: string[] = []

    for (const relativePath of paths) {
      if (isSensitivePath(relativePath) || isIgnoredPath(relativePath)) {
        excludedPaths.push(relativePath)
        continue
      }

      let sourcePath: string

      try {
        sourcePath = assertInsideWorkspace(gitRoot, relativePath)
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : undefined

        if (code === 'PATH_ESCAPE_DETECTED') {
          excludedPaths.push(relativePath)
          continue
        }

        throw error
      }

      const stats = await lstat(sourcePath)

      if (!stats.isFile()) {
        excludedPaths.push(relativePath)
        continue
      }

      untrackedFiles.push({
        path: relativePath,
        content: await readFile(sourcePath),
      })
    }

    return {
      hash: hashSnapshot(tracked.stdout, untrackedFiles),
      trackedPatch: tracked.stdout,
      untrackedFiles,
      excludedPaths,
    }
  }

  async initializeWorktree(
    snapshot: WorkspaceSnapshot,
    worktreePath: string,
  ): Promise<string> {
    if (snapshot.trackedPatch.trim()) {
      await this.applyTrackedPatch(snapshot.trackedPatch, worktreePath)
    }

    for (const file of snapshot.untrackedFiles) {
      const targetPath = assertInsideWorkspace(worktreePath, file.path)

      await mkdir(dirname(targetPath), { recursive: true })
      await writeFile(targetPath, file.content)
    }

    const status = await this.gitClient.output(['status', '--porcelain'], {
      cwd: worktreePath,
    })

    if (status) {
      await this.gitClient.run(['add', '-A', '--'], { cwd: worktreePath })
      await this.gitClient.run(
        [
          '-c',
          'user.name=ForgeAgent',
          '-c',
          'user.email=forgeagent@localhost',
          'commit',
          '--no-verify',
          '-m',
          'forgeagent: workspace snapshot',
        ],
        { cwd: worktreePath },
      )
    }

    return this.gitClient.output(['rev-parse', 'HEAD'], {
      cwd: worktreePath,
    })
  }

  private async applyTrackedPatch(
    patch: string,
    worktreePath: string,
  ): Promise<void> {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-snapshot-'))
    const patchFile = join(tempDir, 'workspace.patch')

    try {
      await writeFile(patchFile, patch, 'utf-8')
      await this.gitClient.run(
        ['apply', '--binary', '--whitespace=nowarn', patchFile],
        { cwd: worktreePath },
      )
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}
