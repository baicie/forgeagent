import type { Workspace } from '@forgeagent/core'
import type { AgentToolName } from './json'
import type { RunnerToolContext } from './tools/types'
import { loadRunnerConfig } from '../config'
import type { RunnerContext } from '../context'
import { createInMemoryRunnerDb } from '../db'
import type { GitDiffService } from '../git/diff'
import type { GitRepositoryService } from '../git/repository'
import type { GitWorktreeService } from '../git/worktree'
import { ApprovalGate } from '../shell/approvalGate'
import { CommandPolicy } from '../shell/commandPolicy'
import { ShellExecutor } from '../shell/shellExecutor'
import { ApprovalService } from '../services/approvalService'
import { AuditService } from '../services/auditService'
import { EventService } from '../services/eventService'
import { TaskService } from '../services/taskService'
import type { WorkspaceService } from '../services/workspaceService'
import type { ModelGenerateInput } from './model'
import { OpenAICompatibleModelGateway } from './model'

const { ForgeAgentLoop } = await import('./loop')

class TestableForgeAgentLoop extends ForgeAgentLoop {
  private mockTool: (
    ctx: RunnerToolContext,
    name: AgentToolName,
    args: unknown,
  ) => Promise<unknown>

  constructor(
    runner: RunnerContext,
    model: unknown,
    options: Record<string, unknown>,
    mockTool: (
      ctx: RunnerToolContext,
      name: AgentToolName,
      args: unknown,
    ) => Promise<unknown>,
  ) {
    super(runner, model as any, options as any)
    this.mockTool = mockTool
  }

  protected override async _dispatchTool(
    context: RunnerToolContext,
    toolName: AgentToolName,
    args: unknown,
  ): Promise<unknown> {
    return this.mockTool(context, toolName, args)
  }
}

class FakeModelGateway extends OpenAICompatibleModelGateway {
  private index = 0

  constructor(private readonly outputs: string[]) {
    super({
      baseUrl: 'http://localhost/v1',
      model: 'fake',
    })
  }

  override async generate(
    _input: ModelGenerateInput,
  ): Promise<{ content: string; raw?: unknown }> {
    const output = this.outputs[this.index] ?? this.outputs.at(-1) ?? ''
    this.index += 1

    return { content: output }
  }
}

type ToolMock = (
  ctx: RunnerToolContext,
  name: AgentToolName,
  args: unknown,
) => Promise<unknown>

function createLoopFixture(
  outputs: string[],
  options: Record<string, unknown> = {},
  toolMock?: ToolMock,
) {
  const workspace: Workspace = {
    id: 'ws_1',
    name: 'repo',
    repoPath: '/repo',
    gitRoot: '/repo',
    currentBranch: 'main',
    currentCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
  }

  const db = createInMemoryRunnerDb({
    workspaces: [workspace],
    tasks: [],
    events: [],
    approvals: [],
    audits: [],
  })

  const workspaceService = {
    get: vi.fn(() => workspace),
  } as unknown as WorkspaceService

  const gitRepositoryService = {
    getRepositoryInfo: vi.fn(async () => ({
      repoPath: '/repo',
      gitRoot: '/repo',
      currentBranch: 'main',
      currentCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      isDirty: false,
    })),
  } as unknown as GitRepositoryService

  const gitWorktreeService = {
    create: vi.fn(async input => ({
      worktreePath: `${input.dataDir}/worktrees/${input.taskId}`,
      branchName: `forgeagent/task-${input.taskId}`,
    })),
    discard: vi.fn(async () => {}),
  } as unknown as GitWorktreeService

  const gitDiffService = {
    getDiff: vi.fn(async () => 'diff --git a/README.md b/README.md\n'),
  } as unknown as GitDiffService

  const eventService = new EventService(db)
  const auditService = new AuditService(db)
  const config = loadRunnerConfig({
    dataDir: '/tmp/forgeagent-loop-test',
  })

  const taskService = new TaskService(
    db,
    config,
    workspaceService,
    gitRepositoryService,
    gitWorktreeService,
    gitDiffService,
    eventService,
    auditService,
  )

  const approvalService = new ApprovalService(db, eventService, auditService)

  const commandPolicy = new CommandPolicy()
  const shellExecutor = new ShellExecutor()

  const runner = {
    config,
    db,
    modelGateway: new FakeModelGateway(outputs),
    agentLoop: undefined,
    gitClient: undefined,
    gitRepositoryService,
    gitWorktreeService,
    gitDiffService,
    gitPatchService: undefined,
    shellExecutor,
    commandPolicy,
    approvalGate: undefined,
    workspaceService,
    taskService,
    eventService,
    approvalService,
    auditService,
  } as unknown as RunnerContext

  runner.approvalGate = new ApprovalGate({
    approvalService,
    taskService,
    eventService,
    auditService,
    shellExecutor,
    commandPolicy,
  })

  async function defaultTool(
    ctx: RunnerToolContext,
    toolName: AgentToolName,
    args: unknown,
  ) {
    const {
      listFilesTool,
      readFileTool,
      searchTextTool,
      applyPatchTool,
      getDiffTool,
      runCommandTool,
    } = await import('./tools')

    if (toolName === 'list_files') return listFilesTool(ctx, args)
    if (toolName === 'read_file') return readFileTool(ctx, args)
    if (toolName === 'search_text') return searchTextTool(ctx, args)
    if (toolName === 'apply_patch') return applyPatchTool(ctx, args)
    if (toolName === 'get_diff') return getDiffTool(ctx, args)
    if (toolName === 'run_command') return runCommandTool(ctx, args)
    throw new Error(`Unknown tool: ${String(toolName)}`)
  }

  const loop = new TestableForgeAgentLoop(
    runner,
    runner.modelGateway,
    options,
    toolMock ?? defaultTool,
  )

  return {
    db,
    loop,
    taskService,
  }
}

