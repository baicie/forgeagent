import type { Approval, Task } from '@forgeagent/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ForgeAgentLoop } from '../agent/loop'
import { OpenAICompatibleModelGateway } from '../agent/model'
import { loadRunnerConfig } from '../config'
import { createInMemoryRunnerDb } from '../db'
import { createRunnerServer } from '../server'

async function createApprovalServerFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'forgeagent-approval-route-'))
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

  const app = await createRunnerServer({
    config: loadRunnerConfig({
      dataDir: tempDir,
    }),
    db,
  })

  app.forgeagent.agentLoop = new ForgeAgentLoop(
    app.forgeagent,
    new OpenAICompatibleModelGateway(
      {
        baseUrl: 'http://model.test/v1',
        model: 'test-model',
      },
      async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '',
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  message: 'Task resumed after approval',
                  final: true,
                }),
              },
            },
          ],
        }),
      }),
    ),
  )

  async function createApproval(command: string): Promise<Approval> {
    return app.forgeagent.approvalService.create({
      taskId: task.id,
      toolCallId: 'tool_1',
      command,
      cwd: worktreePath,
      reason: 'verify',
      risk: app.forgeagent.commandPolicy.evaluate(command).risk,
    })
  }

  return {
    app,
    db,
    task,
    tempDir,
    createApproval,
    async cleanup() {
      await app.close()
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}

describe('approval routes', () => {
  it('approves, executes, and resumes a pending task', async () => {
    const fixture = await createApprovalServerFixture()

    try {
      const approval = await fixture.createApproval(
        `node -e ""`,
      )

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/approvals/${approval.id}/approve`,
      })

      expect(response.statusCode).toBe(200)

      const body = response.json()

      expect(body.approval.status).toBe('approved')
      expect(body.result.ok).toBe(true)
      expect(body.result.stdout).toBe('')
      expect(fixture.app.forgeagent.taskService.get(fixture.task.id).status).toBe(
        'completed',
      )

      expect(fixture.db.state.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'tool.finished',
          }),
          expect.objectContaining({
            type: 'task.completed',
          }),
        ]),
      )
      expect(
        fixture.db.state.events.filter(event => event.type === 'tool.output'),
      ).toEqual([])
    } finally {
      await fixture.cleanup()
    }
  }, 20000)

  it('rejects without executing a pending command', async () => {
    const fixture = await createApprovalServerFixture()

    try {
      const approval = await fixture.createApproval(
        `node -e "console.log('should-not-run')"`,
      )

      const response = await fixture.app.inject({
        method: 'POST',
        url: `/api/approvals/${approval.id}/reject`,
        payload: {
          reason: 'not needed',
        },
      })

      expect(response.statusCode).toBe(200)

      const body = response.json()

      expect(body.approval.status).toBe('rejected')
      expect(body.result.rejected).toBe(true)
      expect(body.result.reason).toBe('not needed')
      expect(fixture.app.forgeagent.taskService.get(fixture.task.id).status).toBe(
        'completed',
      )

      expect(
        fixture.db.state.events.filter(event => event.type === 'tool.output'),
      ).toEqual([])
      expect(fixture.db.state.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'task.completed',
          }),
        ]),
      )
    } finally {
      await fixture.cleanup()
    }
  }, 20000)
})
