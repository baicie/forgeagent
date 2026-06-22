import fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { loadRunnerConfig } from './config'
import type { LoadRunnerConfigOptions, RunnerConfig } from './config'
import { createRunnerContext } from './context'
import { createJsonFileRunnerDb } from './db'
import type { RunnerDb } from './db'
import { registerErrorHandler } from './http'
import {
  registerApprovalRoutes,
  registerEventRoutes,
  registerHealthRoutes,
  registerTaskRoutes,
  registerWorkspaceRoutes,
} from './routes'

export interface CreateRunnerServerOptions extends LoadRunnerConfigOptions {
  config?: RunnerConfig
  db?: RunnerDb
  logger?: boolean
}

export async function createRunnerServer(
  options: CreateRunnerServerOptions = {},
): Promise<FastifyInstance> {
  const config = options.config || loadRunnerConfig(options)
  const db = options.db || createJsonFileRunnerDb(config.dbFile)

  await db.load()

  const app = fastify({
    logger: options.logger ?? false,
  })

  const context = createRunnerContext(config, db)

  app.decorate('forgeagent', context)

  registerErrorHandler(app)
  registerHealthRoutes(app, context)
  registerWorkspaceRoutes(app, context)
  registerTaskRoutes(app, context)
  registerApprovalRoutes(app, context)
  registerEventRoutes(app, context)

  return app
}

export async function startRunnerServer(
  options: CreateRunnerServerOptions = {},
): Promise<FastifyInstance> {
  const app = await createRunnerServer(options)
  const config = options.config || loadRunnerConfig(options)

  await app.listen({
    host: config.host,
    port: config.port,
  })

  return app
}
