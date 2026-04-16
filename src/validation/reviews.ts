import { z } from 'zod'

export const createReviewSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'sessionId is required'),
    rating: z.number().int().min(1).max(5),
    content: z.string().max(1000).optional(),
  }),
})

export const getMentorReviewsSchema = z.object({
  params: z.object({
    mentorId: z.string().min(1),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})
