import { TextDecoder } from 'node:util'
import { createForgeAgentError } from '@forgeagent/core'
import type { TaskEvent } from './types'

export interface SseMessage {
  event?: string
  data?: string
}

export interface WatchTaskEventsInput {
  baseUrl: string
  taskId: string
  afterId?: string
  signal?: AbortSignal
  onEvent: (event: TaskEvent) => void
}

export function createTaskEventsUrl(input: {
  baseUrl: string
  taskId: string
  afterId?: string
}): string {
  const params = new URLSearchParams()

  if (input.afterId) {
    params.set('afterId', input.afterId)
  }

  const query = params.toString()
  const baseUrl = input.baseUrl.replace(/\/+$/, '')
  const path = `/api/tasks/${encodeURIComponent(input.taskId)}/events`

  return `${baseUrl}${path}${query ? `?${query}` : ''}`
}

export function parseSseFrame(frame: string): SseMessage | undefined {
  const message: SseMessage = {}
  const dataLines: string[] = []

  for (const rawLine of frame.split(/\r?\n/)) {
    const line = rawLine.trimEnd()

    if (!line || line.startsWith(':')) {
      continue
    }

    if (line.startsWith('event:')) {
      message.event = line.slice('event:'.length).trim()
      continue
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    }
  }

  if (!message.event && dataLines.length === 0) {
    return undefined
  }

  if (dataLines.length > 0) {
    message.data = dataLines.join('\n')
  }

  return message
}

export function parseTaskEventFromSseFrame(
  frame: string,
): TaskEvent | undefined {
  const message = parseSseFrame(frame)

  if (!message?.data) {
    return undefined
  }

  return JSON.parse(message.data) as TaskEvent
}

function isAbortError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    String((error as { name: unknown }).name) === 'AbortError'
  )
}

export async function watchTaskEvents(
  input: WatchTaskEventsInput,
): Promise<void> {
  let response: Response

  try {
    response = await fetch(
      createTaskEventsUrl({
        baseUrl: input.baseUrl,
        taskId: input.taskId,
        afterId: input.afterId,
      }),
      {
        method: 'GET',
        signal: input.signal,
      },
    )
  } catch (error) {
    if (input.signal?.aborted || isAbortError(error)) {
      return
    }

    throw createForgeAgentError(
      'RUNNER_REQUEST_FAILED',
      'Failed to connect task event stream',
      {
        cause: error instanceof Error ? error.message : String(error),
      },
    )
  }

  if (!response.ok || !response.body) {
    throw createForgeAgentError(
      'RUNNER_REQUEST_FAILED',
      `Failed to connect task event stream: ${response.status} ${response.statusText}`,
      {
        status: response.status,
        statusText: response.statusText,
      },
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (!input.signal?.aborted) {
      const result = await reader.read()

      if (result.done) {
        break
      }

      buffer += decoder.decode(result.value, {
        stream: true,
      })

      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() || ''

      for (const frame of frames) {
        const event = parseTaskEventFromSseFrame(frame)

        if (event) {
          input.onEvent(event)
        }
      }
    }
  } catch (error) {
    if (input.signal?.aborted || isAbortError(error)) {
      return
    }

    throw createForgeAgentError(
      'RUNNER_REQUEST_FAILED',
      'Task event stream failed',
      {
        cause: error instanceof Error ? error.message : String(error),
      },
    )
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // Best-effort cleanup.
    }
  }

  if (buffer.trim()) {
    const event = parseTaskEventFromSseFrame(buffer)

    if (event) {
      input.onEvent(event)
    }
  }
}
