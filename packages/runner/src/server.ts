import { createForgeAgentError } from '@forgeagent/core'
import fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { loadRunnerConfig } from './config'
import type { LoadRunnerConfigOptions, RunnerConfig } from './config'
import { createRunnerContext } from './context'
import type { RunnerContext } from './context'
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

export interface RunnerServerInstance extends FastifyInstance {
  forgeagent: RunnerContext
}

export interface CreateRunnerServerOptions extends LoadRunnerConfigOptions {
  config?: RunnerConfig
  db?: RunnerDb
  logger?: boolean
}

export async function createRunnerServer(
  options: CreateRunnerServerOptions = {},
): Promise<RunnerServerInstance> {
  const config = options.config || loadRunnerConfig(options)
  const db = options.db || createJsonFileRunnerDb(config.dbFile)

  await db.load()

  const app = fastify({
    logger: options.logger ?? false,
  }) as unknown as RunnerServerInstance

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

function isAddressInUse(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code: unknown }).code) === 'EADDRINUSE'
  )
}

export async function startRunnerServer(
  options: CreateRunnerServerOptions = {},
): Promise<RunnerServerInstance> {
  const app = await createRunnerServer(options)
  const config = options.config || loadRunnerConfig(options)

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    })
  } catch (error) {
    if (isAddressInUse(error)) {
      throw createForgeAgentError(
        'RUNNER_PORT_IN_USE',
        `Runner port is already in use: ${config.host}:${config.port}`,
        {
          host: config.host,
          port: config.port,
          hint: 'Stop the existing runner or choose another port with FORGEAGENT_RUNNER_PORT.',
        },
      )
    }

    throw error
  }

  return app
}
