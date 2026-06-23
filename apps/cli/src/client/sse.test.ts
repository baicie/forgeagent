import { ReadableStream } from 'node:stream/web'
import {
  createTaskEventsUrl,
  parseSseFrame,
  parseTaskEventFromSseFrame,
  watchTaskEvents,
} from './sse'

describe('sse client', () => {
  it('creates task events url', () => {
    expect(
      createTaskEventsUrl({
        baseUrl: 'http://127.0.0.1:17890/',
        taskId: 'task 1',
        afterId: 'evt_1',
      }),
    ).toBe('http://127.0.0.1:17890/api/tasks/task%201/events?afterId=evt_1')
  })

  it('parses sse frame', () => {
    expect(
      parseSseFrame(
        `event: agent.message
data: {"id":"evt_1"}`,
      ),
    ).toEqual({
      event: 'agent.message',
      data: '{"id":"evt_1"}',
    })
  })

  it('ignores heartbeat frames', () => {
    expect(parseSseFrame(': heartbeat')).toBeUndefined()
  })

  it('parses task event from frame', () => {
    expect(
      parseTaskEventFromSseFrame(
        `event: task.status
data: {"id":"evt_1","taskId":"task_1","type":"task.status","payload":{"status":"running"},"createdAt":"2026-06-22T00:00:00.000Z"}`,
      ),
    ).toMatchObject({
      id: 'evt_1',
      type: 'task.status',
    })
  })

  it('watches task events from fetch stream', async () => {
    const encoder = new TextEncoder()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `event: agent.message
data: {"id":"evt_1","taskId":"task_1","type":"agent.message","payload":{"message":"hello"},"createdAt":"2026-06-22T00:00:00.000Z"}

`,
              ),
            )
            controller.close()
          },
        }),
      })),
    )

    const events: unknown[] = []

    await watchTaskEvents({
      baseUrl: 'http://127.0.0.1:17890',
      taskId: 'task_1',
      onEvent(event) {
        events.push(event)
      },
    })

    expect(events).toEqual([
      expect.objectContaining({
        id: 'evt_1',
        type: 'agent.message',
      }),
    ])
  })
})
