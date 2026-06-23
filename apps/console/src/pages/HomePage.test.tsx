import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RunnerApiClient } from '../api/client'
import { HomePage } from './HomePage'

function createClient(): RunnerApiClient {
  return {
    listWorkspaces: vi.fn(async () => [
      {
        id: 'ws_1',
        name: 'repo',
        repoPath: '/repo',
        gitRoot: '/repo',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ]),
    listTasks: vi.fn(async () => []),
    createWorkspace: vi.fn(async input => ({
      id: 'ws_2',
      name: input.name || 'repo2',
      repoPath: input.repoPath,
      gitRoot: input.repoPath,
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    })),
    createTask: vi.fn(async () => ({
      id: 'task_1',
      workspaceId: 'ws_1',
      prompt: 'fix bug',
      status: 'created',
      baseBranch: 'main',
      baseCommit: 'a'.repeat(40),
      worktreePath: '/tmp/worktree',
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    })),
  } as unknown as RunnerApiClient
}

describe('home page', () => {
  it('loads workspaces and creates task', async () => {
    const client = createClient()
    const onOpenTask = vi.fn()

    render(<HomePage client={client} onOpenTask={onOpenTask} />)

    await screen.findByText(/repo · \/repo/)

    fireEvent.change(screen.getByPlaceholderText('修复 xxx bug，并运行测试'), {
      target: {
        value: 'fix bug',
      },
    })

    fireEvent.click(screen.getByText('创建任务'))

    await waitFor(() => {
      expect(client.createTask).toHaveBeenCalledWith({
        workspaceId: 'ws_1',
        prompt: 'fix bug',
      })
    })

    expect(onOpenTask).toHaveBeenCalledWith('task_1')
  })
})
