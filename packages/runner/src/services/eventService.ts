import type { CreateTaskEventInput, TaskEvent } from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { RunnerDb } from '../db'

export type TaskEventListener = (event: TaskEvent) => void

export class EventService {
  private readonly emitter = new EventEmitter()

  constructor(private readonly db: RunnerDb) {}

  listTaskEvents(taskId: string): TaskEvent[] {
    return this.db.state.events.filter(event => event.taskId === taskId)
  }

  subscribe(taskId: string, listener: TaskEventListener): () => void {
    const eventName = this.getTaskEventName(taskId)

    this.emitter.on(eventName, listener)

    return () => {
      this.emitter.off(eventName, listener)
    }
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

    this.emitter.emit(this.getTaskEventName(event.taskId), event)

    return event
  }

  private getTaskEventName(taskId: string): string {
    return `task:${taskId}`
  }
}
