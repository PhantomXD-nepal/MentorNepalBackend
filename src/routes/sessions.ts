import { Router } from 'express'
import { requireAuth, requireRole, validate } from '../middleware'

import { logger } from '../logger'
import { db } from '../db'
import { menteeProfiles, mentorProfiles, sessions } from '../schema'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { getMentorDetailsById, getMentorDetailsByUserId } from '../lib/mentors'
import { assertParticipant, getProfilesForUser } from '../lib/session'
import {
  createNotification,
  getMentorUserId,
  getMenteeUserId,
} from '../lib/notifications'
import { cache, CacheKeys, CacheTTL } from '../cache'
import {
  bookSessionSchema,
  cancelSessionSchema,
  sessionIdParamSchema,
  getSessionsQuerySchema,
} from '../validation'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Sessions
 *   description: Mentorship session management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Session:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         mentorId:
 *           type: string
 *         menteeId:
 *           type: string
 *         startTime:
 *           type: string
 *           format: date-time
 *         endTime:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *         topic:
 *           type: string
 *         notes:
 *           type: string
 *         dailyRoomUrl:
 *           type: string
 *         price:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *     SessionCreate:
 *       type: object
 *       required:
 *         - mentorId
 *         - startTime
 *         - endTime
 *       properties:
 *         mentorId:
 *           type: string
 *         startTime:
 *           type: string
 *           format: date-time
 *         endTime:
 *           type: string
 *           format: date-time
 *         topic:
 *           type: string
 *         notes:
 *           type: string
 */

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Book a new mentorship session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SessionCreate'
 *     responses:
 *       201:
 *         description: Session created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       400:
 *         description: Invalid time slot
 *       401:
 *         description: Not authenticated
 *       409:
 *         description: Time slot not available
 *       429:
 *         description: Rate limit exceeded (10 req/hour)
 */