/* eslint-disable-next-line test/prefer-lowercase-title */
describe('ForgeAgentLoop', () => {
  it('completes when model returns final output', async () => {
    const { db, loop, taskService } = createLoopFixture([
      JSON.stringify({
        message: '修复完成',
        final: true,
        summary: {
          changes: ['没有修改，只完成验证'],
          tests: ['未执行测试'],
          risks: ['无'],
          nextSteps: ['继续完善'],
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'say done',
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('completed')
    expect(taskService.get(task.id).status).toBe('completed')
    expect(result.finalMessage).toContain('没有修改，只完成验证')

    expect(db.state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'agent.message' }),
        expect.objectContaining({ type: 'task.completed' }),
      ]),
    )
  })

  it('retries when model returns invalid JSON', async () => {
    const { db, loop, taskService } = createLoopFixture([
      'not-json',
      JSON.stringify({
        message: '修复完成',
        final: true,
        summary: {
          changes: ['已重试并完成'],
          tests: [],
          risks: [],
          nextSteps: [],
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix json',
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('completed')
    expect(
      db.state.events.some(
        event =>
          event.type === 'agent.message' &&
          JSON.stringify(event.payload).includes('Model JSON parse failed'),
      ),
    ).toBe(true)
  })

  it('fails when exceeding maxSteps', async () => {
    const { loop, taskService } = createLoopFixture(
      [
        JSON.stringify({
          message: '继续看 diff',
          action: {
            name: 'get_diff',
            args: {},
          },
        }),
      ],
      {
        maxSteps: 2,
      },
    )

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'never finish',
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('failed')
    expect(taskService.get(task.id).status).toBe('failed')
    expect(result.finalMessage).toContain('exceeded maxSteps')
  })

  it('executes tool action and continues to final', async () => {
    const { db, loop, taskService } = createLoopFixture([
      JSON.stringify({
        message: '先看 diff',
        action: {
          name: 'get_diff',
          args: {},
        },
      }),
      JSON.stringify({
        message: '完成',
        final: true,
        summary: {
          changes: ['读取了 diff'],
          tests: [],
          risks: [],
          nextSteps: [],
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'check diff',
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('completed')
    expect(db.state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool.started',
          payload: expect.objectContaining({
            toolName: 'get_diff',
          }),
        }),
        expect.objectContaining({
          type: 'tool.finished',
          payload: expect.objectContaining({
            toolName: 'get_diff',
          }),
        }),
      ]),
    )
  })

  it('pauses when run_command requests approval', async () => {
    let taskId = ''

    const { loop, taskService } = createLoopFixture(
      [
        JSON.stringify({
          message: '需要执行测试',
          action: {
            name: 'run_command',
            args: {
              command: 'pnpm test',
              reason: '验证修改',
            },
          },
        }),
      ],
      {},
      async (_ctx, toolName) => {
        if (toolName === 'run_command') {
          await taskService.waitForApproval(taskId, 'Command requires approval')
          return {
            approvalId: 'approval_mock',
            status: 'waiting_approval',
            risk: 'low',
            command: 'pnpm test',
            cwd: '/tmp/worktree',
          }
        }

        throw new Error(`Unexpected tool: ${String(toolName)}`)
      },
    )

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'run tests',
    })

    taskId = task.id

    const result = await loop.run(task.id)

    expect(result.status).toBe('waiting_approval')
    expect(taskService.get(task.id).status).toBe('waiting_approval')
  })

  it('marks task as failed when JSON parsing still fails after retries', async () => {
    const { loop, taskService } = createLoopFixture(['not-json'], {
      jsonRetryLimit: 1,
    })

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'bad json',
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('failed')
    expect(taskService.get(task.id).status).toBe('failed')
    expect(result.finalMessage).toContain('Invalid JSON')
  })

  it('marks task as failed when tool execution throws', async () => {
    const { db, loop, taskService } = createLoopFixture(
      [
        JSON.stringify({
          message: '读一个不存在文件',
          action: {
            name: 'read_file',
            args: {
              path: 'missing.ts',
            },
          },
        }),
      ],
      {},
      async () => {
        throw new Error('tool failed')
      },
    )

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'tool fail',
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('failed')
    expect(taskService.get(task.id).status).toBe('failed')

    expect(db.state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool.finished',
          payload: expect.objectContaining({
            error: 'tool failed',
          }),
        }),
        expect.objectContaining({
          type: 'task.failed',
        }),
      ]),
    )
  })

  it('includes task event history when resuming after approval', async () => {
    const { db, loop, taskService } = createLoopFixture([
      JSON.stringify({
        message: '继续完成',
        final: true,
        summary: {
          changes: ['基于历史事件继续完成'],
          tests: ['看到历史中的测试输出'],
          risks: [],
          nextSteps: [],
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'resume',
    })

    await db.state.events.push({
      id: 'evt_history_1',
      taskId: task.id,
      type: 'tool.finished',
      payload: {
        toolName: 'run_command',
        ok: true,
        result: {
          stdout: 'test passed',
        },
      },
      createdAt: '2026-06-22T00:00:00.000Z',
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('completed')
    expect(result.finalMessage).toContain('看到历史中的测试输出')
  })
})
