import type { ToolDescriptor } from '@forgeagent/core'

/**
 * PluginToolProvider allows ForgeAgent to invoke tools from a plugin system.
 *
 * Phase 14.5: This is a stub interface. No real plugin loading is
 * implemented yet. Future Phases will define the plugin contract.
 */
export interface PluginToolProvider {
  readonly name: string
  tools: () => Promise<ToolDescriptor[]>
  invoke: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<{ ok: boolean; data?: unknown; error?: string }>
}

export class EmptyPluginToolProvider implements PluginToolProvider {
  name: string = 'empty-plugin'

  async tools(): Promise<ToolDescriptor[]> {
    return []
  }

  async invoke(
    toolName: string,
    _args: Record<string, unknown>,
  ): Promise<{ ok: boolean; error: string }> {
    return {
      ok: false,
      error: `Plugin tool is not registered: ${toolName}`,
    }
  }
}
