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
