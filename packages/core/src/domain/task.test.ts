import {
  TASK_STATUS_TRANSITIONS,
  assertTaskStatusTransition,
  canTransitionTaskStatus,
  getAllowedTaskStatusTransitions,
  isTaskFinishedStatus,
  isTaskTerminalStatus,
} from './task'

describe('task status machine', () => {
  it('allows the expected happy path', () => {
    expect(canTransitionTaskStatus('created', 'preparing')).toBe(true)
    expect(canTransitionTaskStatus('preparing', 'running')).toBe(true)
    expect(canTransitionTaskStatus('running', 'waiting_approval')).toBe(true)
    expect(canTransitionTaskStatus('waiting_approval', 'running')).toBe(true)
    expect(canTransitionTaskStatus('running', 'completed')).toBe(true)
    expect(canTransitionTaskStatus('completed', 'applied')).toBe(true)
    expect(canTransitionTaskStatus('completed', 'committed')).toBe(true)
    expect(canTransitionTaskStatus('completed', 'discarded')).toBe(true)
  })

  it('allows cancellation and discard paths', () => {
    expect(canTransitionTaskStatus('created', 'cancelled')).toBe(true)
    expect(canTransitionTaskStatus('preparing', 'cancelled')).toBe(true)
    expect(canTransitionTaskStatus('running', 'cancelled')).toBe(true)
    expect(canTransitionTaskStatus('waiting_approval', 'cancelled')).toBe(true)
    expect(canTransitionTaskStatus('cancelled', 'discarded')).toBe(true)
    expect(canTransitionTaskStatus('failed', 'discarded')).toBe(true)
  })

  it('rejects invalid transitions', () => {
    expect(canTransitionTaskStatus('created', 'completed')).toBe(false)
    expect(canTransitionTaskStatus('created', 'applied')).toBe(false)
    expect(canTransitionTaskStatus('failed', 'committed')).toBe(false)
    expect(canTransitionTaskStatus('cancelled', 'applied')).toBe(false)
    expect(canTransitionTaskStatus('applied', 'running')).toBe(false)

    expect(() => assertTaskStatusTransition('created', 'completed')).toThrow(
      'Invalid task status transition: created -> completed',
    )
  })

  it('returns allowed transitions', () => {
    expect(getAllowedTaskStatusTransitions('created')).toEqual([
      'preparing',
      'cancelled',
      'discarded',
    ])
    expect(getAllowedTaskStatusTransitions('completed')).toEqual([
      'applied',
      'committed',
      'discarded',
    ])
  })

  it('classifies finished and terminal statuses', () => {
    expect(isTaskFinishedStatus('completed')).toBe(true)
    expect(isTaskFinishedStatus('failed')).toBe(true)
    expect(isTaskFinishedStatus('cancelled')).toBe(true)
    expect(isTaskFinishedStatus('running')).toBe(false)

    expect(isTaskTerminalStatus('applied')).toBe(true)
    expect(isTaskTerminalStatus('committed')).toBe(true)
    expect(isTaskTerminalStatus('discarded')).toBe(true)
    expect(isTaskTerminalStatus('completed')).toBe(false)
  })

  it('keeps all states covered by the transition table', () => {
    expect(Object.keys(TASK_STATUS_TRANSITIONS).sort()).toEqual([
      'applied',
      'cancelled',
      'committed',
      'completed',
      'created',
      'discarded',
      'failed',
      'preparing',
      'running',
      'waiting_approval',
    ])
  })
})
