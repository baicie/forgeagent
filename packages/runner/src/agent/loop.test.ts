import type { Workspace } from '@forgeagent/core'
import type { RunnerToolContext } from './tools/types'
import { ToolRegistry } from './tools/registry'
import { loadRunnerConfig } from '../config'
import type { RunnerContext } from '../context'
import { createInMemoryRunnerDb } from '../db'
import type { GitDiffService } from '../git/diff'
import type { GitRepositoryService } from '../git/repository'
import type { GitWorktreeService } from '../git/worktree'
import type { GitPatchService } from '../git/patch'
import type { GitCommitService } from '../git/commit'
import { ApprovalGate } from '../shell/approvalGate'
import { CommandPolicy } from '../shell/commandPolicy'
import { ShellExecutor } from '../shell/shellExecutor'
import { ApprovalService } from '../services/approvalService'
import { AuditService } from '../services/auditService'
import { EventService } from '../services/eventService'
import { TaskMemoryService } from '../services/taskMemoryService'
import { TaskService } from '../services/taskService'
import type { WorkspaceService } from '../services/workspaceService'
import type { ModelGenerateInput } from './model'
import { OpenAICompatibleModelGateway } from './model'
import { ContextPackBuilder } from '../context/contextPackBuilder'

const { ForgeAgentLoop } = await import('./loop')

class FakeModelGateway extends OpenAICompatibleModelGateway {
  private index = 0
  readonly inputs: ModelGenerateInput[] = []

  constructor(private readonly outputs: string[]) {
    super({
      baseUrl: 'http://localhost/v1',
      model: 'fake',
    })
  }

  override async generate(
    input: ModelGenerateInput,
  ): Promise<{ content: string; raw?: unknown }> {
    this.inputs.push(input)

    const output = this.outputs[this.index] ?? this.outputs.at(-1) ?? ''
    this.index += 1

    return { content: output }
  }
}

function createLoopFixture(
  outputs: string[],
  options: Record<string, unknown> = {},
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

  const gitPatchService = {
    createPatchFromWorktree: vi.fn(async () => ({
      patchFile: '/tmp/patch.patch',
      diff: 'diff',
      bytes: 4,
    })),
  } as unknown as GitPatchService

  const gitCommitService = {
    commitWorktree: vi.fn(async () => ({
      commitSha: 'a'.repeat(40),
      message: 'test',
    })),
  } as unknown as GitCommitService

  const eventService = new EventService(db)
  const auditService = new AuditService(db)
  const config = loadRunnerConfig({
    dataDir: '/tmp/forgeagent-loop-test',
  })

  const taskMemoryService = new TaskMemoryService(config, eventService)
  const contextPackBuilder = new ContextPackBuilder(
    config,
    taskMemoryService,
    gitDiffService,
  )

  const taskService = new TaskService(
    db,
    config,
    workspaceService,
    gitRepositoryService,
    gitWorktreeService,
    gitDiffService,
    gitPatchService,
    gitCommitService,
    eventService,
    auditService,
    undefined,
    undefined,
    taskMemoryService,
  )

  const approvalService = new ApprovalService(db, eventService, auditService)

  const commandPolicy = new CommandPolicy()
  const shellExecutor = new ShellExecutor()

  const toolRegistry = new ToolRegistry()

  const runner = {
    config,
    db,
    modelGateway: undefined,
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
    taskMemoryService,
    contextPackBuilder,
    toolRegistry,
  } as unknown as RunnerContext

  runner.approvalGate = new ApprovalGate({
    approvalService,
    taskService,
    eventService,
    auditService,
    shellExecutor,
    commandPolicy,
    taskMemoryService,
  })

  const fakeModelGateway = new FakeModelGateway(outputs)

  const loop = new ForgeAgentLoop(runner, fakeModelGateway, options as any)

  return {
    db,
    loop,
    taskService,
    runner,
    modelGateway: fakeModelGateway,
    contextPackBuilder,
    toolRegistry,
  }
}

