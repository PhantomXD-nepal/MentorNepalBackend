import type { Request, Response, NextFunction } from 'express'

export function requireOnboarding(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
    })
    return
  }

  if (!req.user.onboardingComplete) {
    res.status(403).json({
      error: 'ONBOARDING_REQUIRED',
      message: 'Please complete onboarding first',
    })
    return
  }

  next()
}
