import {
  createErrorPresentation,
  formatErrorPresentationPlain,
} from '@forgeagent/core'
import pc from 'picocolors'

export function formatCliError(error: unknown): string {
  const presentation = createErrorPresentation(error)
  const plain = formatErrorPresentationPlain(presentation)
  const lines = plain.split('\n')

  return lines
    .map((line, index) => {
      if (index === 0) return pc.red(line)
      if (line === 'Hint:' || line === 'Next:') return pc.yellow(line)
      if (line.startsWith('  ')) return pc.dim(line)

      return line
    })
    .join('\n')
}
