import {
  createCompactToolResultPrompt,
  createContextPackPrompt,
  createTaskEventHistoryPrompt,
} from './prompts'

describe('agent prompts', () => {
  it('creates context pack prompt', () => {
    const prompt = createContextPackPrompt(
      '# Context Pack\n\n## Task Goal\nFix',
    )

    expect(prompt).toContain('Context Pack')
    expect(prompt).toContain('优先依据 Context Pack')
    expect(prompt).toContain('## Task Goal')
  })

  it('compacts tool result prompt', () => {
    const prompt = createCompactToolResultPrompt({
      toolName: 'search_text',
      result: {
        matches: ['x'.repeat(1000)],
      },
      truncated: false,
      maxChars: 120,
    })

    expect(prompt).toContain('search_text')
    expect(prompt).toContain('<tool result truncated>')
    expect(prompt.length).toBeLessThan(500)
  })

  it('does not include tool.output in event history', () => {
    const prompt = createTaskEventHistoryPrompt({
      maxChars: 10_000,
      events: [
        {
          id: 'evt_1',
          taskId: 'task_1',
          type: 'tool.output',
          payload: {
            chunk: 'very long output',
          },
          createdAt: '2026-06-25T00:00:00.000Z',
        },
        {
          id: 'evt_2',
          taskId: 'task_1',
          type: 'agent.message',
          payload: {
            message: 'hello',
          },
          createdAt: '2026-06-25T00:00:00.000Z',
        },
      ],
    })

    expect(prompt).toContain('hello')
    expect(prompt).not.toContain('very long output')
  })

  it('keeps tool.result prompt under max chars', () => {
    const prompt = createCompactToolResultPrompt({
      toolName: 'search_text',
      result: {
        matches: ['x'.repeat(50_000)],
      },
      truncated: false,
      maxChars: 200,
    })

    expect(prompt.length).toBeLessThan(300)
    expect(prompt).toContain('<tool result truncated>')
  })
})
