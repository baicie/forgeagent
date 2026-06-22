import {
  ApprovalSchema,
  AuditLogSchema,
  CreateTaskInputSchema,
  ModelProviderConfigSchema,
  RunnerSchema,
  TaskEventSchema,
  TaskSchema,
  WorkspaceSchema,
  canTransitionTaskStatus,
  createForgeAgentError,
  getAllowedTaskStatusTransitions,
  isApprovalResolved,
} from './index'

const now = '2026-06-22T00:00:00.000Z'

describe('domain models', () => {
  it('validates workspace shape', () => {
    const workspace = WorkspaceSchema.parse({
      id: 'ws_1',
      name: 'forgeagent',
      repoPath: '/repo/forgeagent',
      gitRoot: '/repo/forgeagent',
      createdAt: now,
      updatedAt: now,
    })

    expect(workspace.id).toBe('ws_1')
  })

  it('validates task shape and status transitions', () => {
    const task = TaskSchema.parse({
      id: 'task_1',
      workspaceId: 'ws_1',
      prompt: 'fix bug',
      status: 'created',
      baseBranch: 'main',
      baseCommit: 'abc123',
      worktreePath: '/tmp/worktree',
      createdAt: now,
      updatedAt: now,
    })

    expect(task.status).toBe('created')
    expect(canTransitionTaskStatus('created', 'preparing')).toBe(true)
    expect(canTransitionTaskStatus('created', 'completed')).toBe(false)
    expect(getAllowedTaskStatusTransitions('completed')).toEqual([
      'applied',
      'committed',
      'discarded',
    ])
  })

  it('rejects invalid task status', () => {
    expect(() =>
      TaskSchema.parse({
        id: 'task_1',
        workspaceId: 'ws_1',
        prompt: 'fix bug',
        status: 'unknown',
        baseBranch: 'main',
        baseCommit: 'abc123',
        worktreePath: '/tmp/worktree',
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow()
  })

  it('validates create task input', () => {
    expect(
      CreateTaskInputSchema.parse({
        workspaceId: 'ws_1',
        prompt: 'fix bug',
      }),
    ).toEqual({
      workspaceId: 'ws_1',
      prompt: 'fix bug',
    })
  })

  it('validates task event shape', () => {
    const event = TaskEventSchema.parse({
      id: 'evt_1',
      taskId: 'task_1',
      type: 'approval.required',
      payload: { approvalId: 'approval_1' },
      createdAt: now,
    })

    expect(event.type).toBe('approval.required')
  })

  it('validates approval and resolved status helpers', () => {
    const approval = ApprovalSchema.parse({
      id: 'approval_1',
      taskId: 'task_1',
      toolCallId: 'tool_1',
      command: 'pnpm test',
      cwd: '/repo',
      reason: 'verify changes',
      risk: 'low',
      status: 'pending',
      createdAt: now,
    })

    expect(approval.status).toBe('pending')
    expect(isApprovalResolved('pending')).toBe(false)
    expect(isApprovalResolved('approved')).toBe(true)
    expect(isApprovalResolved('rejected')).toBe(true)
  })

  it('validates audit log shape', () => {
    const auditLog = AuditLogSchema.parse({
      id: 'audit_1',
      taskId: 'task_1',
      type: 'task.created',
      payload: { prompt: 'fix bug' },
      createdAt: now,
    })

    expect(auditLog.type).toBe('task.created')
  })

  it('validates runner shape', () => {
    const runner = RunnerSchema.parse({
      id: 'runner_1',
      name: 'local',
      type: 'local',
      status: 'online',
      os: 'linux',
      arch: 'x64',
      capabilities: ['file.read', 'git.worktree', 'shell.approval'],
      workspaceRoots: ['/repo'],
      lastSeenAt: now,
    })

    expect(runner.type).toBe('local')
  })

  it('validates model provider config', () => {
    const provider = ModelProviderConfigSchema.parse({
      id: 'deepseek',
      type: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      defaultModel: 'deepseek-chat',
    })

    expect(provider.defaultModel).toBe('deepseek-chat')
  })

  it('creates structured ForgeAgent errors', () => {
    const error = createForgeAgentError(
      'PATH_ESCAPE_DETECTED',
      'Path escapes workspace',
      { path: '../secret' },
    )

    expect(error.name).toBe('ForgeAgentError')
    expect(error.code).toBe('PATH_ESCAPE_DETECTED')
    expect(error.toJSON()).toEqual({
      code: 'PATH_ESCAPE_DETECTED',
      message: 'Path escapes workspace',
      details: { path: '../secret' },
    })
  })

  it('omits undefined error details from JSON payload', () => {
    const error = createForgeAgentError('UNKNOWN_ERROR', 'Unknown error')

    expect(error.toJSON()).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error',
    })
  })
})
