import type { FastifyInstance } from 'fastify'
import type { RunnerContext } from '../context'
import { RUNNER_NAME, RUNNER_VERSION } from '../config'

export function registerHealthRoutes(
  app: FastifyInstance,
  context: RunnerContext,
): void {
  app.get('/api/health', async () => ({
    ok: true,
    name: RUNNER_NAME,
    version: RUNNER_VERSION,
    host: context.config.host,
    port: context.config.port,
  }))
}
