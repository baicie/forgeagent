import { useEffect, useMemo, useState } from 'react'
import { runnerApiClient } from './api/client'
import { HomePage } from './pages/HomePage'
import { TaskPage } from './pages/TaskPage'

function readTaskIdFromHash(): string | undefined {
  const match = window.location.hash.match(/^#\/tasks\/([^/]+)$/)

  return match ? decodeURIComponent(match[1]) : undefined
}

export function App() {
  const client = useMemo(() => runnerApiClient, [])
  const [taskId, setTaskId] = useState<string | undefined>(() =>
    readTaskIdFromHash(),
  )

  useEffect(() => {
    const onHashChange = () => {
      setTaskId(readTaskIdFromHash())
    }

    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  const openTask = (id: string) => {
    window.location.hash = `#/tasks/${encodeURIComponent(id)}`
    setTaskId(id)
  }

  const goHome = () => {
    window.location.hash = '#/'
    setTaskId(undefined)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <button className="brand" type="button" onClick={goHome}>
          ForgeAgent Console
        </button>
        <span className="muted">Local-first Coding Agent</span>
      </header>

      {taskId ? (
        <TaskPage client={client} taskId={taskId} onBack={goHome} />
      ) : (
        <HomePage client={client} onOpenTask={openTask} />
      )}
    </main>
  )
}
