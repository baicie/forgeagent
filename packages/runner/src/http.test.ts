import { statusFromErrorCode } from './http'

describe('http error mapping phase 12', () => {
  it('maps WORKSPACE_NOT_GIT_REPOSITORY to 400', () => {
    expect(statusFromErrorCode('WORKSPACE_NOT_GIT_REPOSITORY')).toBe(400)
  })

  it('maps WORKSPACE_EMPTY_GIT_REPOSITORY to 400', () => {
    expect(statusFromErrorCode('WORKSPACE_EMPTY_GIT_REPOSITORY')).toBe(400)
  })

  it('maps DISK_SPACE_LOW to 507', () => {
    expect(statusFromErrorCode('DISK_SPACE_LOW')).toBe(507)
  })

  it('maps MODEL_CONFIG_MISSING to 500', () => {
    expect(statusFromErrorCode('MODEL_CONFIG_MISSING')).toBe(500)
  })

  it('maps RUNNER_PORT_IN_USE to 500 by default', () => {
    expect(statusFromErrorCode('RUNNER_PORT_IN_USE')).toBe(500)
  })
})
