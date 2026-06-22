import { homedir } from 'node:os'
import { resolve } from 'node:path'
import {
  DEFAULT_RUNNER_HOST,
  DEFAULT_RUNNER_PORT,
  loadRunnerConfig,
  resolveDataDir,
} from './config'

describe('runner config', () => {
  it('uses localhost defaults', () => {
    const config = loadRunnerConfig({
      dataDir: '/tmp/forgeagent-test',
    })

    expect(config.host).toBe(DEFAULT_RUNNER_HOST)
    expect(config.port).toBe(DEFAULT_RUNNER_PORT)
    expect(config.dataDir).toBe('/tmp/forgeagent-test')
    expect(config.dbFile).toBe('/tmp/forgeagent-test/runner-db.json')
  })

  it('supports custom host, port and data dir', () => {
    const config = loadRunnerConfig({
      host: '127.0.0.1',
      port: 18000,
      dataDir: '/tmp/custom-forgeagent',
    })

    expect(config.host).toBe('127.0.0.1')
    expect(config.port).toBe(18000)
    expect(config.dataDir).toBe('/tmp/custom-forgeagent')
  })

  it('expands home data dir', () => {
    expect(resolveDataDir('~/.forgeagent-test')).toBe(
      resolve(homedir(), '.forgeagent-test'),
    )
  })
})
