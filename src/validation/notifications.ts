import { z } from 'zod'

export const getNotificationsQuerySchema = z.object({
  query: z.object({
    unreadOnly: z.coerce.boolean().default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})
