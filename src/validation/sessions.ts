import { z } from 'zod'

export const bookSessionSchema = z.object({
  body: z
    .object({
      mentorId: z.string().min(1, 'mentorId is required'),
      startTime: z
        .string()
        .datetime({ message: 'startTime must be a valid ISO 8601 datetime' }),
      endTime: z
        .string()
        .datetime({ message: 'endTime must be a valid ISO 8601 datetime' }),
      topic: z.string().max(200).optional(),
      notes: z.string().max(1000).optional(),
    })
    .refine(data => new Date(data.endTime) > new Date(data.startTime), {
      message: 'endTime must be after startTime',
      path: ['endTime'],
    })
    .refine(
      data => {
        const mins =
          (new Date(data.endTime).getTime() -
            new Date(data.startTime).getTime()) /
          60000
        return mins >= 15 && mins <= 120
      },
      {
        message: 'Session must be between 15 and 120 minutes',
        path: ['endTime'],
      },
    ),
})

export const cancelSessionSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
  params: z.object({
    sessionId: z.string().min(1),
  }),
})

export const sessionIdParamSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1),
  }),
})

export const getSessionsQuerySchema = z.object({
  query: z.object({
    status: z
      .enum(['pending', 'confirmed', 'cancelled', 'completed'])
      .optional(),
    role: z.enum(['mentor', 'mentee']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})