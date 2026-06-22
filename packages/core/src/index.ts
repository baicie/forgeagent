export * from './domain'
export * from './guardrails'
export * from './identity'
export * from './memory'
export * from './runtime'
export * from './security'
export * from './skills'
export * from './tools'

// Legacy template runtime types.
// Keep these exports to avoid breaking the current runtime/CLI public surface.
// Colliding names are exported with a Legacy prefix because ForgeAgent domain
// now owns ToolPermissionSchema / ModelGenerateInputSchema / ModelGenerateResultSchema.
export {
  AgentEventSchema,
  AgentRunStateSchema,
  MemoryItemSchema,
  ModelGenerateInputSchema as LegacyModelGenerateInputSchema,
  ModelGenerateResultSchema as LegacyModelGenerateResultSchema,
  SkillSchema,
  ToolContextSchema,
  ToolPermissionSchema as LegacyToolPermissionSchema,
  ToolSchema,
} from './types'

export type {
  AgentEvent,
  AgentRunState,
  AgentTool,
  MemoryItem,
  ModelGenerateInput as LegacyModelGenerateInput,
  ModelGenerateResult as LegacyModelGenerateResult,
  Skill,
  ToolContext,
  ToolPermission as LegacyToolPermission,
} from './types'
