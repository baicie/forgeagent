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

  it('supports afterId replay', async () => {
    const db = createInMemoryRunnerDb()
    const service = new EventService(db)

    const first = await service.append({
      taskId: 'task_1',
      type: 'task.status',
      payload: { status: 'created' },
    })

    const second = await service.append({
      taskId: 'task_1',
      type: 'agent.message',
      payload: { message: 'hello' },
    })

    const third = await service.append({
      taskId: 'task_1',
      type: 'tool.started',
      payload: { toolName: 'read_file' },
    })

    expect(
      service.listTaskEvents('task_1', {
        afterId: first.id,
      }),
    ).toEqual([second, third])
  })

  it('supports event limit', async () => {
    const db = createInMemoryRunnerDb()
    const service = new EventService(db)

    await service.append({
      taskId: 'task_1',
      type: 'task.status',
      payload: { status: 'created' },
    })

    await service.append({
      taskId: 'task_1',
      type: 'agent.message',
      payload: { message: 'hello' },
    })

    expect(
      service.listTaskEvents('task_1', {
        limit: 1,
      }),
    ).toHaveLength(1)
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

  it('validates task event input', async () => {
    const db = createInMemoryRunnerDb()
    const service = new EventService(db)

    await expect(
      service.append({
        taskId: '',
        type: 'task.status',
        payload: {},
      }),
    ).rejects.toThrow()
  })

  it('rejects invalid task.status payload', async () => {
    const db = createInMemoryRunnerDb()
    const service = new EventService(db)

    await expect(
      service.append({
        taskId: 'task_1',
        type: 'task.status',
        payload: {
          status: 'not-a-status',
        },
      }),
    ).rejects.toThrow()
  })

  it('rejects invalid agent.message payload', async () => {
    const db = createInMemoryRunnerDb()
    const service = new EventService(db)

    await expect(
      service.append({
        taskId: 'task_1',
        type: 'agent.message',
        payload: {
          role: 'assistant',
        },
      }),
    ).rejects.toThrow()
  })

  it('rejects invalid diff.updated payload', async () => {
    const db = createInMemoryRunnerDb()
    const service = new EventService(db)

    await expect(
      service.append({
        taskId: 'task_1',
        type: 'diff.updated',
        payload: {
          changed: true,
          bytes: -1,
        },
      }),
    ).rejects.toThrow()
  })
})
