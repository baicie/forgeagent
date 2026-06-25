import {
  ToolCallRecordSchema,
  ToolDescriptorSchema,
  ToolSourceSchema,
  ToolTypeSchema,
  ToolPermissionLevelSchema,
  ToolApprovalStatusSchema,
  createToolCallId,
} from './tool'

describe('tool domain', () => {
  it('parses core tool descriptor', () => {
    const descriptor = ToolDescriptorSchema.parse({
      name: 'read_file',
      source: 'core',
      type: 'read',
      permission: 'allowed',
      requiresApproval: false,
    })

    expect(descriptor.modelCallable).toBe(true)
  })

  it('parses tool call record', () => {
    const record = ToolCallRecordSchema.parse({
      id: 'tool_1',
      taskId: 'task_1',
      name: 'run_command',
      source: 'core',
      type: 'execute',
      permission: 'requires_approval',
      requiresApproval: true,
      approvalStatus: 'pending',
      args: {
        command: 'pnpm test',
      },
      startedAt: '2026-06-25T00:00:00.000Z',
    })

    expect(record.permission).toBe('requires_approval')
    expect(record.approvalStatus).toBe('pending')
  })

  it('creates tool call id with correct prefix', () => {
    expect(createToolCallId()).toMatch(/^tool_/)
  })

  it('parses all tool source values', () => {
    expect(ToolSourceSchema.parse('core')).toBe('core')
    expect(ToolSourceSchema.parse('mcp')).toBe('mcp')
    expect(ToolSourceSchema.parse('plugin')).toBe('plugin')
  })

  it('parses all tool type values', () => {
    expect(ToolTypeSchema.parse('read')).toBe('read')
    expect(ToolTypeSchema.parse('write')).toBe('write')
    expect(ToolTypeSchema.parse('execute')).toBe('execute')
  })

  it('parses all tool permission level values', () => {
    expect(ToolPermissionLevelSchema.parse('allowed')).toBe('allowed')
    expect(ToolPermissionLevelSchema.parse('requires_approval')).toBe(
      'requires_approval',
    )
    expect(ToolPermissionLevelSchema.parse('denied')).toBe('denied')
  })

  it('parses all tool approval status values', () => {
    expect(ToolApprovalStatusSchema.parse('not_required')).toBe('not_required')
    expect(ToolApprovalStatusSchema.parse('pending')).toBe('pending')
    expect(ToolApprovalStatusSchema.parse('approved')).toBe('approved')
    expect(ToolApprovalStatusSchema.parse('denied')).toBe('denied')
  })

  it('defaults modelCallable to true', () => {
    const descriptor = ToolDescriptorSchema.parse({
      name: 'list_files',
      source: 'core',
      type: 'read',
      permission: 'allowed',
      requiresApproval: false,
    })

    expect(descriptor.modelCallable).toBe(true)
  })

  it('marks non-model-callable tools correctly', () => {
    const descriptor = ToolDescriptorSchema.parse({
      name: 'commit_task',
      source: 'core',
      type: 'write',
      permission: 'requires_approval',
      requiresApproval: true,
      modelCallable: false,
    })

    expect(descriptor.modelCallable).toBe(false)
  })
})
