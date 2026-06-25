import type {
  ToolApprovalStatus,
  ToolCallRecord,
  ToolDescriptor,
  ToolPermissionLevel,
  ToolSource,
  ToolType,
} from '@forgeagent/core'
import {
  ToolDescriptorSchema,
  createForgeAgentError,
  createToolCallId,
} from '@forgeagent/core'
import type { AgentToolName } from '../json'
import {
  applyPatchTool,
  getDiffTool,
  listFilesTool,
  readFileTool,
  runCommandTool,
  searchTextTool,
} from './index'
import type { MCPToolProvider } from './mcpProvider'
import { EmptyMCPToolProvider } from './mcpProvider'
import type { PluginToolProvider } from './pluginProvider'
import { EmptyPluginToolProvider } from './pluginProvider'
import type { RunnerToolContext } from './types'

export type RegisteredToolName = AgentToolName | string

export interface ToolInvokeInput {
  taskId: string
  context: RunnerToolContext
  toolName: RegisteredToolName
  args: unknown
}

export interface ToolInvokeResult {
  record: ToolCallRecord
  result: unknown
}

export type CoreToolHandler = (
  context: RunnerToolContext,
  args: unknown,
) => Promise<unknown>

export interface RegisteredTool {
  descriptor: ToolDescriptor
  handler?: CoreToolHandler
}

export interface ToolRegistryOptions {
  mcpProvider?: MCPToolProvider
  pluginProvider?: PluginToolProvider
}

function now(): string {
  return new Date().toISOString()
}

function asArgsRecord(args: unknown): Record<string, unknown> {
  return typeof args === 'object' && args !== null
    ? (args as Record<string, unknown>)
    : {}
}

function createCoreTool(
  descriptor: Omit<ToolDescriptor, 'source'> & {
    source?: ToolSource
  },
  handler: CoreToolHandler,
): RegisteredTool {
  return {
    descriptor: ToolDescriptorSchema.parse({
      source: 'core',
      ...descriptor,
    }),
    handler,
  }
}

export function createCoreToolDescriptors(): ToolDescriptor[] {
  return createCoreToolRegistryEntries().map(entry => entry.descriptor)
}

export function createCoreToolRegistryEntries(): RegisteredTool[] {
  return [
    createCoreTool(
      {
        name: 'list_files',
        displayName: 'list',
        type: 'read',
        permission: 'allowed',
        requiresApproval: false,
        modelCallable: true,
        description: 'List files under the task worktree.',
      },
      listFilesTool,
    ),
    createCoreTool(
      {
        name: 'read_file',
        displayName: 'read',
        type: 'read',
        permission: 'allowed',
        requiresApproval: false,
        modelCallable: true,
        description: 'Read a file under the task worktree.',
      },
      readFileTool,
    ),
    createCoreTool(
      {
        name: 'search_text',
        displayName: 'search',
        type: 'read',
        permission: 'allowed',
        requiresApproval: false,
        modelCallable: true,
        description: 'Search text under the task worktree.',
      },
      searchTextTool,
    ),
    createCoreTool(
      {
        name: 'apply_patch',
        displayName: 'apply patch',
        type: 'write',
        permission: 'allowed',
        requiresApproval: false,
        modelCallable: true,
        description: 'Apply file changes to the isolated task worktree.',
      },
      applyPatchTool,
    ),
    createCoreTool(
      {
        name: 'run_command',
        displayName: 'run',
        type: 'execute',
        permission: 'requires_approval',
        requiresApproval: true,
        modelCallable: true,
        description: 'Request approval to run a shell command.',
      },
      runCommandTool,
    ),
    createCoreTool(
      {
        name: 'get_diff',
        displayName: 'diff',
        type: 'read',
        permission: 'allowed',
        requiresApproval: false,
        modelCallable: true,
        description: 'Read the current task worktree diff.',
      },
      getDiffTool,
    ),

    // Delivery actions — registered so Console/docs show clear boundaries,
    // but NOT model-callable. Users trigger these via Console/CLI.
    {
      descriptor: ToolDescriptorSchema.parse({
        name: 'commit_task',
        displayName: 'commit',
        source: 'core',
        type: 'write',
        permission: 'requires_approval',
        requiresApproval: true,
        modelCallable: false,
        description:
          'User-triggered delivery action. Commit task worktree branch.',
      }),
    },
    {
      descriptor: ToolDescriptorSchema.parse({
        name: 'discard_task',
        displayName: 'discard',
        source: 'core',
        type: 'write',
        permission: 'requires_approval',
        requiresApproval: true,
        modelCallable: false,
        description:
          'User-triggered delivery action. Discard task worktree and branch.',
      }),
    },
  ]
}

