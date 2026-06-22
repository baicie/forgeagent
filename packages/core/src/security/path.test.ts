import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { assertInsideWorkspace } from './path'

describe('assertInsideWorkspace', () => {
  it('allows a path inside the workspace', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-path-'))
    const workspaceRoot = path.join(tempDir, 'workspace')
    await mkdir(workspaceRoot, { recursive: true })

    try {
      const resolved = assertInsideWorkspace(workspaceRoot, 'src/index.ts')
      expect(resolved).toBe(path.resolve(workspaceRoot, 'src/index.ts'))
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('allows the workspace root itself', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-path-'))
    const workspaceRoot = path.join(tempDir, 'workspace')
    await mkdir(workspaceRoot, { recursive: true })

    try {
      const resolved = assertInsideWorkspace(workspaceRoot, '.')
      expect(resolved).toBe(path.resolve(workspaceRoot))
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('blocks parent directory escape', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-path-'))
    const workspaceRoot = path.join(tempDir, 'workspace')
    await mkdir(workspaceRoot, { recursive: true })

    try {
      expect(() =>
        assertInsideWorkspace(workspaceRoot, '../outside.txt'),
      ).toThrow('Path escapes workspace')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('blocks absolute path escape', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-path-'))
    const workspaceRoot = path.join(tempDir, 'workspace')
    await mkdir(workspaceRoot, { recursive: true })

    try {
      expect(() => assertInsideWorkspace(workspaceRoot, tempDir)).toThrow(
        'Path escapes workspace',
      )
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('blocks existing symlink escape', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-path-'))
    const workspaceRoot = path.join(tempDir, 'workspace')
    await mkdir(workspaceRoot, { recursive: true })

    try {
      const outsideDir = path.join(tempDir, 'outside')
      const outsideFile = path.join(outsideDir, 'secret.txt')
      const linkPath = path.join(workspaceRoot, 'linked-secret')

      await mkdir(outsideDir, { recursive: true })
      await writeFile(outsideFile, 'secret', 'utf-8')

      try {
        await symlink(outsideFile, linkPath)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code

        if (code === 'EPERM' || code === 'EACCES') {
          await rm(tempDir, { recursive: true, force: true })
          return
        }

        throw error
      }

      await realpath(linkPath)

      expect(() =>
        assertInsideWorkspace(workspaceRoot, 'linked-secret'),
      ).toThrow('Path escapes workspace through symlink')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('blocks non-existing child under symlinked directory escape', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-path-'))
    const workspaceRoot = path.join(tempDir, 'workspace')
    await mkdir(workspaceRoot, { recursive: true })

    try {
      const outsideDir = path.join(tempDir, 'outside')
      const linkPath = path.join(workspaceRoot, 'linked-dir')

      await mkdir(outsideDir, { recursive: true })

      try {
        await symlink(outsideDir, linkPath, 'dir')
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code

        if (code === 'EPERM' || code === 'EACCES') {
          await rm(tempDir, { recursive: true, force: true })
          return
        }

        throw error
      }

      expect(() =>
        assertInsideWorkspace(workspaceRoot, 'linked-dir/new-file.ts'),
      ).toThrow('Path escapes workspace through symlink')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('throws WORKSPACE_NOT_FOUND when root does not exist', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'forgeagent-path-'))

    try {
      expect(() =>
        assertInsideWorkspace(path.join(tempDir, 'missing'), 'file.ts'),
      ).toThrow('Workspace root does not exist')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
