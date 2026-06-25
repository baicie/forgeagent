import { renderContextPack, truncateText } from './contextPack'

describe('contextPack domain', () => {
  it('renders context pack sections', () => {
    const pack = renderContextPack({
      taskId: 'task_1',
      generatedAt: '2026-06-25T00:00:00.000Z',
      maxChars: 10_000,
      sections: [
        {
          name: 'Task Goal',
          content: 'Fix bug',
          truncated: false,
        },
        {
          name: 'Project Rules',
          content: 'Do not edit dist.',
          truncated: false,
        },
      ],
    })

    expect(pack.content).toContain('# Context Pack')
    expect(pack.content).toContain('## Task Goal')
    expect(pack.content).toContain('Fix bug')
    expect(pack.bytes).toBeGreaterThan(0)
  })

  it('truncates long text within max chars', () => {
    const result = truncateText('a'.repeat(100), 20)

    expect(result.text.length).toBeLessThanOrEqual(20)
    expect(result.truncated).toBe(true)
  })

  it('keeps final context pack under max chars', () => {
    const pack = renderContextPack({
      taskId: 'task_1',
      generatedAt: '2026-06-25T00:00:00.000Z',
      maxChars: 1000,
      sections: [
        {
          name: 'Relevant Files',
          content: 'a'.repeat(10_000),
          truncated: false,
        },
      ],
    })

    expect(pack.content.length).toBeLessThanOrEqual(1000)
    expect(pack.truncated).toBe(true)
  })

  it('marks truncated sections correctly', () => {
    const pack = renderContextPack({
      taskId: 'task_1',
      generatedAt: '2026-06-25T00:00:00.000Z',
      maxChars: 10_000,
      sections: [
        {
          name: 'Task Goal',
          content: 'Short content',
          truncated: false,
        },
      ],
    })

    expect(pack.truncated).toBe(false)
  })
})
