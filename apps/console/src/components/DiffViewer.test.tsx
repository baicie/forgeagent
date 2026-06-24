import { render, screen } from '@testing-library/react'
import { DiffViewer } from './DiffViewer'

describe('diff viewer', () => {
  it('renders empty state', () => {
    render(<DiffViewer diff="" />)

    expect(screen.getByText('暂无 diff')).toBeInTheDocument()
  })

  it('renders plain text diff', () => {
    render(
      <DiffViewer
        diff={`diff --git a/README.md b/README.md
+hello forgeagent`}
        lastEventId="evt_1"
      />,
    )

    expect(screen.getByText(/README.md/)).toBeInTheDocument()
    expect(screen.getByText('last event: evt_1')).toBeInTheDocument()
  })
})

describe('diff viewer phase 12', () => {
  it('explains empty diff worktree boundary', () => {
    render(<DiffViewer diff="" />)

    expect(screen.getByText(/隔离 worktree/)).toBeInTheDocument()
  })

  it('shows worktree notice for non-empty diff', () => {
    render(
      <DiffViewer
        diff="diff --git a/index.ts b/index.ts\n+hello"
        worktreePath="/tmp/worktree"
      />,
    )

    expect(
      screen.getByText(/当前 diff 来自 task worktree/),
    ).toBeInTheDocument()
    expect(screen.getByText('/tmp/worktree')).toBeInTheDocument()
  })
})
