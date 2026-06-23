import type { RunnerApiClient } from '../client/runnerClient'
import { createWorkspaceCommand } from './workspace'

function createClient() {
  return {
    createWorkspace: vi.fn(async input => ({
      id: 'ws_1',
      name: input.name || 'repo',
      repoPath: input.repoPath,
      gitRoot: input.repoPath,
      currentBranch: 'main',
      currentCommit: 'a'.repeat(40),
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    })),
    listWorkspaces: vi.fn(async () => [
      {
        id: 'ws_1',
        name: 'repo',
        repoPath: '/repo',
        gitRoot: '/repo',
        currentBranch: 'main',
        currentCommit: 'a'.repeat(40),
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ]),
  } as unknown as RunnerApiClient
}

describe('workspace command', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds workspace through runner API', async () => {
    const client = createClient()
    const command = createWorkspaceCommand(() => client)

    await command.parseAsync(['node', 'test', 'add', '.', '--name', 'repo'])

    expect(client.createWorkspace).toHaveBeenCalledWith({
      repoPath: process.cwd(),
      name: 'repo',
    })
  })

  it('lists workspaces', async () => {
    const client = createClient()
    const command = createWorkspaceCommand(() => client)

    await command.parseAsync(['node', 'test', 'list'])

    expect(client.listWorkspaces).toHaveBeenCalled()
    expect(console.log).toHaveBeenCalled()
  })
})
