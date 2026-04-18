import type { Request, Response, NextFunction } from 'express'
import { logger } from '../logger'

// simple ANSI colors (no dependency)
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`

/** Paths that should be excluded from request logging */
const SKIP_PATHS = new Set(['/health', '/favicon.ico'])

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Skip logging for health checks and self-pings
  const path = req.route?.path ?? req.originalUrl ?? req.url
  if (SKIP_PATHS.has(path) || req.headers['x-self-ping'] === 'true') {
    return next()
  }

  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - start
    const elapsedMs = Number(elapsedNs) / 1_000_000

    const method = req.method
    const status = res.statusCode
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown'
    const ua = req.get('user-agent') ?? 'unknown'
    const cached = res.locals.cached === true

    // base log line
    let line = `${method} ${path} ${status} ${elapsedMs.toFixed(2)}ms`

    // append metadata (dimmed so it doesn't scream)
    line += ` ${dim(`ip=${ip} ua="${ua}"`)}`

    // highlight cached
    if (cached) {
      line = yellow(line + ' [CACHED]')
    }

    logger.info(line)
  })

  next()
}