function defaultApprovalStatus(
  permission: ToolPermissionLevel,
): ToolApprovalStatus {
  if (permission === 'requires_approval') return 'pending'
  if (permission === 'denied') return 'denied'
  return 'not_required'
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>()
  private readonly records = new Map<string, ToolCallRecord>()
  private readonly mcpProvider: MCPToolProvider
  private readonly pluginProvider: PluginToolProvider

  constructor(options: ToolRegistryOptions = {}) {
    this.mcpProvider = options.mcpProvider ?? new EmptyMCPToolProvider()
    this.pluginProvider =
      options.pluginProvider ?? new EmptyPluginToolProvider()

    for (const tool of createCoreToolRegistryEntries()) {
      this.register(tool)
    }
  }

  register(tool: RegisteredTool): void {
    if (this.tools.has(tool.descriptor.name)) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Tool already registered: ${tool.descriptor.name}`,
        {
          toolName: tool.descriptor.name,
        },
      )
    }

    this.tools.set(tool.descriptor.name, tool)
  }

  getDescriptor(toolName: string): ToolDescriptor {
    const tool = this.tools.get(toolName)

    if (!tool) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Unknown tool: ${toolName}`,
        {
          toolName,
        },
      )
    }

    return tool.descriptor
  }

  listDescriptors(
    input: { modelCallableOnly?: boolean } = {},
  ): ToolDescriptor[] {
    const descriptors = [...this.tools.values()].map(tool => tool.descriptor)

    if (input.modelCallableOnly) {
      return descriptors.filter(descriptor => descriptor.modelCallable)
    }

    return descriptors
  }

  listRecords(taskId?: string): ToolCallRecord[] {
    const records = [...this.records.values()]

    if (!taskId) return records

    return records.filter(record => record.taskId === taskId)
  }

  getRecord(id: string): ToolCallRecord | undefined {
    return this.records.get(id)
  }

  createStartedRecord(input: {
    taskId: string
    descriptor: ToolDescriptor
    args: unknown
  }): ToolCallRecord {
    const record: ToolCallRecord = {
      id: createToolCallId(),
      taskId: input.taskId,
      name: input.descriptor.name,
      displayName: input.descriptor.displayName,
      source: input.descriptor.source,
      type: input.descriptor.type,
      permission: input.descriptor.permission,
      requiresApproval: input.descriptor.requiresApproval,
      approvalStatus: defaultApprovalStatus(input.descriptor.permission),
      args: asArgsRecord(input.args),
      startedAt: now(),
    }

    this.records.set(record.id, record)

    return record
  }

  finishRecord(input: {
    id: string
    result?: unknown
    error?: string
    approvalStatus?: ToolApprovalStatus
  }): ToolCallRecord {
    const current = this.records.get(input.id)

    if (!current) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Tool call record not found: ${input.id}`,
        {
          toolCallId: input.id,
        },
      )
    }

    const next: ToolCallRecord = {
      ...current,
      result: input.result,
      error: input.error,
      approvalStatus: input.approvalStatus ?? current.approvalStatus,
      finishedAt: now(),
    }

    this.records.set(next.id, next)

    return next
  }

  async invoke(input: ToolInvokeInput): Promise<ToolInvokeResult> {
    const tool = this.tools.get(input.toolName)

    if (!tool) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Unknown tool: ${input.toolName}`,
        {
          toolName: input.toolName,
        },
      )
    }

    if (!tool.descriptor.modelCallable) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Tool is not model-callable: ${input.toolName}`,
        {
          toolName: input.toolName,
          source: tool.descriptor.source,
        },
      )
    }

    if (tool.descriptor.permission === 'denied') {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Tool permission denied: ${input.toolName}`,
        {
          toolName: input.toolName,
          permission: tool.descriptor.permission,
        },
      )
    }

    const record = this.createStartedRecord({
      taskId: input.taskId,
      descriptor: tool.descriptor,
      args: input.args,
    })

    try {
      const result = await this.invokeRegisteredTool(tool, input)
      const finished = this.finishRecord({
        id: record.id,
        result,
      })

      return {
        record: finished,
        result,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.finishRecord({
        id: record.id,
        error: message,
      })

      throw error
    }
  }

  /**
   * Invoke a tool that already has a started record.
   * The registry records the result/approvalStatus when done.
   *
   * Injects toolCallId into args for run_command tools so the approval
   * is linked to the ToolCallRecord.
   */
  async invokeExistingRecord(input: {
    recordId: string
    context: RunnerToolContext
    toolName: RegisteredToolName
    args: unknown
  }): Promise<unknown> {
    const tool = this.tools.get(input.toolName)

    if (!tool) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Unknown tool: ${input.toolName}`,
        {
          toolName: input.toolName,
        },
      )
    }

    if (!tool.descriptor.modelCallable) {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Tool is not model-callable: ${input.toolName}`,
        {
          toolName: input.toolName,
          source: tool.descriptor.source,
        },
      )
    }

    if (tool.descriptor.permission === 'denied') {
      throw createForgeAgentError(
        'TOOL_EXECUTION_FAILED',
        `Tool permission denied: ${input.toolName}`,
        {
          toolName: input.toolName,
          permission: tool.descriptor.permission,
        },
      )
    }

    // Inject toolCallId for run_command so approval is linked to the record
    const finalArgs =
      tool.descriptor.name === 'run_command'
        ? {
            ...asArgsRecord(input.args),
            toolCallId: input.recordId,
          }
        : input.args

    try {
      const result = await this.invokeRegisteredTool(tool, {
        taskId: input.context.task.id,
        context: input.context,
        toolName: input.toolName,
        args: finalArgs,
      })

      this.finishRecord({
        id: input.recordId,
        result,
      })

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.finishRecord({
        id: input.recordId,
        error: message,
      })

      throw error
    }
  }

  private async invokeRegisteredTool(
    tool: RegisteredTool,
    input: ToolInvokeInput,
  ): Promise<unknown> {
    if (tool.descriptor.source === 'core') {
      if (!tool.handler) {
        throw createForgeAgentError(
          'TOOL_EXECUTION_FAILED',
          `Core tool has no handler: ${tool.descriptor.name}`,
          {
            toolName: tool.descriptor.name,
          },
        )
      }

      return tool.handler(input.context, input.args)
    }

    if (tool.descriptor.source === 'mcp') {
      return this.mcpProvider.invoke(
        tool.descriptor.name,
        asArgsRecord(input.args),
      )
    }

    if (tool.descriptor.source === 'plugin') {
      return this.pluginProvider.invoke(
        tool.descriptor.name,
        asArgsRecord(input.args),
      )
    }

    throw createForgeAgentError(
      'TOOL_EXECUTION_FAILED',
      `Unsupported tool source: ${tool.descriptor.source}`,
      {
        source: tool.descriptor.source,
      },
    )
  }
}

export function serializeToolRecordForEvent(record: ToolCallRecord): {
  toolCallId: string
  toolName: string
  displayName?: string
  source: ToolSource
  type: ToolType
  permission: ToolPermissionLevel
  requiresApproval: boolean
  approvalStatus: ToolApprovalStatus
  args: Record<string, unknown>
} {
  return {
    toolCallId: record.id,
    toolName: record.name,
    displayName: record.displayName,
    source: record.source,
    type: record.type,
    permission: record.permission,
    requiresApproval: record.requiresApproval,
    approvalStatus: record.approvalStatus,
    args: record.args,
  }
}
