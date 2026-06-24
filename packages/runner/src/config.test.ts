import {
  DEFAULT_MIN_FREE_DISK_BYTES,
  loadRunnerConfig,
  parseByteSize,
} from './config'

describe('runner config phase 12', () => {
  it('uses default min free disk bytes', () => {
    const config = loadRunnerConfig({
      dataDir: '/tmp/forgeagent-test',
    })

    expect(config.minFreeDiskBytes).toBe(DEFAULT_MIN_FREE_DISK_BYTES)
  })

  it('parses byte size values', () => {
    expect(parseByteSize('1024', 0)).toBe(1024)
    expect(parseByteSize('1kb', 0)).toBe(1024)
    expect(parseByteSize('2mb', 0)).toBe(2 * 1024 * 1024)
    expect(parseByteSize('1.5gb', 0)).toBe(Math.floor(1.5 * 1024 ** 3))
  })

  it('returns fallback for null/empty input', () => {
    expect(parseByteSize('', 999)).toBe(999)
    expect(parseByteSize(undefined, 999)).toBe(999)
    expect(parseByteSize(null, 999)).toBe(999)
  })

  it('throws on invalid byte size', () => {
    expect(() => parseByteSize('abc', 0)).toThrow(/Invalid byte size/)
  })

  it('allows min free disk override', () => {
    const config = loadRunnerConfig({
      dataDir: '/tmp/forgeagent-test',
      minFreeDiskBytes: 1234,
    })

    expect(config.minFreeDiskBytes).toBe(1234)
  })
})
