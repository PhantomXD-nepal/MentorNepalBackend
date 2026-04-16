import type { Request, Response, NextFunction } from 'express'
import { auth } from '../auth'
import { fromNodeHeaders } from 'better-auth/node'
import { logger } from '../logger'
import { getUserDetailsFromEmail } from '../lib/auth'

export function requireRole(...roles: string[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.headers.authorization) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        })
        return
      }

      const userSession = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      })

      if (!userSession) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid session',
        })
        return
      }

      const userData = await getUserDetailsFromEmail(userSession.user.email)

      if (!userData) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'User not found',
        })
        return
      }

      logger.debug({ userId: userData.id }, 'requireRole: user loaded')

      let role = userData.role

      if (!role) {
        role = 'mentee'
      }
      if (!roles.includes(role)) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: `Requires role: ${roles.join(', ')}`,
        })
        return
      }

      // Optional: attach to req for later use
      req.user = {
        id: userData.id,
        email: userData.email,
        role: userData.role,
      } as any

      next()
    } catch (err) {
      logger.error(`requireRole error: ${err}`)
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      })
    }
  }
}