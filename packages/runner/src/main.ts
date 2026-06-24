#!/usr/bin/env node
import { loadRunnerConfig, startRunnerServer } from './index'
import {
  loadModelGatewayConfigFromEnv,
  validateModelGatewayConfig,
} from './agent/model'

void (async () => {
  const config = loadRunnerConfig()

  // Validate model gateway config at startup so that the user gets a
  // clear, actionable error before the runner binds to a port.
  try {
    validateModelGatewayConfig(loadModelGatewayConfigFromEnv())
  } catch (error) {
    console.error((error as Error).message)

    const details = (error as { details?: unknown }).details
    if (details && typeof details === 'object') {
      const hint = (details as { hint?: string }).hint
      if (hint) {
        console.error(`Hint: ${hint}`)
      }
    }

    process.exit(1)
  }

  await startRunnerServer({
    config,
    logger: true,
  })

  console.log(
    `ForgeAgent Local Runner started at http://${config.host}:${config.port}`,
  )
})()
