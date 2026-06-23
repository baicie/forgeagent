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

  it('keeps newly created workspace selected before creating task', async () => {
    const client = {
      listWorkspaces: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'ws_1',
            name: 'repo1',
            repoPath: '/repo1',
            gitRoot: '/repo1',
            createdAt: '2026-06-22T00:00:00.000Z',
            updatedAt: '2026-06-22T00:00:00.000Z',
          },
        ])
        .mockResolvedValue([
          {
            id: 'ws_1',
            name: 'repo1',
            repoPath: '/repo1',
            gitRoot: '/repo1',
            createdAt: '2026-06-22T00:00:00.000Z',
            updatedAt: '2026-06-22T00:00:00.000Z',
          },
          {
            id: 'ws_2',
            name: 'repo2',
            repoPath: '/repo2',
            gitRoot: '/repo2',
            createdAt: '2026-06-22T00:00:00.000Z',
            updatedAt: '2026-06-22T00:00:00.000Z',
          },
        ]),
      listTasks: vi.fn(async () => []),
      createWorkspace: vi.fn(async () => ({
        id: 'ws_2',
        name: 'repo2',
        repoPath: '/repo2',
        gitRoot: '/repo2',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      })),
      createTask: vi.fn(async input => ({
        id: 'task_1',
        workspaceId: input.workspaceId,
        prompt: input.prompt,
        status: 'created',
        baseBranch: 'main',
        baseCommit: 'a'.repeat(40),
        worktreePath: '/tmp/worktree',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      })),
    } as unknown as RunnerApiClient

    const onOpenTask = vi.fn()

    render(<HomePage client={client} onOpenTask={onOpenTask} />)

    await screen.findByText(/repo1 · \/repo1/)

    fireEvent.change(screen.getByPlaceholderText('/Users/me/project'), {
      target: {
        value: '/repo2',
      },
    })

    fireEvent.change(screen.getByPlaceholderText('my-project'), {
      target: {
        value: 'repo2',
      },
    })

    fireEvent.click(screen.getByText('添加 workspace'))

    await screen.findByText(/repo2 · \/repo2/)

    fireEvent.change(screen.getByPlaceholderText('修复 xxx bug，并运行测试'), {
      target: {
        value: 'fix repo2',
      },
    })

    fireEvent.click(screen.getByText('创建任务'))

    await waitFor(() => {
      expect(client.createTask).toHaveBeenCalledWith({
        workspaceId: 'ws_2',
        prompt: 'fix repo2',
      })
    })
  })
})
