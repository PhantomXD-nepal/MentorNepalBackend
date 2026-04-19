import type { Request, Response, NextFunction } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../auth'

// Extend Express Request type to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        name?: string | null
        image?: string | null
        role?: string | null | undefined
        onboardingComplete?: boolean
        emailVerified: boolean
        createdAt: Date
        updatedAt: Date
      }
      session?: {
        id: string
        userId: string
        expiresAt: Date
        token: string
        ipAddress?: string | null
        userAgent?: string | null
      }
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })

    if (!session) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      })
      return
    }

    req.user = {
      ...session.user,
      role: session.user.role ?? undefined,
      onboardingComplete: session.user.onboardingComplete ?? undefined,
    }
    req.session = session.session
    next()
  } catch (error) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid session',
    })
  }
}
