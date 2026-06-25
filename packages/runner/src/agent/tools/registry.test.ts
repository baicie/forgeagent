import { ToolRegistry, createCoreToolDescriptors } from './registry'
import type { RunnerToolContext } from './types'

function createToolContext(): RunnerToolContext {
  return {
    task: {
      id: 'task_1',
      workspaceId: 'ws_1',
      prompt: 'test',
      status: 'running',
      baseBranch: 'main',
      baseCommit: 'a'.repeat(40),
      worktreePath: '/tmp/worktree',
      createdAt: '2026-06-25T00:00:00.000Z',
      updatedAt: '2026-06-25T00:00:00.000Z',
    },
    workspace: {
      id: 'ws_1',
      name: 'repo',
      repoPath: '/repo',
      gitRoot: '/repo',
      currentBranch: 'main',
      currentCommit: 'a'.repeat(40),
      createdAt: '2026-06-25T00:00:00.000Z',
      updatedAt: '2026-06-25T00:00:00.000Z',
    },
    worktreePath: '/tmp/worktree',
    taskService: {} as RunnerToolContext['taskService'],
    approvalService: {} as RunnerToolContext['approvalService'],
  }
}

describe('toolRegistry', () => {
  it('registers core harness tool descriptors', () => {
    const descriptors = createCoreToolDescriptors()

    expect(descriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'read_file',
          source: 'core',
          type: 'read',
          permission: 'allowed',
          requiresApproval: false,
        }),
        expect.objectContaining({
          name: 'run_command',
          source: 'core',
          type: 'execute',
          permission: 'requires_approval',
          requiresApproval: true,
        }),
      ]),
    )
  })

  it('lists only model callable tools', () => {
    const registry = new ToolRegistry()
    const names = registry
      .listDescriptors({ modelCallableOnly: true })
      .map(descriptor => descriptor.name)

    expect(names).toContain('read_file')
    expect(names).toContain('run_command')
    expect(names).not.toContain('commit_task')
    expect(names).not.toContain('discard_task')
  })

  it('creates structured tool records', () => {
    const registry = new ToolRegistry()
    const descriptor = registry.getDescriptor('run_command')
    const record = registry.createStartedRecord({
      taskId: 'task_1',
      descriptor,
      args: {
        command: 'pnpm test',
      },
    })

    expect(record).toEqual(
      expect.objectContaining({
        name: 'run_command',
        source: 'core',
        type: 'execute',
        permission: 'requires_approval',
        requiresApproval: true,
        approvalStatus: 'pending',
      }),
    )
  })

  it('invokes registered mock tool', async () => {
    const registry = new ToolRegistry()

    registry.register({
      descriptor: {
        name: 'core.mock',
        displayName: 'mock',
        source: 'core',
        type: 'read',
        permission: 'allowed',
        requiresApproval: false,
        modelCallable: true,
      },
      handler: async () => ({
        ok: true,
      }),
    })

    const result = await registry.invoke({
      taskId: 'task_1',
      context: createToolContext(),
      toolName: 'core.mock',
      args: {},
    })

    expect(result.record.source).toBe('core')
    expect(result.result).toEqual({ ok: true })
    expect(registry.listRecords('task_1')).toHaveLength(1)
  })

  it('rejects non model-callable delivery actions', async () => {
    const registry = new ToolRegistry()

    await expect(
      registry.invoke({
        taskId: 'task_1',
        context: createToolContext(),
        toolName: 'commit_task',
        args: {},
      }),
    ).rejects.toThrow('Tool is not model-callable')
  })

  it('throws for unknown tool in invoke', async () => {
    const registry = new ToolRegistry()

    await expect(
      registry.invoke({
        taskId: 'task_1',
        context: createToolContext(),
        toolName: 'nonexistent_tool',
        args: {},
      }),
    ).rejects.toThrow('Unknown tool')
  })

  it('throws for denied tool in invoke', async () => {
    const registry = new ToolRegistry()
    registry.register({
      descriptor: {
        name: 'core.denied',
        displayName: 'denied',
        source: 'core',
        type: 'write',
        permission: 'denied',
        requiresApproval: false,
        modelCallable: true,
      },
    })

    await expect(
      registry.invoke({
        taskId: 'task_1',
        context: createToolContext(),
        toolName: 'core.denied',
        args: {},
      }),
    ).rejects.toThrow('permission denied')
  })

  it('rejects duplicate tool registration', () => {
    const registry = new ToolRegistry()

    expect(() =>
      registry.register({
        descriptor: {
          name: 'read_file',
          source: 'core',
          type: 'read',
          permission: 'allowed',
          requiresApproval: false,
          modelCallable: true,
        },
      }),
    ).toThrow('already registered')
  })

  it('records delivery action descriptors', () => {
    const registry = new ToolRegistry()
    const allDescriptors = registry.listDescriptors()

    const commit = allDescriptors.find(d => d.name === 'commit_task')
    const discard = allDescriptors.find(d => d.name === 'discard_task')

    expect(commit).toBeDefined()
    expect(commit?.modelCallable).toBe(false)
    expect(commit?.permission).toBe('requires_approval')

    expect(discard).toBeDefined()
    expect(discard?.modelCallable).toBe(false)
    expect(discard?.permission).toBe('requires_approval')
  })
})
