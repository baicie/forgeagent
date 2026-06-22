import { createInMemoryRunnerDb } from '../db'
import { EventService } from './eventService'

describe('eventService', () => {
  it('stores and lists task events', async () => {
    const db = createInMemoryRunnerDb()
    const service = new EventService(db)

    const event = await service.append({
      taskId: 'task_1',
      type: 'task.status',
      payload: { status: 'created' },
    })

    expect(service.listTaskEvents('task_1')).toEqual([event])
    expect(service.listTaskEvents('task_2')).toEqual([])
  })

  it('notifies subscribers for the matching task only', async () => {
    const db = createInMemoryRunnerDb()
    const service = new EventService(db)

    const task1Listener = vi.fn()
    const task2Listener = vi.fn()

    const unsubscribeTask1 = service.subscribe('task_1', task1Listener)
    service.subscribe('task_2', task2Listener)

    const event = await service.append({
      taskId: 'task_1',
      type: 'agent.message',
      payload: { message: 'hello' },
    })

    expect(task1Listener).toHaveBeenCalledWith(event)
    expect(task2Listener).not.toHaveBeenCalled()

    unsubscribeTask1()

    await service.append({
      taskId: 'task_1',
      type: 'agent.message',
      payload: { message: 'after unsubscribe' },
    })

    expect(task1Listener).toHaveBeenCalledTimes(1)
  })
})
