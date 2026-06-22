import { homedir } from 'node:os'
import { resolve } from 'node:path'
import {
  DEFAULT_RUNNER_HOST,
  DEFAULT_RUNNER_PORT,
  assertLocalRunnerHost,
  loadRunnerConfig,
  parseRunnerPort,
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

  it('supports custom localhost, port and data dir', () => {
    const config = loadRunnerConfig({
      host: 'localhost',
      port: 18000,
      dataDir: '/tmp/custom-forgeagent',
    })

    expect(config.host).toBe('localhost')
    expect(config.port).toBe(18000)
    expect(config.dataDir).toBe('/tmp/custom-forgeagent')
  })

  it('expands home data dir', () => {
    expect(resolveDataDir('~/.forgeagent-test')).toBe(
      resolve(homedir(), '.forgeagent-test'),
    )
  })

  it.each(['127.0.0.1', 'localhost', '::1'])('allows local host %s', host => {
    expect(() => assertLocalRunnerHost(host)).not.toThrow()
  })

  it.each(['0.0.0.0', '192.168.1.2', 'example.com'])(
    'rejects non-local host %s',
    host => {
      expect(() => assertLocalRunnerHost(host)).toThrow(
        'Local Runner only supports localhost host in MVP',
      )
    },
  )

  it.each([1, 17890, 65535, '17890'])('parses valid port %s', port => {
    expect(parseRunnerPort(port)).toBe(Number(port))
  })

  it.each([0, -1, 65536, 'abc', Number.NaN])(
    'rejects invalid port %s',
    port => {
      expect(() => parseRunnerPort(port)).toThrow('Invalid runner port')
    },
  )
})
