import { z } from 'zod'

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const slotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, 'startTime must be HH:MM format'),
    endTime: z.string().regex(timeRegex, 'endTime must be HH:MM format'),
  })
  .refine(data => data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  })

export const getMentorAvailabilitySchema = z.object({
  params: z.object({
    mentorId: z.string().min(1),
  }),
})

export const getOpenSlotsSchema = z.object({
  params: z.object({
    mentorId: z.string().min(1),
  }),
  query: z.object({
    weekStart: z
      .string()
      .date('weekStart must be a valid ISO date (YYYY-MM-DD)'),
  }),
})

export const updateAvailabilitySchema = z.object({
  body: z.object({
    slots: z
      .array(slotSchema)
      .min(1, 'At least one slot is required')
      .refine(
        slots => {
          // No duplicate day+startTime combinations
          const seen = new Set(slots.map(s => `${s.dayOfWeek}:${s.startTime}`))
          return seen.size === slots.length
        },
        { message: 'Duplicate day + startTime combinations are not allowed' },
      ),
  }),
})
