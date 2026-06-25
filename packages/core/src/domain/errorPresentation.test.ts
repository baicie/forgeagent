import {
  createErrorPresentation,
  formatBytes,
  formatErrorPresentationPlain,
} from './errorPresentation'

describe('errorPresentation', () => {
  it('formats runner unavailable with next action', () => {
    const presentation = createErrorPresentation({
      code: 'RUNNER_UNAVAILABLE',
      message: 'Runner is not available at http://127.0.0.1:17890',
      details: {
        hint: 'Start the runner first: forgeagent runner start',
      },
    })

    expect(presentation.title).toBe('Runner 未启动或不可访问')
    expect(presentation.actions).toContain('forgeagent runner start')
    expect(formatErrorPresentationPlain(presentation)).toContain(
      'forgeagent runner start',
    )
  })

  it('formats empty git repository', () => {
    const presentation = createErrorPresentation({
      code: 'WORKSPACE_EMPTY_GIT_REPOSITORY',
      message: 'Workspace Git repository has no commits yet',
    })

    expect(presentation.message).toContain('至少有一个 commit')
    expect(presentation.actions).toContain(
      'git commit -m "chore: initial commit"',
    )
  })

  it('formats disk space details', () => {
    const presentation = createErrorPresentation({
      code: 'DISK_SPACE_LOW',
      message: 'Not enough free disk space',
      details: {
        availableBytes: 1024 * 1024,
        minFreeBytes: 2 * 1024 * 1024 * 1024,
      },
    })

    expect(presentation.message).toContain('1 MB')
    expect(presentation.message).toContain('2 GB')
    expect(presentation.actions).toContain('forgeagent task cleanup --yes')
  })

  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
  })
})
