import {
  formatTaskAppliedHint,
  formatTaskCompletedHint,
  formatTaskCreatedHint,
  formatTaskEvent,
} from './output'
import type { Task, TaskEvent, Workspace } from './client/types'

const task: Task = {
  id: 'task_1',
  workspaceId: 'ws_1',
  prompt: 'fix bug',
  status: 'completed',
  baseBranch: 'main',
  baseCommit: 'a'.repeat(40),
  worktreePath: '/tmp/worktree',
  createdAt: '2026-06-24T00:00:00.000Z',
  updatedAt: '2026-06-24T00:00:00.000Z',
}

const workspace: Workspace = {
  id: 'ws_1',
  name: 'repo',
  repoPath: '/repo',
  gitRoot: '/repo',
  currentBranch: 'main',
  currentCommit: 'a'.repeat(40),
  createdAt: '2026-06-24T00:00:00.000Z',
  updatedAt: '2026-06-24T00:00:00.000Z',
}

describe('cli output phase 12', () => {
  it('formats task created hint', () => {
    expect(formatTaskCreatedHint(task)).toContain(
      'forgeagent task watch task_1',
    )
  })

  it('formats task completed hint', () => {
    expect(formatTaskCompletedHint('task_1')).toContain(
      'isolated task worktree',
    )
    expect(formatTaskCompletedHint('task_1')).toContain(
      'forgeagent task apply task_1',
    )
  })

  it('formats task applied hint', () => {
    expect(formatTaskAppliedHint(workspace)).toContain('/repo')
    expect(formatTaskAppliedHint(workspace)).toContain('git diff')
  })

  it('prints completion hint for task.completed event', () => {
    const event: TaskEvent = {
      id: 'evt_1',
      taskId: 'task_1',
      type: 'task.completed',
      payload: {},
      createdAt: '2026-06-24T00:00:00.000Z',
    }

    const output = formatTaskEvent(event)

    expect(output).toContain('original repository has not changed yet')
  })
})
