import { homedir } from 'node:os'
import { resolve } from 'node:path'

export interface RunnerConfig {
  host: string
  port: number
  dataDir: string
  dbFile: string
  minFreeDiskBytes: number
}

export const DEFAULT_RUNNER_HOST = '127.0.0.1'
export const DEFAULT_RUNNER_PORT = 17890
export const DEFAULT_MIN_FREE_DISK_BYTES = 2 * 1024 * 1024 * 1024
export const RUNNER_NAME = 'forgeagent-runner'
export const RUNNER_VERSION = '0.1.0'

const LOCALHOST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export interface LoadRunnerConfigOptions {
  host?: string
  port?: number
  dataDir?: string
  minFreeDiskBytes?: number
}

export function resolveDataDir(dataDir?: string): string {
  if (dataDir) {
    return resolve(dataDir.replace(/^~(?=$|\/|\\)/, homedir()))
  }

  return resolve(homedir(), '.forgeagent')
}

export function assertLocalRunnerHost(host: string): void {
  if (!LOCALHOST_HOSTS.has(host)) {
    throw new Error(`Local Runner only supports localhost host in MVP: ${host}`)
  }
}

export function parseRunnerPort(port: unknown): number {
  const parsed = Number(port)

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid runner port: ${String(port)}`)
  }

  return parsed
}

export function parseByteSize(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const text = String(value).trim().toLowerCase()
  const match = text.match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/)

  if (!match) {
    throw new Error(`Invalid byte size: ${String(value)}`)
  }

  const amount = Number(match[1])
  const unit = match[2] || 'b'
  const multiplier =
    unit === 'gb'
      ? 1024 ** 3
      : unit === 'mb'
        ? 1024 ** 2
        : unit === 'kb'
          ? 1024
          : 1

  return Math.floor(amount * multiplier)
}

export function loadRunnerConfig(
  options: LoadRunnerConfigOptions = {},
): RunnerConfig {
  const host =
    options.host || process.env.FORGEAGENT_RUNNER_HOST || DEFAULT_RUNNER_HOST

  assertLocalRunnerHost(host)

  const port = parseRunnerPort(
    options.port || process.env.FORGEAGENT_RUNNER_PORT || DEFAULT_RUNNER_PORT,
  )

  const dataDir = resolveDataDir(
    options.dataDir || process.env.FORGEAGENT_DATA_DIR,
  )

  const minFreeDiskBytes =
    options.minFreeDiskBytes ??
    parseByteSize(
      process.env.FORGEAGENT_MIN_FREE_DISK,
      DEFAULT_MIN_FREE_DISK_BYTES,
    )

  return {
    host,
    port,
    dataDir,
    dbFile: resolve(dataDir, 'runner-db.json'),
    minFreeDiskBytes,
  }
}
