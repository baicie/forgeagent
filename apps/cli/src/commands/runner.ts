import { loadRunnerConfig, startRunnerServer } from '@forgeagent/runner'
import { Command } from 'commander'
import pc from 'picocolors'

const startCommand = new Command('start')
  .description('Start the local ForgeAgent runner server')
  .option('--host <host>', 'Host to listen on', '127.0.0.1')
  .option('--port <port>', 'Port to listen on', '17890')
  .option('--data-dir <path>', 'Runner data directory')
  .action(async (options: { host: string; port: string; dataDir?: string }) => {
    const config = loadRunnerConfig({
      host: options.host,
      port: Number(options.port),
      dataDir: options.dataDir,
    })

    await startRunnerServer({
      config,
      logger: true,
    })

    console.log(pc.green('ForgeAgent Local Runner started'))
    console.log(pc.dim(`API: http://${config.host}:${config.port}`))
    console.log(pc.dim(`Data: ${config.dataDir}`))
  })

export const runnerCommand = new Command('runner')
  .description('Manage the local runner')
  .addCommand(startCommand)