router.post('/', requireAuth, validate(bookSessionSchema), async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED' })
    }

    const { mentorId, startTime, endTime, topic, notes } = req.body

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res
        .status(400)
        .json({ error: 'BAD_REQUEST', message: 'Invalid time range' })
    }
    logger.debug(userId)

    const durationMins = Math.round((end.getTime() - start.getTime()) / 60000)

    const menteeProfile = await db
      .select()
      .from(menteeProfiles)
      .where(eq(menteeProfiles.userId, userId))
      .get()

    if (!menteeProfile) {
      return res
        .status(403)
        .json({ error: 'FORBIDDEN', message: 'Only mentees can book sessions' })
    }

    const mentorProfile = await getMentorDetailsById(mentorId)
    if (!mentorProfile) {
      return res
        .status(404)
        .json({ error: 'NOT_FOUND', mesage: 'Mentor not found' })
    }
    const scheduledAtISO = start.toISOString()
    const conflict = await db
      .select()
      .from(sessions)
      .where(
        and(
          or(
            eq(sessions.mentorId, mentorId),
            eq(sessions.menteeId, menteeProfile.id),
          ),
          or(eq(sessions.status, 'pending'), eq(sessions.status, 'confirmed')),
          // Overlap: existing.scheduledAt < end AND existing.scheduledAt + duration > start
          sql`datetime(${sessions.scheduledAt}) < datetime(${end.toISOString()})`,
          sql`datetime(${sessions.scheduledAt}, '+' || ${sessions.durationMins} || ' minutes') > datetime(${scheduledAtISO})`,
        ),
      )
      .get()

    if (conflict) {
      return res
        .status(409)
        .json({ error: 'CONFLICT', message: 'Time slot is not available' })
    }
    const roomName = crypto.randomUUID()
    const meetingUrl = `https://meet.jit.si/${roomName}`

    const newSession = await db.transaction(tx => {
      return tx
        .insert(sessions)
        .values({
          mentorId,
          menteeId: menteeProfile.id,
          scheduledAt: scheduledAtISO,
          durationMins,
          status: 'pending',
          meetingUrl,
          topic: topic ?? null,
          menteeNote: notes ?? null,
        })
        .returning()
        .get()
    })

    // Notify the mentor that a session was booked
    try {
      const mentorUserId = await getMentorUserId(mentorId)
      if (mentorUserId) {
        await createNotification({
          userId: mentorUserId,
          type: 'session_booked',
          title: 'New Session Booked',
          body: `A mentee has booked a session with you on ${start.toLocaleDateString()}`,
          data: {
            sessionId: newSession.id,
            mentorId,
            scheduledAt: scheduledAtISO,
          },
        })
      }
    } catch (notifError) {
      logger.error({ notifError }, 'Failed to send session_booked notification')
    }

    // Invalidate session caches
    cache.deletePattern(`sessions:`)

    return res.status(201).json(newSession)
  } catch (error) {
    logger.error(`Error when booking session ${error}`)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
})

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Get user's sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [mentor, mentee]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/',
  requireAuth,
  validate(getSessionsQuerySchema),
  async (req, res) => {
    try {
      const userId = req.user?.id

      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

      const { status, role, page, limit } = req.query as unknown as {
        status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
        role?: 'mentor' | 'mentee'
        page: number
        limit: number
      }

      // Try cache first
      const cacheKey = CacheKeys.userSessions(userId, page, limit, status, role)
      const cached = cache.get(cacheKey)
      if (cached) {
        res.locals.cached = true
        return res.json(cached)
      }
      const offset = (page - 1) * limit

      const { mentor, mentee } = await getProfilesForUser(userId)
      let roleFilter
      if (role === 'mentor' && mentor) {
        roleFilter = eq(sessions.mentorId, mentor.id)
      } else if (role === 'mentee' && mentee) {
        roleFilter = eq(sessions.menteeId, mentee.id)
      } else {
        // Return sessions where user is either participant
        const conditions = []
        if (mentor) conditions.push(eq(sessions.mentorId, mentor.id))
        if (mentee) conditions.push(eq(sessions.menteeId, mentee.id))
        if (conditions.length === 0)
          return res.json({
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          })
        roleFilter = conditions.length === 1 ? conditions[0] : or(...conditions)
      }

      const statusFilter = status ? eq(sessions.status, status) : undefined
      const whereClause = statusFilter
        ? and(roleFilter, statusFilter)
        : roleFilter

      const [data, countResult] = await Promise.all([
        db
          .select()
          .from(sessions)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .all(),
        db
          .select({ count: sql<number>`count(*)` })
          .from(sessions)
          .where(whereClause)
          .get(),
      ])

      const total = countResult?.count ?? 0

      const payload = {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }

      cache.set(cacheKey, payload, CacheTTL.USER_SESSIONS)

      return res.json(payload)
    } catch (error) {
      logger.error(`Error fetching user sessions ${error}`)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Get session details
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 */
router.get(
  '/:sessionId',
  requireAuth,
  validate(sessionIdParamSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

      const { sessionId } = req.params as { sessionId: string }

      // Try cache first
      const cacheKey = CacheKeys.sessionDetail(sessionId)
      const cached = cache.get(cacheKey)
      if (cached) {
        // Still need to verify the user is a participant
        const { mentor, mentee } = await getProfilesForUser(userId)
        const participant = assertParticipant(
          cached as any,
          mentor?.id,
          mentee?.id,
        )
        if (!participant)
          return res
            .status(403)
            .json({ error: 'FORBIDDEN', message: 'Not authorized' })
        res.locals.cached = true
        return res.json(cached)
      }

      const session = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get()

      if (!session)
        return res
          .status(404)
          .json({ error: 'NOT_FOUND', message: 'Session not found' })

      const { mentor, mentee } = await getProfilesForUser(userId)
      const participant = assertParticipant(session, mentor?.id, mentee?.id)

      if (!participant)
        return res
          .status(403)
          .json({ error: 'FORBIDDEN', message: 'Not authorized' })

      cache.set(cacheKey, session, CacheTTL.SESSION_DETAIL)

      return res.json(session)
    } catch (err) {
      return res
        .status(500)
        .json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch session' })
    }
  },
)

/**
 * @swagger
 * /api/sessions/{sessionId}/confirm:
 *   patch:
 *     summary: Confirm a pending session (mentor only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session confirmed
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 *       409:
 *         description: Session already confirmed/cancelled
 */
router.patch(
  '/:sessionId/confirm',
  requireRole('mentor'),
  validate(sessionIdParamSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

      const { sessionId } = req.params as { sessionId: string }

      const session = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get()

      const mentorProfile = await getMentorDetailsByUserId(userId)

      if (!session)
        return res
          .status(404)
          .json({ error: 'NOT_FOUND', message: 'Session not found' })
      if (
        !mentorProfile ||
        session.mentorId !== (mentorProfile as { id: string }).id
      )
        return res
          .status(403)
          .json({ error: 'FORBIDDEN', message: 'Not your session' })
      if (session.status !== 'pending') {
        return res.status(409).json({
          error: 'CONFLICT',
          message: `Session is already ${session.status}`,
        })
      }
      const updated = await db
        .update(sessions)
        .set({ status: 'confirmed', updatedAt: sql`(datetime('now'))` })
        .where(eq(sessions.id, session.id))
        .returning()
        .get()

      // Notify the mentee that the session is confirmed
      try {
        const menteeUserId = await getMenteeUserId(session.menteeId)
        if (menteeUserId) {
          await createNotification({
            userId: menteeUserId,
            type: 'session_confirmed',
            title: 'Session Confirmed',
            body: `Your session on ${new Date(session.scheduledAt).toLocaleDateString()} has been confirmed by the mentor`,
            data: { sessionId: session.id, mentorId: session.mentorId },
          })
        }
      } catch (notifError) {
        logger.error(
          { notifError },
          'Failed to send session_confirmed notification',
        )
      }

      // Invalidate caches
      cache.deletePattern('sessions:')
      cache.delete(CacheKeys.sessionDetail(session.id))

      return res.json(updated)
    } catch (error) {
      logger.error(`Error when confirming meeting/session ${error}`)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

/**
 * @swagger
 * /api/sessions/{sessionId}/cancel:
 *   patch:
 *     summary: Cancel a session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session cancelled
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 */
router.patch(
  '/:sessionId/cancel',
  requireAuth,
  validate(cancelSessionSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

      const sessionId = req.params.sessionId
      if (Array.isArray(sessionId)) {
        return res
          .status(400)
          .json({ error: 'BAD_REQUEST', message: 'Invalid session ID' })
      }

      const session = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get()

      if (!session)
        return res
          .status(404)
          .json({ error: 'NOT_FOUND', message: 'Session Not Found' })

      const { mentor, mentee } = await getProfilesForUser(userId)

      if (!mentor || mentor.id !== session.mentorId)
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Not authorized to cancel this session',
        })

      if (session.status === 'cancelled' || session.status === 'completed') {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'Session is already completed or is cancelled',
        })
      }

      const updated = await db
        .update(sessions)
        .set({
          status: 'cancelled',
          cancelledBy: userId,
          cancelReason: req.body.reason ?? null,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(sessions.id, session.id))
        .returning()
        .get()

      // Notify the other party about cancellation
      try {
        const isCancelledByMentor = mentor && mentor.id === session.mentorId
        if (isCancelledByMentor) {
          const menteeUserId = await getMenteeUserId(session.menteeId)
          if (menteeUserId) {
            await createNotification({
              userId: menteeUserId,
              type: 'session_cancelled',
              title: 'Session Cancelled',
              body: `Your session on ${new Date(session.scheduledAt).toLocaleDateString()} has been cancelled by the mentor`,
              data: { sessionId: session.id, cancelledBy: userId },
            })
          }
        } else {
          const mentorUserId = await getMentorUserId(session.mentorId)
          if (mentorUserId) {
            await createNotification({
              userId: mentorUserId,
              type: 'session_cancelled',
              title: 'Session Cancelled',
              body: `The session on ${new Date(session.scheduledAt).toLocaleDateString()} has been cancelled by the mentee`,
              data: { sessionId: session.id, cancelledBy: userId },
            })
          }
        }
      } catch (notifError) {
        logger.error(
          { notifError },
          'Failed to send session_cancelled notification',
        )
      }

      // Invalidate caches
      cache.deletePattern('sessions:')
      cache.delete(CacheKeys.sessionDetail(session.id))

      return res.json(updated)
    } catch (error) {
      logger.error(`Error cancelling session ${error}`)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

/**
 * @swagger
 * /api/sessions/{sessionId}/complete:
 *   patch:
 *     summary: Mark session as completed (auto or manual)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session completed
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Session not found
 */
router.patch(
  '/:sessionId/complete',
  requireAuth,
  validate(sessionIdParamSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

      const mentorProfile = await db
        .select()
        .from(mentorProfiles)
        .where(eq(mentorProfiles.userId, userId))
        .get()

      if (!mentorProfile)
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Only mentors can complete sessions',
        })

      const { sessionId } = req.params as { sessionId: string }

      const session = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get()

      if (!session)
        return res
          .status(404)
          .json({ error: 'NOT_FOUND', message: 'Session not found' })
      if (session.mentorId !== mentorProfile.id)
        return res
          .status(403)
          .json({ error: 'FORBIDDEN', message: 'Not your session' })

      if (session.status !== 'confirmed') {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'Only confirmed sessions can be completed',
        })
      }

      const [updated] = await Promise.all([
        db
          .update(sessions)
          .set({ status: 'completed', updatedAt: sql`(datetime('now'))` })
          .where(eq(sessions.id, session.id))
          .returning()
          .get(),
        db
          .update(mentorProfiles)
          .set({ totalSessions: sql`${mentorProfiles.totalSessions} + 1` })
          .where(eq(mentorProfiles.id, mentorProfile.id)),
      ])

      // Notify the mentee that the session is completed
      try {
        const menteeUserId = await getMenteeUserId(session.menteeId)
        if (menteeUserId) {
          await createNotification({
            userId: menteeUserId,
            type: 'session_completed',
            title: 'Session Completed',
            body: `Your session on ${new Date(session.scheduledAt).toLocaleDateString()} has been marked as completed. Don't forget to leave a review!`,
            data: { sessionId: session.id, mentorId: session.mentorId },
          })
        }
      } catch (notifError) {
        logger.error(
          { notifError },
          'Failed to send session_completed notification',
        )
      }

      // Invalidate caches
      cache.deletePattern('sessions:')
      cache.delete(CacheKeys.sessionDetail(session.id))
      cache.delete(CacheKeys.mentorProfile(mentorProfile.id))
      cache.deletePattern('mentors:list')

      return res.json(updated)
    } catch (error) {
      logger.error(`Error when completing session ${error}`)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  },
)

