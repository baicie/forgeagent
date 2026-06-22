#!/usr/bin/env node
import { loadRunnerConfig, startRunnerServer } from './index'

void (async () => {
  const config = loadRunnerConfig()

  await startRunnerServer({
    config,
    logger: true,
  })

  console.log(
    `ForgeAgent Local Runner started at http://${config.host}:${config.port}`,
  )
})()
