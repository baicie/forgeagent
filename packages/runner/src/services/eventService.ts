import {
  CreateTaskEventInputSchema,
  TaskEventSchema,
} from '@forgeagent/core'
import type { CreateTaskEventInput, TaskEvent } from '@forgeagent/core'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { RunnerDb } from '../db'

export interface ListTaskEventsOptions {
  afterId?: string
  limit?: number
}

export type TaskEventListener = (event: TaskEvent) => void

export class EventService {
  private readonly emitter = new EventEmitter()

  constructor(private readonly db: RunnerDb) {}

  listTaskEvents(
    taskId: string,
    options: ListTaskEventsOptions = {},
  ): TaskEvent[] {
    let events = this.db.state.events.filter(event => event.taskId === taskId)

    if (options.afterId) {
      const index = events.findIndex(event => event.id === options.afterId)
      events = index >= 0 ? events.slice(index + 1) : events
    }

    if (options.limit !== undefined) {
      events = events.slice(0, Math.max(0, options.limit))
    }

    return events
  }

  subscribe(taskId: string, listener: TaskEventListener): () => void {
    const eventName = this.getTaskEventName(taskId)

    this.emitter.on(eventName, listener)

    return () => {
      this.emitter.off(eventName, listener)
    }
  }

  async append(input: CreateTaskEventInput): Promise<TaskEvent> {
    const parsedInput = CreateTaskEventInputSchema.parse(input)

    const event = TaskEventSchema.parse({
      id: `evt_${randomUUID()}`,
      taskId: parsedInput.taskId,
      type: parsedInput.type,
      payload: parsedInput.payload,
      createdAt: new Date().toISOString(),
    })

    this.db.state.events.push(event)
    await this.db.save()

    this.emitter.emit(this.getTaskEventName(event.taskId), event)

    return event
  }

  private getTaskEventName(taskId: string): string {
    return `task:${taskId}`
  }
}
