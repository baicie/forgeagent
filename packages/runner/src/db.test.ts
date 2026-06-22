import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createEmptyRunnerState,
  createInMemoryRunnerDb,
  createJsonFileRunnerDb,
} from './db'

describe('runner db', () => {
  it('creates an empty runner state', () => {
    expect(createEmptyRunnerState()).toEqual({
      workspaces: [],
      tasks: [],
      events: [],
      approvals: [],
      audits: [],
    })
  })

  it('keeps in-memory state', async () => {
    const db = createInMemoryRunnerDb()

    await db.load()
    db.state.workspaces.push({
      id: 'ws_1',
      name: 'repo',
      repoPath: '/repo',
      gitRoot: '/repo',
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    })
    await db.save()

    expect(db.state.workspaces).toHaveLength(1)
  })

  it('persists JSON file state', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-db-'))
    const dbFile = join(tempDir, 'runner-db.json')

    try {
      const db = createJsonFileRunnerDb(dbFile)
      await db.load()

      db.state.workspaces.push({
        id: 'ws_1',
        name: 'repo',
        repoPath: '/repo',
        gitRoot: '/repo',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      })

      await db.save()

      const content = await readFile(dbFile, 'utf-8')

      expect(JSON.parse(content).workspaces).toHaveLength(1)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
