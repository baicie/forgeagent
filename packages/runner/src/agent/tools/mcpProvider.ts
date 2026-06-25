import type { ToolDescriptor } from '@forgeagent/core'

/**
 * MCPToolProvider allows ForgeAgent to invoke tools from an external MCP server.
 *
 * Phase 14.5: This is a stub interface. No real MCP server connection is
 * implemented yet. Future Phases will implement real MCP protocol adapters.
 */
export interface MCPToolProvider {
  readonly name: string
  tools: () => Promise<ToolDescriptor[]>
  invoke: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<{ ok: boolean; data?: unknown; error?: string }>
}

export class EmptyMCPToolProvider implements MCPToolProvider {
  name: string = 'empty-mcp'

  async tools(): Promise<ToolDescriptor[]> {
    return []
  }

  async invoke(
    toolName: string,
    _args: Record<string, unknown>,
  ): Promise<{ ok: boolean; error: string }> {
    return {
      ok: false,
      error: `MCP tool is not registered: ${toolName}`,
    }
  }
}
