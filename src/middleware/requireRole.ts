import type { Request, Response, NextFunction } from 'express'

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      })
      return
    }

    const userRole = req.user.role || 'mentee'

    if (!roles.includes(userRole)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      })
      return
    }

    next()
  }
}
