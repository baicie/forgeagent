import * as PublicApi from './index'

describe('public API exports', () => {
  it('exports ForgeAgent domain models from the package root', () => {
    expect(PublicApi.WorkspaceSchema).toBeDefined()
    expect(PublicApi.TaskSchema).toBeDefined()
    expect(PublicApi.TaskEventSchema).toBeDefined()
    expect(PublicApi.ApprovalSchema).toBeDefined()
    expect(PublicApi.AuditLogSchema).toBeDefined()
    expect(PublicApi.RunnerSchema).toBeDefined()
    expect(PublicApi.ModelProviderConfigSchema).toBeDefined()
    expect(PublicApi.ToolCallSchema).toBeDefined()
  })

  it('exports ForgeAgent security helpers from the package root', () => {
    expect(PublicApi.assertInsideWorkspace).toBeDefined()
    expect(PublicApi.isSensitivePath).toBeDefined()
    expect(PublicApi.isIgnoredPath).toBeDefined()
    expect(PublicApi.classifyCommandRisk).toBeDefined()
  })

  it('keeps legacy runtime types available without name collisions', () => {
    expect(PublicApi.AgentEventSchema).toBeDefined()
    expect(PublicApi.AgentRunStateSchema).toBeDefined()
    expect(PublicApi.SkillSchema).toBeDefined()
    expect(PublicApi.ToolSchema).toBeDefined()

    expect(PublicApi.ToolPermissionSchema).toBeDefined()
    expect(PublicApi.LegacyToolPermissionSchema).toBeDefined()

    expect(PublicApi.ModelGenerateInputSchema).toBeDefined()
    expect(PublicApi.LegacyModelGenerateInputSchema).toBeDefined()

    expect(PublicApi.ModelGenerateResultSchema).toBeDefined()
    expect(PublicApi.LegacyModelGenerateResultSchema).toBeDefined()
  })
})
