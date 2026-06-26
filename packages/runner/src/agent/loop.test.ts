import type { Workspace } from '@forgeagent/core'
import { mkdir } from 'node:fs/promises'
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
import { ValidationService } from '../validation/validationService'
import { WorkflowService } from '../workflow/workflowService'
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

  const validationService = new ValidationService(
    approvalService,
    eventService,
    taskMemoryService,
  )

  const workflowService = new WorkflowService(workspaceService, eventService)

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
    validationService,
    workflowService,
  } as unknown as RunnerContext

  runner.approvalGate = new ApprovalGate({
    approvalService,
    taskService,
    eventService,
    auditService,
    shellExecutor,
    commandPolicy,
    taskMemoryService,
    validationService,
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
    validationService,
    workflowService,
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

  it('keeps run_command toolCallId consistent between registry and approval', async () => {
    let taskId = ''

    const { loop, taskService, runner, toolRegistry } = createLoopFixture([
      JSON.stringify({
        message: '运行测试',
        action: {
          name: 'run_command',
          args: {
            command: 'echo ok',
            cwd: '.',
            reason: 'verify',
          },
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'run tests',
    })

    taskId = task.id

    // Ensure the mocked worktree path exists so commandPolicy.resolveCwd
    // does not throw WORKSPACE_NOT_FOUND.
    await mkdir(task.worktreePath, { recursive: true })

    registerMockTool(toolRegistry, 'run_command', async (_ctx, args) => {
      const recordToolCallId = (args as { toolCallId?: string }).toolCallId
      const created = await runner.approvalService.create({
        taskId: taskService.get(taskId).id,
        toolCallId: recordToolCallId ?? `tool_${Date.now().toString(36)}`,
        command: 'echo ok',
        cwd: '.',
        reason: 'verify',
        risk: 'low',
      })
      await taskService.waitForApproval(taskId, 'Command requires approval')
      return {
        approvalId: created.id,
        status: 'waiting_approval',
        risk: created.risk,
        command: created.command,
        cwd: created.cwd,
      }
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('waiting_approval')

    const events = runner.eventService.listTaskEvents(task.id)
    const started = events.find(event => event.type === 'tool.started')
    const approval = runner.approvalService.list()[0]

    expect(started?.payload).toMatchObject({
      toolName: 'run_command',
      source: 'core',
      permission: 'requires_approval',
      approvalStatus: 'pending',
    })

    expect((started?.payload as { toolCallId?: string }).toolCallId).toBe(
      approval.toolCallId,
    )
  })

  it('emits approved run_command events with the same toolCallId', async () => {
    let taskId = ''

    const { loop, taskService, runner, toolRegistry } = createLoopFixture([
      JSON.stringify({
        message: '运行测试',
        action: {
          name: 'run_command',
          args: {
            command: 'echo ok',
            cwd: '.',
            reason: 'verify',
          },
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'run tests',
    })

    taskId = task.id

    // Ensure the mocked worktree path exists so commandPolicy.resolveCwd
    // does not throw WORKSPACE_NOT_FOUND.
    await mkdir(task.worktreePath, { recursive: true })

    registerMockTool(toolRegistry, 'run_command', async (_ctx, args) => {
      const recordToolCallId = (args as { toolCallId?: string }).toolCallId
      const created = await runner.approvalService.create({
        taskId: taskService.get(taskId).id,
        toolCallId: recordToolCallId ?? `tool_${Date.now().toString(36)}`,
        command: 'echo ok',
        cwd: '.',
        reason: 'verify',
        risk: 'low',
      })
      await taskService.waitForApproval(taskId, 'Command requires approval')
      return {
        approvalId: created.id,
        status: 'waiting_approval',
        risk: created.risk,
        command: created.command,
        cwd: created.cwd,
      }
    })

    await loop.run(task.id)

    const approval = runner.approvalService.list()[0]
    await runner.approvalGate.approve(approval.id)

    const events = runner.eventService.listTaskEvents(task.id)
    const runEvents = events.filter(event => {
      const payload = event.payload as { toolName?: string }
      return payload.toolName === 'run_command'
    })

    const toolCallIds = runEvents
      .map(event => (event.payload as { toolCallId?: string }).toolCallId)
      .filter(Boolean)

    expect(new Set(toolCallIds).size).toBe(1)
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

  // Phase 15: Validation Feedback Loop tests

  it('requires get_diff before final after apply_patch', async () => {
    const { loop, taskService } = createLoopFixture([
      JSON.stringify({
        message: '修改文件',
        action: {
          name: 'apply_patch',
          args: {
            changes: [
              {
                type: 'write_file',
                path: 'README.md',
                content: 'hello',
              },
            ],
          },
        },
      }),
      JSON.stringify({
        message: '完成',
        final: true,
        summary: {
          changes: ['updated readme'],
          tests: [],
          risks: [],
          nextSteps: [],
        },
      }),
      JSON.stringify({
        message: '查看 diff',
        action: {
          name: 'get_diff',
          args: {},
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'update readme',
    })

    await loop.run(task.id)

    // The loop should intercept final and ask for get_diff, then continue
    const finalStatus = taskService.get(task.id).status
    expect(finalStatus).not.toBe('completed')
  })

  it('requests validation approval before final when has validation commands', async () => {
    const { loop, taskService, runner } = createLoopFixture([
      JSON.stringify({
        message: '修改文件',
        action: {
          name: 'apply_patch',
          args: {
            changes: [
              {
                type: 'write_file',
                path: 'README.md',
                content: 'hello',
              },
            ],
          },
        },
      }),
      JSON.stringify({
        message: '查看 diff',
        action: {
          name: 'get_diff',
          args: {},
        },
      }),
      JSON.stringify({
        message: '完成',
        final: true,
        summary: {
          changes: ['updated readme'],
          tests: [],
          risks: [],
          nextSteps: [],
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'update readme',
      validation: {
        commands: ['pnpm typecheck'],
        maxFixAttempts: 2,
      },
    })

    await mkdir(task.worktreePath, { recursive: true })

    const result = await loop.run(task.id)

    expect(result.status).toBe('waiting_approval')
    expect(runner.approvalService.list()[0].command).toBe('pnpm typecheck')

    const validation = runner.validationService.getPlan(task.id)
    expect(validation?.status).toBe('waiting_approval')
  })

  it('feeds validation failure back to model', async () => {
    const { loop, taskService, runner, modelGateway } = createLoopFixture([
      JSON.stringify({
        message: '继续修复',
        action: {
          name: 'search_text',
          args: {
            query: 'Type error',
          },
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix type error',
      validation: {
        commands: ['pnpm typecheck'],
        maxFixAttempts: 2,
      },
    })

    await mkdir(task.worktreePath, { recursive: true })

    const plan = await runner.validationService.createPlan({
      task,
      taskValidation: {
        commands: ['pnpm typecheck'],
        maxFixAttempts: 2,
      },
    })

    const waiting = await runner.validationService.requestNextValidation({
      task,
      plan,
    })

    await runner.validationService.recordCommandResult({
      taskId: task.id,
      command: 'pnpm typecheck',
      cwd: task.worktreePath,
      ok: false,
      approvalId: waiting.results[0].approvalId,
      exitCode: 1,
      stderr: 'Type error: missing property',
    })

    await loop.run(task.id)

    const messages = JSON.stringify(modelGateway.inputs[0].messages)
    expect(messages).toContain('验证失败')
    expect(messages).toContain('Type error')
  })

  it('records approved validation command result into validation plan', async () => {
    const { loop, taskService, runner } = createLoopFixture([
      JSON.stringify({
        message: '修改',
        action: {
          name: 'apply_patch',
          args: {
            changes: [
              { type: 'write_file', path: 'README.md', content: 'hello' },
            ],
          },
        },
      }),
      JSON.stringify({
        message: 'diff',
        action: { name: 'get_diff', args: {} },
      }),
      JSON.stringify({
        message: 'done',
        final: true,
        summary: { changes: ['x'], tests: [], risks: [], nextSteps: [] },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'x',
      validation: {
        commands: ['echo ok'],
      },
    })

    await mkdir(task.worktreePath, { recursive: true })

    await loop.run(task.id)

    const approval = runner.approvalService.list()[0]

    await runner.approvalGate.approve(approval.id)

    const plan = runner.validationService.getPlan(task.id)

    expect(plan?.results[0].status).toBe('passed')
  })

  it('continues validation commands across runs after first command passed', async () => {
    const { loop, taskService, runner } = createLoopFixture([
      JSON.stringify({
        message: 'final',
        final: true,
        summary: {
          changes: ['x'],
          tests: [],
          risks: [],
          nextSteps: [],
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'x',
      validation: {
        commands: ['pnpm typecheck', 'pnpm test:run'],
        maxFixAttempts: 2,
      },
    })

    await mkdir(task.worktreePath, { recursive: true })

    const plan = await runner.validationService.createPlan({
      task,
      taskValidation: task.validation,
    })

    const waiting = await runner.validationService.requestNextValidation({
      task,
      plan,
    })

    await runner.validationService.recordCommandResult({
      taskId: task.id,
      command: 'pnpm typecheck',
      cwd: task.worktreePath,
      ok: true,
      approvalId: waiting.results[0].approvalId,
      exitCode: 0,
    })

    const result = await loop.run(task.id)

    expect(result.status).toBe('waiting_approval')
    expect(runner.approvalService.list().at(-1)?.command).toBe('pnpm test:run')
  })

  it('does not request validation again after failure until a new patch is applied', async () => {
    const { loop, taskService, runner } = createLoopFixture([
      JSON.stringify({
        message: '直接完成',
        final: true,
        summary: {
          changes: [],
          tests: [],
          risks: [],
          nextSteps: [],
        },
      }),
      JSON.stringify({
        message: '搜索失败',
        action: {
          name: 'search_text',
          args: { query: 'Type error' },
        },
      }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'fix type error',
      validation: {
        commands: ['pnpm typecheck'],
        maxFixAttempts: 2,
      },
    })

    await mkdir(task.worktreePath, { recursive: true })

    const plan = await runner.validationService.createPlan({
      task,
      taskValidation: task.validation,
    })

    const waiting = await runner.validationService.requestNextValidation({
      task,
      plan,
    })

    await runner.validationService.recordCommandResult({
      taskId: task.id,
      command: 'pnpm typecheck',
      cwd: task.worktreePath,
      ok: false,
      approvalId: waiting.results[0].approvalId,
      exitCode: 1,
      stderr: 'Type error',
    })

    const approvalsBefore = runner.approvalService.list().length

    await loop.run(task.id)

    // No new approval should be created — validation failed and the model
    // tried to finalize without fixing. The loop must inject feedback and
    // continue, not request another validation.
    expect(runner.approvalService.list()).toHaveLength(approvalsBefore)
  })

  it('marks validation as rejected when approval is rejected', async () => {
    const { taskService, runner } = createLoopFixture([])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      prompt: 'x',
      validation: {
        commands: ['pnpm typecheck'],
      },
    })

    const plan = await runner.validationService.createPlan({
      task,
      taskValidation: task.validation,
    })

    const waiting = await runner.validationService.requestNextValidation({
      task,
      plan,
    })

    await runner.approvalGate.reject(waiting.results[0].approvalId!, 'no')

    const current = runner.validationService.getPlan(task.id)

    expect(current?.status).toBe('rejected')
    expect(current?.results[0].status).toBe('rejected')
  })

  it('blocks tools not allowed by current workflow step', async () => {
    const { taskService, runner } = createLoopFixture([
      JSON.stringify({ message: 'done', final: true }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      workflowId: 'bugfix',
      prompt: 'fix bug',
    })

    // Start workflow and advance to edit step
    await runner.workflowService.startTaskWorkflow({ task })
    await runner.workflowService.finishCurrentStep({ taskId: task.id })
    await runner.workflowService.finishCurrentStep({ taskId: task.id })

    // assertToolAllowed should throw for run_command in edit step
    expect(() =>
      runner.workflowService.assertToolAllowed(task.id, 'run_command'),
    ).toThrow('not allowed')
  })

  it('auto-starts workflow when run is called', async () => {
    const { loop, taskService, runner } = createLoopFixture([
      JSON.stringify({ message: 'done', final: true }),
    ])

    const task = await taskService.create({
      workspaceId: 'ws_1',
      workflowId: 'bugfix',
      prompt: 'test',
    })

    // No manual startTaskWorkflow - loop.run should do it
    await loop.run(task.id)

    const run = runner.workflowService.getRun(task.id)
    expect(run?.workflowId).toBe('bugfix')
    expect(run?.currentStepId).toBe('context')
  })
})
