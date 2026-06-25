import {
  TASK_MEMORY_FILES,
  TaskMemoryFileNameSchema,
  parseTaskMemoryFileName,
} from './taskMemory'

describe('taskMemory domain', () => {
  it('keeps the expected memory files', () => {
    expect(TASK_MEMORY_FILES).toEqual([
      'task_plan.md',
      'progress.md',
      'findings.md',
      'decisions.md',
      'changed_files.md',
      'test_results.md',
      'final_summary.md',
    ])
  })

  it('parses valid memory file names', () => {
    expect(parseTaskMemoryFileName('findings.md')).toBe('findings.md')
  })

  it('rejects invalid memory file names', () => {
    expect(() => TaskMemoryFileNameSchema.parse('../secret')).toThrow()
    expect(() => TaskMemoryFileNameSchema.parse('unknown.md')).toThrow()
  })
})
