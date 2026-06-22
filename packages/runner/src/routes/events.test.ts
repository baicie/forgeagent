import { toSse } from './events'

describe('sse helpers', () => {
  it('serializes events as SSE payload', () => {
    expect(
      toSse('task.status', {
        id: 'evt_1',
        taskId: 'task_1',
      }),
    ).toBe('event: task.status\ndata: {"id":"evt_1","taskId":"task_1"}\n\n')
  })
})
