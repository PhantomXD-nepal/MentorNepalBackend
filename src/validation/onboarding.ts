import { z } from 'zod'

export const roleSchema = z.object({
  body: z.object({
    role: z.enum(['mentor', 'mentee']),
  }),
})

export const mentorProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(1),
    headline: z.string().min(1),
    bio: z.string().min(10),
    expertise: z.array(z.string()).min(1),
    yearsExp: z.number().int().min(0),
    hourlyRate: z.number().int().min(0).default(0),
    company: z.string().optional(),
    title: z.string().optional(),
    avatarUrl: z.string().url().optional(),
    linkedinUrl: z.string().url().optional(),
    location: z.string().optional(),
    languages: z.array(z.string()).optional(),
  }),
})

export const menteeProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(1),
    goals: z.array(z.string()).min(1),
    careerStage: z.enum(['student', 'early', 'mid', 'senior']),
    interests: z.array(z.string()).optional(),
    bio: z.string().optional(),
    avatarUrl: z.string().url().optional(),
  }),
})