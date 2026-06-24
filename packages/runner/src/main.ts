#!/usr/bin/env node
import { loadRunnerConfig, startRunnerServer } from './index'

void (async () => {
  const config = loadRunnerConfig()

  try {
    await startRunnerServer({
      config,
      logger: true,
    })

    console.log(
      `ForgeAgent Local Runner started at http://${config.host}:${config.port}`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))

    const details = (error as { details?: unknown }).details

    if (details && typeof details === 'object') {
      const hint = (details as { hint?: string }).hint

      if (hint) {
        console.error(`Hint: ${hint}`)
      }
    }

    process.exit(1)
  }
})()
