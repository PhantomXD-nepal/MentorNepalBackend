import { z } from 'zod'

export const updateMentorProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(1).optional(),
    headline: z.string().min(1).optional(),
    bio: z.string().min(10).optional(),
    expertiseTags: z.array(z.string()).min(1).optional(),
    yearsExp: z.number().int().min(0).optional(),
    sessionPrice: z.number().int().min(0).optional(),
    avatarUrl: z.string().url().optional(),
    linkedinUrl: z.string().url().optional(),
    location: z.string().optional(),
    languages: z.array(z.string()).optional(),
  }),
})

export const mentorIdParamSchema = z.object({
  params: z.object({
    mentorId: z.string().min(1),
  }),
})

export const getMentorsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    expertise: z.string().optional(),
    minRate: z.coerce.number().optional(),
    maxRate: z.coerce.number().optional(),
    verified: z.coerce.boolean().optional(),
    search: z.string().optional(),
  }),
})