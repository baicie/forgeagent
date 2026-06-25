import { createErrorPresentation } from '@forgeagent/core'

export interface ErrorBannerProps {
  error: unknown
}

export function ErrorBanner(props: ErrorBannerProps) {
  const presentation = createErrorPresentation(props.error)

  return (
    <div className="error">
      <strong>
        [{presentation.code}] {presentation.title}
      </strong>

      <p>{presentation.message}</p>

      {presentation.hint ? (
        <p>
          <strong>Hint：</strong>
          {presentation.hint}
        </p>
      ) : null}

      {presentation.actions.length > 0 ? (
        <div>
          <strong>Next：</strong>
          <pre>{presentation.actions.join('\n')}</pre>
        </div>
      ) : null}
    </div>
  )
}
