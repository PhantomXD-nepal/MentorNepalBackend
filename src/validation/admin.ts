// validation/admin.ts
import { z } from 'zod'

export const getVerificationRequestsSchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

export const reviewVerificationRequestSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(['approved', 'rejected']),
    notes: z.string().max(1000).optional(),
  }),
})

export const getUsersSchema = z.object({
  query: z.object({
    role: z.enum(['mentee', 'mentor', 'admin']).optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

export const suspendMentorSchema = z.object({
  params: z.object({
    mentorId: z.string().min(1),
  }),
  body: z.object({
    suspended: z.boolean(),
    reason: z.string().max(500).optional(),
  }),
})
