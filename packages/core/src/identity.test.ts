import {
  FORGEAGENT_CLI_NAME,
  FORGEAGENT_CLI_PACKAGE,
  FORGEAGENT_CORE_PACKAGE,
  FORGEAGENT_LOCAL_RUNNER_HOST,
  FORGEAGENT_LOCAL_RUNNER_PORT,
  FORGEAGENT_MVP_NAME,
  FORGEAGENT_PACKAGE_NAME,
  FORGEAGENT_PRINCIPLES,
  FORGEAGENT_PRODUCT_NAME,
} from './identity'

describe('identity constants', () => {
  it('exposes product and package identity', () => {
    expect(FORGEAGENT_PACKAGE_NAME).toBe('forgeagent')
    expect(FORGEAGENT_PRODUCT_NAME).toBe('ForgeAgent OS')
    expect(FORGEAGENT_CLI_NAME).toBe('forgeagent')
    expect(FORGEAGENT_CORE_PACKAGE).toBe('@forgeagent/core')
    expect(FORGEAGENT_CLI_PACKAGE).toBe('@forgeagent/cli')
  })

  it('exposes MVP identity', () => {
    expect(FORGEAGENT_MVP_NAME).toBe(
      'Local-first Coding Agent + Web Console Lite',
    )
  })

  it('exposes local runner defaults for later phases', () => {
    expect(FORGEAGENT_LOCAL_RUNNER_HOST).toBe('127.0.0.1')
    expect(FORGEAGENT_LOCAL_RUNNER_PORT).toBe(17890)
  })

  it('keeps the first principles stable', () => {
    expect(FORGEAGENT_PRINCIPLES).toEqual([
      'Local-first',
      'Private-first',
      'Runner-based',
      'Approval-first',
      'Auditable',
      'Model-agnostic',
      'Git-native',
    ])
  })
})
