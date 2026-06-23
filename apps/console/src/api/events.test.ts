import type { TaskEvent } from '../types'
import {
  createTaskEventsUrl,
  mergeTaskEvents,
  parseTaskEventMessage,
  subscribeTaskEvents,
} from './events'

class FakeEventSource {
  static instances: FakeEventSource[] = []

  readonly listeners = new Map<string, EventListener>()
  onerror: ((event: Event) => void) | null = null
  closed = false

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, listener)
  }

  removeEventListener(type: string) {
    this.listeners.delete(type)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({
      data: JSON.stringify(data),
    } as MessageEvent)
  }
}

describe('task events api', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
  })

  it('creates task events URL', () => {
    expect(
      createTaskEventsUrl({
        baseUrl: 'http://127.0.0.1:17890',
        taskId: 'task 1',
        afterId: 'evt_1',
      }),
    ).toBe('http://127.0.0.1:17890/api/tasks/task%201/events?afterId=evt_1')
  })

  it('parses event message', () => {
    expect(
      parseTaskEventMessage({
        data: JSON.stringify({
          id: 'evt_1',
          taskId: 'task_1',
          type: 'agent.message',
          payload: {
            message: 'hello',
          },
          createdAt: '2026-06-22T00:00:00.000Z',
        }),
      } as MessageEvent),
    ).toMatchObject({
      id: 'evt_1',
      type: 'agent.message',
    })
  })

  it('merges events by id and sorts by createdAt', () => {
    const events = mergeTaskEvents(
      [
        {
          id: 'evt_2',
          taskId: 'task_1',
          type: 'agent.message',
          payload: {},
          createdAt: '2026-06-22T00:00:02.000Z',
        },
      ] as TaskEvent[],
      [
        {
          id: 'evt_1',
          taskId: 'task_1',
          type: 'task.status',
          payload: {},
          createdAt: '2026-06-22T00:00:01.000Z',
        },
        {
          id: 'evt_2',
          taskId: 'task_1',
          type: 'agent.message',
          payload: {
            message: 'updated',
          },
          createdAt: '2026-06-22T00:00:02.000Z',
        },
      ] as TaskEvent[],
    )

    expect(events.map(event => event.id)).toEqual(['evt_1', 'evt_2'])
    expect(events[1].payload).toEqual({
      message: 'updated',
    })
  })

  it('subscribes and unsubscribes EventSource', () => {
    vi.stubGlobal('EventSource', FakeEventSource)

    const onEvent = vi.fn()
    const unsubscribe = subscribeTaskEvents({
      taskId: 'task_1',
      onEvent,
    })

    const source = FakeEventSource.instances[0]

    source.emit('agent.message', {
      id: 'evt_1',
      taskId: 'task_1',
      type: 'agent.message',
      payload: {
        message: 'hi',
      },
      createdAt: '2026-06-22T00:00:00.000Z',
    })

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt_1',
      }),
    )

    unsubscribe()

    expect(source.closed).toBe(true)
  })
})
