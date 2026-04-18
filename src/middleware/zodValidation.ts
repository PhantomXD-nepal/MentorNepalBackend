// middleware/zodValidation.ts
import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    })

    if (!result.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: result.error.flatten().fieldErrors,
      })
    }

    // req.body is writable, assign directly
    if (result.data.body) {
      req.body = result.data.body
    }

    // req.query and req.params are read-only getters — override with defineProperty
    if (result.data.query) {
      Object.defineProperty(req, 'query', {
        value: result.data.query,
        writable: true,
        configurable: true,
      })
    }

    if (result.data.params) {
      Object.defineProperty(req, 'params', {
        value: result.data.params,
        writable: true,
        configurable: true,
      })
    }

    next()
  }
}
