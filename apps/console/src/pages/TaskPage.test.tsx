import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RunnerApiClient } from '../api/client'
import type { TaskEvent } from '../types'
import { TaskPage } from './TaskPage'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  listeners = new Map<string, EventListener>()

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, listener)
  }

  removeEventListener(type: string) {
    this.listeners.delete(type)
  }

  close() {}

  emit(event: TaskEvent) {
    this.listeners.get(event.type)?.({
      data: JSON.stringify(event),
    } as MessageEvent)
  }
}

function createClient(): RunnerApiClient {
  return {
    baseUrl: 'http://127.0.0.1:17890',
    getTask: vi.fn(async () => ({
      id: 'task_1',
      workspaceId: 'ws_1',
      prompt: 'fix bug',
      status: 'waiting_approval',
      baseBranch: 'main',
      baseCommit: 'a'.repeat(40),
      worktreePath: '/tmp/worktree',
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    })),
    getTaskDiff: vi.fn(async () => ({
      taskId: 'task_1',
      diff: 'diff --git a/README.md b/README.md\n+hello',
    })),
    runTask: vi.fn(async () => ({})),
    approveApproval: vi.fn(async () => ({})),
    rejectApproval: vi.fn(async () => ({})),
    applyTask: vi.fn(async () => ({})),
    commitTask: vi.fn(async () => ({})),
    discardTask: vi.fn(async () => ({})),
    cancelTask: vi.fn(async () => ({})),
  } as unknown as RunnerApiClient
}

describe('task page', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  it('renders task, diff, and approval from SSE', async () => {
    const client = createClient()

    render(<TaskPage client={client} taskId="task_1" onBack={vi.fn()} />)

    await screen.findByText('fix bug')
    expect(screen.getByText(/README.md/)).toBeInTheDocument()

    FakeEventSource.instances[0].emit({
      id: 'evt_1',
      taskId: 'task_1',
      type: 'approval.required',
      payload: {
        approvalId: 'approval_1',
        command: 'pnpm test',
        risk: 'medium',
      },
      createdAt: '2026-06-22T00:00:00.000Z',
    })

    await screen.findByText('pnpm test')

    fireEvent.click(screen.getByText('Approve'))

    await waitFor(() => {
      expect(client.approveApproval).toHaveBeenCalledWith('approval_1')
    })

    expect(FakeEventSource.instances[0].url).toBe(
      'http://127.0.0.1:17890/api/tasks/task_1/events',
    )
  })
})
