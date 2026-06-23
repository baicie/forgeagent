import type {
  ApiErrorPayload,
  DiffResult,
  ListResponse,
  Task,
  Workspace,
} from '../types'

export interface CreateWorkspaceInput {
  repoPath: string
  name?: string
}

export interface CreateTaskInput {
  workspaceId: string
  prompt: string
}

export interface CommitTaskInput {
  message?: string
}

export interface RejectApprovalInput {
  reason?: string
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

export class RunnerApiClient {
  constructor(
    private readonly baseUrl = import.meta.env.VITE_FORGEAGENT_RUNNER_URL || '',
  ) {}

  async health(): Promise<unknown> {
    return this.request('/api/health')
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const result =
      await this.request<ListResponse<Workspace>>('/api/workspaces')

    return result.items
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    return this.request('/api/workspaces', {
      method: 'POST',
      body: input,
    })
  }

  async listTasks(): Promise<Task[]> {
    const result = await this.request<ListResponse<Task>>('/api/tasks')

    return result.items
  }

  async getTask(id: string): Promise<Task> {
    return this.request(`/api/tasks/${encodeURIComponent(id)}`)
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

  async approveApproval(id: string): Promise<unknown> {
    return this.request(`/api/approvals/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    })
  }

  async rejectApproval(
    id: string,
    input: RejectApprovalInput = {},
  ): Promise<unknown> {
    return this.request(`/api/approvals/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: input,
    })
  }

  private async request<T>(
    path: string,
    options: {
      method?: string
      body?: unknown
    } = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
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

    if (!response.ok) {
      const payload = (await response.json()) as ApiErrorPayload

      throw new RunnerApiError(response.status, payload)
    }

    return (await response.json()) as T
  }
}

export const runnerApiClient = new RunnerApiClient()