function registerMockTool(
  registry: ToolRegistry,
  toolName: string,
  handler: (ctx: RunnerToolContext, args: unknown) => Promise<unknown>,
) {
  // Patch the handler directly on the already-registered tool entry.
  // This avoids "already registered" errors while keeping the descriptor intact.
  const tools = registry as unknown as {
    tools: Map<
      string,
      {
        handler?: (ctx: RunnerToolContext, args: unknown) => Promise<unknown>
      }
    >
  }
  const tool = tools.tools.get(toolName)
  if (tool) {
    tool.handler = handler
  } else {
    registry.register({
      descriptor: {
        name: toolName,
        source: 'core',
        type:
          toolName === 'run_command'
            ? 'execute'
            : toolName === 'apply_patch'
              ? 'write'
              : 'read',
        permission:
          toolName === 'run_command' ? 'requires_approval' : 'allowed',
        requiresApproval: toolName === 'run_command',
        modelCallable: true,
      },
      handler: handler as unknown as Parameters<
        typeof ToolRegistry.prototype.register
      >[0]['handler'],
    })
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
    const { loop, taskService, toolRegistry } = createLoopFixture(
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

    registerMockTool(
      toolRegistry,
      'get_diff',
      async () => 'diff --git a/README.md\n',
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
    const { db, loop, taskService, toolRegistry } = createLoopFixture([
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

    registerMockTool(
      toolRegistry,
      'get_diff',
      async () => 'diff --git a/README.md\n',
    )

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

  it('emits structured tool metadata through ToolRegistry', async () => {
    const { loop, taskService, toolRegistry, runner } = createLoopFixture([
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

    registerMockTool(
      toolRegistry,
      'get_diff',
      async () => 'diff --git a/README.md\n',
    )

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'check diff',
    })

    await loop.run(task.id)

    const events = runner.eventService.listTaskEvents(task.id)
    const started = events.find(event => event.type === 'tool.started')
    const payload = started?.payload as Record<string, unknown>

    expect(payload.source).toBe('core')
    expect(payload.permission).toBe('allowed')
    expect(payload.requiresApproval).toBe(false)
    expect(payload.type).toBe('read')
  })

  it('pauses when run_command requests approval', async () => {
    let taskId = ''

    const { loop, taskService, toolRegistry } = createLoopFixture([
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
    ])

    registerMockTool(toolRegistry, 'run_command', async (_ctx, _args) => {
      await taskService.waitForApproval(taskId, 'Command requires approval')
      return {
        approvalId: 'approval_mock',
        status: 'waiting_approval',
        risk: 'low',
        command: 'pnpm test',
        cwd: '/tmp/worktree',
      }
    })

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
    const { db, loop, taskService, toolRegistry } = createLoopFixture([
      JSON.stringify({
        message: '读一个不存在文件',
        action: {
          name: 'read_file',
          args: {
            path: 'missing.ts',
          },
        },
      }),
    ])

    registerMockTool(toolRegistry, 'read_file', async () => {
      throw new Error('tool failed')
    })

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

  it('records agent steps, findings and final summary into task memory', async () => {
    const { loop, taskService, runner, toolRegistry } = createLoopFixture(
      [
        JSON.stringify({
          message: '先搜索错误',
          action: {
            name: 'search_text',
            args: {
              query: 'Git command failed',
            },
          },
        }),
        JSON.stringify({
          message: '完成',
          final: true,
          summary: {
            changes: ['记录了搜索发现'],
            tests: ['未执行测试'],
            risks: ['无'],
            nextSteps: ['查看 memory'],
          },
        }),
      ],
      {},
    )

    registerMockTool(toolRegistry, 'search_text', async () => ({
      matches: [
        {
          path: 'packages/runner/src/git/diff.ts',
          line: 10,
          text: 'Git command failed',
        },
      ],
      truncated: false,
    }))

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'find git error',
    })

    await runner.taskMemoryService.deleteTaskMemory(task.id).catch(() => {})

    const result = await loop.run(task.id)

    expect(result.status).toBe('completed')

    const progress = await runner.taskMemoryService.readTaskMemoryFile(
      task.id,
      'progress.md',
    )
    const findings = await runner.taskMemoryService.readTaskMemoryFile(
      task.id,
      'findings.md',
    )
    const finalSummary = await runner.taskMemoryService.readTaskMemoryFile(
      task.id,
      'final_summary.md',
    )

    expect(progress.content).toContain('Agent step 1')
    expect(findings.content).toContain('Search: Git command failed')
    expect(finalSummary.content).toContain('记录了搜索发现')
  })

  it('builds context pack before model generation', async () => {
    const { loop, taskService, runner, modelGateway } = createLoopFixture([
      JSON.stringify({
        message: '完成',
        final: true,
        summary: {
          changes: ['no changes'],
          tests: ['not run'],
          risks: ['none'],
          nextSteps: ['review context pack'],
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix runner diff error',
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('completed')

    const contextPack = await runner.taskMemoryService.readTaskMemoryFile(
      task.id,
      'context_pack.md',
    )

    expect(contextPack.content).toContain('# Context Pack')
    expect(contextPack.content).toContain('fix runner diff error')

    const firstInput = modelGateway.inputs[0]
    const serializedMessages = JSON.stringify(firstInput.messages)

    expect(serializedMessages).toContain('Context Pack')
    expect(serializedMessages).toContain('Project Rules')
  })
})
