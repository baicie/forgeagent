import type { Approval, Task } from '@forgeagent/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import type { GitDiffService } from '../git/diff'
import type { GitRepositoryService } from '../git/repository'
import type { GitWorktreeService } from '../git/worktree'
import { ApprovalService } from '../services/approvalService'
import { AuditService } from '../services/auditService'
import { EventService } from '../services/eventService'
import { TaskService } from '../services/taskService'
import type { WorkspaceService } from '../services/workspaceService'
import { ApprovalGate } from './approvalGate'
import { CommandPolicy } from './commandPolicy'
import { ShellExecutor } from './shellExecutor'

async function createFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-approval-gate-'))
  const worktreePath = join(tempDir, 'worktree')

  await mkdir(worktreePath, { recursive: true })

  const task: Task = {
    id: 'task_1',
    workspaceId: 'ws_1',
    prompt: 'test',
    status: 'waiting_approval',
    baseBranch: 'main',
    baseCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    worktreePath,
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }

  const db = createInMemoryRunnerDb({
    workspaces: [
      {
        id: 'ws_1',
        name: 'repo',
        repoPath: worktreePath,
        gitRoot: worktreePath,
        currentBranch: 'main',
        currentCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ],
    tasks: [task],
    events: [],
    approvals: [],
    audits: [],
  })

  const workspaceService = {
    get: () => db.state.workspaces[0],
  } as unknown as WorkspaceService

  const gitRepositoryService = {
    getRepositoryInfo: () => Promise.resolve({}),
  } as unknown as GitRepositoryService

  const gitWorktreeService = {
    create: () => Promise.resolve({ worktreePath: '', branchName: '' }),
    discard: () => Promise.resolve(),
  } as unknown as GitWorktreeService

  const gitDiffService = {
    getDiff: () => Promise.resolve(''),
  } as unknown as GitDiffService

  const eventService = new EventService(db)
  const auditService = new AuditService(db)
  const taskService = new TaskService(
    db,
    loadRunnerConfig({
      dataDir: tempDir,
    }),
    workspaceService,
    gitRepositoryService,
    gitWorktreeService,
    gitDiffService,
    eventService,
    auditService,
  )
  const approvalService = new ApprovalService(db, eventService, auditService)
  const approvalGate = new ApprovalGate({
    approvalService,
    taskService,
    eventService,
    auditService,
    shellExecutor: new ShellExecutor(),
    commandPolicy: new CommandPolicy(),
  })

  async function createApproval(command: string): Promise<Approval> {
    return approvalService.create({
      taskId: task.id,
      toolCallId: 'tool_1',
      command,
      cwd: worktreePath,
      reason: 'verify',
      risk: new CommandPolicy().evaluate(command).risk,
    })
  }

  return {
    tempDir,
    worktreePath,
    db,
    task,
    taskService,
    approvalService,
    approvalGate,
    createApproval,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}

describe('approvalGate', () => {
  it('executes command only after approval and streams output events', async () => {
    const fixture = await createFixture()

    try {
      const approval = await fixture.createApproval(
        `node -e "console.log('approval-ok')"`,
      )

      expect(fixture.approvalService.get(approval.id).status).toBe('pending')

      const response = await fixture.approvalGate.approve(approval.id)

      expect(response.approval.status).toBe('approved')
      expect(response.result.ok).toBe(true)
      expect(response.result.stdout).toContain('approval-ok')
      expect(fixture.taskService.get(fixture.task.id).status).toBe('running')

      expect(fixture.db.state.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'approval.resolved',
          }),
          expect.objectContaining({
            type: 'tool.started',
          }),
          expect.objectContaining({
            type: 'tool.output',
            payload: expect.objectContaining({
              stream: 'stdout',
              chunk: expect.stringContaining('approval-ok'),
            }),
          }),
          expect.objectContaining({
            type: 'tool.finished',
            payload: expect.objectContaining({
              ok: true,
            }),
          }),
        ]),
      )

      expect(fixture.db.state.audits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'command.started',
          }),
          expect.objectContaining({
            type: 'command.finished',
          }),
        ]),
      )
    } finally {
      await fixture.cleanup()
    }
  }, 20000)

  it('returns rejected tool result without executing command', async () => {
    const fixture = await createFixture()

    try {
      const approval = await fixture.createApproval(
        `node -e "console.log('should-not-run')"`,
      )

      const response = await fixture.approvalGate.reject(
        approval.id,
        'user rejected',
      )

      expect(response.approval.status).toBe('rejected')
      expect(response.result).toMatchObject({
        ok: false,
        rejected: true,
        approvalId: approval.id,
        reason: 'user rejected',
      })
      expect(fixture.taskService.get(fixture.task.id).status).toBe('running')

      const outputEvents = fixture.db.state.events.filter(
        event => event.type === 'tool.output',
      )

      expect(outputEvents).toEqual([])

      expect(fixture.db.state.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'approval.resolved',
            payload: expect.objectContaining({
              status: 'rejected',
            }),
          }),
          expect.objectContaining({
            type: 'tool.finished',
            payload: expect.objectContaining({
              rejected: true,
            }),
          }),
        ]),
      )
    } finally {
      await fixture.cleanup()
    }
  }, 20000)

  it('keeps dangerous command risk metadata as red', async () => {
    const fixture = await createFixture()

    try {
      const approval = await fixture.createApproval('rm -rf dist')
      const response = await fixture.approvalGate.approve(approval.id)

      expect(response.policy.risk).toBe('dangerous')
      expect(response.policy.riskColor).toBe('red')
    } finally {
      await fixture.cleanup()
    }
  }, 20000)

  it('blocks approval command cwd outside task worktree', async () => {
    const fixture = await createFixture()

    try {
      const approval = await fixture.approvalService.create({
        taskId: fixture.task.id,
        toolCallId: 'tool_1',
        command: 'echo bad',
        cwd: join(fixture.worktreePath, '..'),
        reason: 'bad cwd',
        risk: 'low',
      })

      await expect(
        fixture.approvalGate.approve(approval.id),
      ).rejects.toMatchObject({
        code: 'PATH_ESCAPE_DETECTED',
      })
    } finally {
      await fixture.cleanup()
    }
  }, 20000)
})
