import type {
  Approval,
  AuditLog,
  Task,
  TaskEvent,
  Workspace,
} from '@forgeagent/core'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface RunnerState {
  workspaces: Workspace[]
  tasks: Task[]
  events: TaskEvent[]
  approvals: Approval[]
  audits: AuditLog[]
}

export interface RunnerDb {
  state: RunnerState
  load: () => Promise<void>
  save: () => Promise<void>
}

export function createEmptyRunnerState(): RunnerState {
  return {
    workspaces: [],
    tasks: [],
    events: [],
    approvals: [],
    audits: [],
  }
}

export class InMemoryRunnerDb implements RunnerDb {
  state: RunnerState

  constructor(initialState: RunnerState = createEmptyRunnerState()) {
    this.state = initialState
  }

  async load(): Promise<void> {}

  async save(): Promise<void> {}
}

export class JsonFileRunnerDb implements RunnerDb {
  state: RunnerState = createEmptyRunnerState()

  constructor(private readonly dbFile: string) {}

  async load(): Promise<void> {
    try {
      const content = await readFile(this.dbFile, 'utf-8')
      this.state = {
        ...createEmptyRunnerState(),
        ...(JSON.parse(content) as Partial<RunnerState>),
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if (code !== 'ENOENT') {
        throw error
      }

      this.state = createEmptyRunnerState()
      await this.save()
    }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.dbFile), { recursive: true })
    await writeFile(this.dbFile, JSON.stringify(this.state, null, 2), 'utf-8')
  }
}

export function createInMemoryRunnerDb(initialState?: RunnerState): RunnerDb {
  return new InMemoryRunnerDb(initialState)
}

export function createJsonFileRunnerDb(dbFile: string): RunnerDb {
  return new JsonFileRunnerDb(dbFile)
}