/**
 * @swagger
 * /api/sessions/{sessionId}/join:
 *   get:
 *     summary: Get room URL to join session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roomUrl:
 *                   type: string
 *                 token:
 *                   type: string
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Session not yet started or already ended
 *       404:
 *         description: Session not found
 */
router.get(
  '/:sessionId/join',
  requireAuth,
  validate(sessionIdParamSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

      const { sessionId } = req.params as { sessionId: string }

      const session = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get()

      if (!session)
        return res
          .status(404)
          .json({ error: 'NOT_FOUND', message: 'Session not found' })

      const { mentor, mentee } = await getProfilesForUser(userId)
      const participant = assertParticipant(session, mentor?.id, mentee?.id)

      if (!participant)
        return res
          .status(403)
          .json({ error: 'FORBIDDEN', message: 'Not authorized' })

      if (session.status !== 'confirmed') {
        return res
          .status(403)
          .json({ error: 'FORBIDDEN', message: 'Session is not confirmed' })
      }

      // Allow joining 5 minutes early, block after session should have ended
      const now = Date.now()
      const start = new Date(session.scheduledAt).getTime()
      const end = start + (session.durationMins ?? 30) * 60000
      const EARLY_JOIN_MS = 5 * 60 * 1000

      if (now < start - EARLY_JOIN_MS) {
        return res
          .status(403)
          .json({ error: 'TOO_EARLY', message: 'Session has not started yet' })
      }

      if (now > end) {
        return res
          .status(403)
          .json({ error: 'EXPIRED', message: 'Session has already ended' })
      }

      return res.json({ roomUrl: session.meetingUrl })
    } catch (err) {
      return res
        .status(500)
        .json({ error: 'INTERNAL_ERROR', message: 'Failed to get room URL' })
    }
  },
)

export default router
