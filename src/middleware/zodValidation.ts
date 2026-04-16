import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

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

    // Write coerced/defaulted values back onto the request
    if (result.data.body) req.body = result.data.body
    if (result.data.query) req.query = result.data.query as typeof req.query
    if (result.data.params) req.params = result.data.params

    next()
  }
}
