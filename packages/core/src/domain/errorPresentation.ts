import type { ForgeAgentErrorCode } from './error'

export interface ForgeAgentErrorLike {
  name?: string
  code?: string
  message?: string
  details?: unknown
  status?: number
}

export interface ErrorPresentation {
  code: string
  title: string
  message: string
  hint?: string
  actions: string[]
  details?: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]

  return typeof value === 'string' && value.trim() ? value : undefined
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }

  const fixed = value >= 10 || index === 0 || Number.isInteger(value)
    ? value.toFixed(0)
    : value.toFixed(1)

  return `${fixed} ${units[index]}`
}

function extractErrorLike(error: unknown): ForgeAgentErrorLike {
  if (error instanceof Error) {
    const record = asRecord(error)

    return {
      name: error.name,
      code: readString(record, 'code'),
      message: error.message,
      details: record.details,
      status:
        typeof record.status === 'number' ? record.status : undefined,
    }
  }

  const record = asRecord(error)
  const nested = asRecord(record.error)

  return {
    name: readString(record, 'name'),
    code: readString(record, 'code') || readString(nested, 'code'),
    message:
      readString(record, 'message') ||
      readString(nested, 'message') ||
      String(error),
    details: record.details ?? nested.details,
    status:
      typeof record.status === 'number' ? record.status : undefined,
  }
}

function getHintFromDetails(details: unknown): string | undefined {
  return readString(asRecord(details), 'hint')
}

function getEnvFromDetails(details: unknown): string | undefined {
  return readString(asRecord(details), 'env')
}

function getPathFromDetails(details: unknown): string | undefined {
  return (
    readString(asRecord(details), 'path') ||
    readString(asRecord(details), 'repoPath') ||
    readString(asRecord(details), 'resolvedRepoPath')
  )
}

function getNumberFromDetails(details: unknown, key: string): number | undefined {
  const value = asRecord(details)[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const DEFAULT_ACTIONS: Record<string, string[]> = {
  WORKSPACE_NOT_GIT_REPOSITORY: [
    'cd /path/to/your/repo',
    'git init',
    'git add .',
    'git commit -m "chore: initial commit"',
    'forgeagent workspace add .',
  ],
  WORKSPACE_EMPTY_GIT_REPOSITORY: [
    'git add .',
    'git commit -m "chore: initial commit"',
    'forgeagent workspace add .',
  ],
  RUNNER_UNAVAILABLE: ['forgeagent runner start'],
  RUNNER_PORT_IN_USE: [
    'FORGEAGENT_RUNNER_PORT=17891 forgeagent runner start',
  ],
  MODEL_CONFIG_MISSING: [
    'export FORGEAGENT_MODEL_BASE_URL="http://localhost:11434/v1"',
    'export FORGEAGENT_MODEL_API_KEY="ollama"',
    'export FORGEAGENT_MODEL_NAME="qwen2.5-coder"',
    'forgeagent runner start',
  ],
  DIFF_EMPTY: [
    'forgeagent task run <taskId>',
    'forgeagent task watch <taskId>',
    'forgeagent task diff <taskId>',
  ],
  DISK_SPACE_LOW: [
    'forgeagent task cleanup --yes',
    'forgeagent task cleanup --task <taskId> --yes',
  ],
}

const TITLES: Record<string, string> = {
  WORKSPACE_NOT_GIT_REPOSITORY: '不是 Git 仓库',
  WORKSPACE_EMPTY_GIT_REPOSITORY: 'Git 仓库还没有初始提交',
  RUNNER_UNAVAILABLE: 'Runner 未启动或不可访问',
  RUNNER_PORT_IN_USE: 'Runner 端口已被占用',
  MODEL_CONFIG_MISSING: '模型配置缺失',
  DIFF_EMPTY: '当前任务没有可交付 diff',
  DISK_SPACE_LOW: '磁盘空间不足',
  RUNNER_RESPONSE_INVALID: 'Runner 响应格式异常',
  RUNNER_REQUEST_FAILED: 'Runner 请求失败',
}

export function createErrorPresentation(error: unknown): ErrorPresentation {
  const normalized = extractErrorLike(error)
  const code = normalized.code || 'UNKNOWN_ERROR'
  const title = TITLES[code] || code
  const details = normalized.details
  const detailsRecord = asRecord(details)
  const path = getPathFromDetails(details)
  const env = getEnvFromDetails(details)
  const availableBytes = getNumberFromDetails(details, 'availableBytes')
  const minFreeBytes = getNumberFromDetails(details, 'minFreeBytes')

  let message = normalized.message || 'Unknown error'

  if (code === 'WORKSPACE_NOT_GIT_REPOSITORY' && path) {
    message = `路径不是 Git 仓库：${path}`
  }

  if (code === 'WORKSPACE_EMPTY_GIT_REPOSITORY') {
    message = 'ForgeAgent MVP 要求 workspace 至少有一个 commit。'
  }

  if (code === 'MODEL_CONFIG_MISSING' && env) {
    message = `缺少环境变量：${env}`
  }

  if (
    code === 'DISK_SPACE_LOW' &&
    availableBytes !== undefined &&
    minFreeBytes !== undefined
  ) {
    message = `当前可用空间 ${formatBytes(availableBytes)}，要求至少 ${formatBytes(
      minFreeBytes,
    )}。`
  }

  const hint =
    getHintFromDetails(details) ||
    (code === 'RUNNER_UNAVAILABLE'
      ? '请先启动本地 Runner。'
      : undefined)

  const actions = DEFAULT_ACTIONS[code] || []

  return {
    code,
    title,
    message,
    hint,
    actions,
    details: Object.keys(detailsRecord).length > 0 ? details : undefined,
  }
}

export function formatErrorPresentationPlain(
  presentation: ErrorPresentation,
): string {
  const lines = [`[${presentation.code}] ${presentation.title}`]

  if (presentation.message) {
    lines.push('', presentation.message)
  }

  if (presentation.hint) {
    lines.push('', 'Hint:', presentation.hint)
  }

  if (presentation.actions.length > 0) {
    lines.push('', 'Next:')
    lines.push(...presentation.actions.map(action => `  ${action}`))
  }

  return lines.join('\n')
}

export type KnownForgeAgentErrorCode = ForgeAgentErrorCode
