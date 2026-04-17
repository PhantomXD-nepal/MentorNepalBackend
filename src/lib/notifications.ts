import { db } from '../db'
import { notifications, mentorProfiles, menteeProfiles } from '../schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { cache, CacheKeys, CacheTTL } from '../cache'
import { logger } from '../logger'

// Canonical notification types matching the swagger spec
export type NotificationType =
  | 'session_booked'
  | 'session_confirmed'
  | 'session_cancelled'
  | 'session_completed'
  | 'session_reminder'
  | 'review_received'
  | 'verification_approved'
  | 'verification_rejected'

/**
 * Create a notification for a user and invalidate their notification caches.
 */
export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
}) {
  const { userId, type, title, body, data } = params

  const notification = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      body,
      data: data ? JSON.stringify(data) : null,
    })
    .returning()
    .get()

  // Invalidate notification caches for this user
  cache.deletePattern(`notifications:${userId}`)
  cache.delete(CacheKeys.notificationUnreadCount(userId))

  return notification
}

/**
 * Get a user's notifications with pagination, cached.
 */
export async function getUserNotifications(
  userId: string,
  page: number,
  limit: number,
  unreadOnly: boolean = false,
) {
  const cacheKey = CacheKeys.notifications(userId, page, limit)
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const conditions = [eq(notifications.userId, userId)]
  if (unreadOnly) {
    conditions.push(sql`${notifications.isRead} = 0`)
  }

  const where = and(...conditions)
  const offset = (page - 1) * limit

  const [data, countResult, unreadResult] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(where)
      .get(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          sql`${notifications.isRead} = 0`,
        ),
      )
      .get(),
  ])

  const total = countResult?.count ?? 0
  const unreadCount = unreadResult?.count ?? 0

  const payload = {
    data: data.map(n => ({
      ...n,
      data: n.data ? JSON.parse(n.data) : null,
    })),
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }

  cache.set(cacheKey, payload, CacheTTL.NOTIFICATIONS)

  return payload
}

/**
 * Get the unread count for a user, cached.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const cacheKey = CacheKeys.notificationUnreadCount(userId)
  const cached = cache.get<number>(cacheKey)
  if (cached !== undefined) return cached

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        sql`${notifications.isRead} = 0`,
      ),
    )
    .get()

  const count = result?.count ?? 0
  cache.set(cacheKey, count, CacheTTL.NOTIFICATIONS)
  return count
}

/**
 * Mark a specific notification as read.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
) {
  const notification = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .get()

  if (!notification) return null

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId))

  // Invalidate notification caches
  cache.deletePattern(`notifications:${userId}`)
  cache.delete(CacheKeys.notificationUnreadCount(userId))

  return { ...notification, isRead: true }
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, userId),
        sql`${notifications.isRead} = 0`,
      ),
    )

  // Invalidate notification caches
  cache.deletePattern(`notifications:${userId}`)
  cache.delete(CacheKeys.notificationUnreadCount(userId))

  return { success: true }
}

/**
 * Helper: resolve a mentor's userId from their mentor profile ID.
 */
export async function getMentorUserId(mentorId: string): Promise<string | null> {
  const result = await db
    .select({ userId: mentorProfiles.userId })
    .from(mentorProfiles)
    .where(eq(mentorProfiles.id, mentorId))
    .get()
  return result?.userId ?? null
}

/**
 * Helper: resolve a mentee's userId from their mentee profile ID.
 */
export async function getMenteeUserId(menteeId: string): Promise<string | null> {
  const result = await db
    .select({ userId: menteeProfiles.userId })
    .from(menteeProfiles)
    .where(eq(menteeProfiles.userId, menteeId))
    .get()
  return result?.userId ?? null
}
