import type {
  TaskMemoryFile,
  TaskMemoryFileName,
  TaskMemorySnapshot,
} from '@forgeagent/core'
import type {
  ApiErrorPayload,
  DiffResult,
  ListResponse,
  Task,
  Workspace,
} from './types'

export const DEFAULT_RUNNER_URL = 'http://127.0.0.1:17890'

export interface CreateWorkspaceInput {
  repoPath: string
  name?: string
}

export interface CreateTaskInput {
  workspaceId: string
  prompt: string
  validation?: {
    commands?: string[]
    maxFixAttempts?: number
  }
}

export interface CommitTaskInput {
  message?: string
}

export interface CleanupTasksInput {
  taskId?: string
}

export interface CleanupTaskPreviewItem {
  id: string
  status: string
  worktreePath: string
  estimatedBytes: number
}

export interface CleanupTasksPreview {
  count: number
  estimatedBytes: number
  tasks: CleanupTaskPreviewItem[]
}

export interface CleanupTasksResult {
  deleted: number
  failed: number
}

export class RunnerApiError extends Error {
  readonly code: string
  readonly details?: unknown
  readonly status: number

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error.message)
    this.name = 'RunnerApiError'
    this.status = status
    this.code = payload.error.code
    this.details = payload.error.details
  }
}

export function normalizeRunnerUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

export function getRunnerUrlFromEnv(): string {
  return normalizeRunnerUrl(
    process.env.FORGEAGENT_RUNNER_URL || DEFAULT_RUNNER_URL,
  )
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload
  } catch {
    return {
      error: {
        code: 'HTTP_ERROR',
        message: `HTTP ${response.status} ${response.statusText}`,
      },
    }
  }
}

function isJsonResponse(response: Response): boolean {
  return (
    response.headers
      .get('content-type')
      ?.toLowerCase()
      .includes('application/json') ?? false
  )
}

async function readSuccessPayload<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  if (!isJsonResponse(response)) {
    const text = await response.text()

    if (!text.trim()) {
      return undefined as T
    }

    throw new RunnerApiError(response.status, {
      error: {
        code: 'RUNNER_RESPONSE_INVALID',
        message: 'Runner response is not JSON',
        details: {
          contentType: response.headers.get('content-type'),
          body: text.slice(0, 2000),
        },
      },
    })
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new RunnerApiError(response.status, {
      error: {
        code: 'RUNNER_RESPONSE_INVALID',
        message: 'Runner response JSON parse failed',
        details: {
          cause: error instanceof Error ? error.message : String(error),
        },
      },
    })
  }
}

function createRunnerUnavailableError(baseUrl: string, error: unknown) {
  return new RunnerApiError(0, {
    error: {
      code: 'RUNNER_UNAVAILABLE',
      message: `Runner is not available at ${baseUrl}`,
      details: {
        baseUrl,
        cause: error instanceof Error ? error.message : String(error),
        hint: 'Start the runner first: forgeagent runner start',
      },
    },
  })
}

export class RunnerApiClient {
  readonly baseUrl: string

  constructor(baseUrl = getRunnerUrlFromEnv()) {
    this.baseUrl = normalizeRunnerUrl(baseUrl)
  }

  async health(): Promise<unknown> {
    return this.request('/api/health')
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const response =
      await this.request<ListResponse<Workspace>>('/api/workspaces')

    return response.items
  }

  async getWorkspace(id: string): Promise<Workspace> {
    return this.request(`/api/workspaces/${encodeURIComponent(id)}`)
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    return this.request('/api/workspaces', {
      method: 'POST',
      body: input,
    })
  }

  async listTasks(): Promise<Task[]> {
    const response = await this.request<ListResponse<Task>>('/api/tasks')

    return response.items
  }

  async getTask(id: string): Promise<Task> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}`)
  }

  async getTaskValidation(
    id: string,
  ): Promise<{ plan: unknown; summary: unknown }> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/validation`)
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.request('/api/tasks', {
      method: 'POST',
      body: input,
    })
  }

  async runTask(id: string): Promise<unknown> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/run`, {
      method: 'POST',
    })
  }

  async getTaskDiff(id: string): Promise<DiffResult> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/diff`)
  }

  async applyTask(id: string): Promise<Task> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/apply`, {
      method: 'POST',
    })
  }

  async commitTask(id: string, input: CommitTaskInput = {}): Promise<Task> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/commit`, {
      method: 'POST',
      body: input,
    })
  }

  async discardTask(id: string): Promise<Task> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/discard`, {
      method: 'POST',
    })
  }

  async cancelTask(id: string): Promise<Task> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    })
  }

  async getTaskMemory(id: string): Promise<TaskMemorySnapshot> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}/memory`)
  }

  async getTaskMemoryFile(
    id: string,
    file: TaskMemoryFileName,
  ): Promise<TaskMemoryFile> {
    return this.request(
      `/api/tasks/${encodeURIComponent(id)}/memory/${encodeURIComponent(file)}`,
    )
  }

  async deleteTask(id: string): Promise<void> {
    await this.request(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  async getTaskCleanupPreview(
    input: CleanupTasksInput = {},
  ): Promise<CleanupTasksPreview> {
    const query = input.taskId
      ? `?taskId=${encodeURIComponent(input.taskId)}`
      : ''

    return this.request(`/api/tasks/cleanup/preview${query}`)
  }

  async cleanupTasks(
    input: CleanupTasksInput = {},
  ): Promise<CleanupTasksResult> {
    return this.request('/api/tasks/cleanup', {
      method: 'POST',
      body: input,
    })
  }

  async approveApproval(id: string): Promise<unknown> {
    return this.request(`/api/approvals/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    })
  }

  async rejectApproval(id: string): Promise<unknown> {
    return this.request(`/api/approvals/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
    })
  }

  private async request<T>(
    path: string,
    options: {
      method?: string
      body?: unknown
    } = {},
  ): Promise<T> {
    let response: Response

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method || 'GET',
        headers:
          options.body === undefined
            ? undefined
            : {
                'Content-Type': 'application/json',
              },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      })
    } catch (error) {
      throw createRunnerUnavailableError(this.baseUrl, error)
    }

    if (!response.ok) {
      throw new RunnerApiError(
        response.status,
        await readErrorPayload(response),
      )
    }

    return readSuccessPayload<T>(response)
  }
}

export type RunnerApiClientFactory = () => RunnerApiClient

export function createRunnerApiClient(): RunnerApiClient {
  return new RunnerApiClient()
}
