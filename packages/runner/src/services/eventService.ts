import type { CreateTaskEventInput, TaskEvent } from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import type { RunnerDb } from '../db'

export class EventService {
  constructor(private readonly db: RunnerDb) {}

  listTaskEvents(taskId: string): TaskEvent[] {
    return this.db.state.events.filter(event => event.taskId === taskId)
  }

  async append(input: CreateTaskEventInput): Promise<TaskEvent> {
    const event: TaskEvent = {
      id: `evt_${randomUUID()}`,
      taskId: input.taskId,
      type: input.type,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    }

    this.db.state.events.push(event)
    await this.db.save()

    return event
  }
}
