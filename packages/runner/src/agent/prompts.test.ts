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

  it('handles undefined tool result without crashing', () => {
    const prompt = createCompactToolResultPrompt({
      toolName: 'noop',
      result: undefined,
      truncated: false,
      maxChars: 500,
    })

    expect(prompt).toContain('noop')
    expect(prompt).toContain('undefined')
  })

  it('sanitizes tool.finished run_command output in event history', () => {
    const prompt = createTaskEventHistoryPrompt({
      maxChars: 10_000,
      events: [
        {
          id: 'evt_1',
          taskId: 'task_1',
          type: 'tool.finished',
          payload: {
            toolName: 'run_command',
            command: 'pnpm test:run',
            ok: false,
            result: {
              ok: false,
              command: 'pnpm test:run',
              exitCode: 1,
              timedOut: false,
              stdout: 'STDOUT_SECRET_OR_HUGE_LOG'.repeat(200),
              stderr: 'STDERR_SECRET_OR_HUGE_LOG'.repeat(200),
              error: 'test failed',
            },
          },
          createdAt: '2026-06-25T00:00:00.000Z',
        },
      ],
    })

    expect(prompt).toContain('pnpm test:run')
    expect(prompt).toContain('stdoutBytes')
    expect(prompt).toContain('stderrBytes')
    expect(prompt).toContain('test_results.md')
    expect(prompt).not.toContain('STDOUT_SECRET_OR_HUGE_LOG')
    expect(prompt).not.toContain('STDERR_SECRET_OR_HUGE_LOG')
  })

  it('sanitizes tool.finished get_diff output in event history', () => {
    const prompt = createTaskEventHistoryPrompt({
      maxChars: 10_000,
      events: [
        {
          id: 'evt_1',
          taskId: 'task_1',
          type: 'tool.finished',
          payload: {
            toolName: 'get_diff',
            result: {
              diff: 'diff --git a/README.md b/README.md\n+hello\n'.repeat(100),
            },
          },
          createdAt: '2026-06-25T00:00:00.000Z',
        },
      ],
    })

    expect(prompt).toContain('diffBytes')
    expect(prompt).toContain('context_pack.md')
    expect(prompt).not.toContain('hello')
  })
})
