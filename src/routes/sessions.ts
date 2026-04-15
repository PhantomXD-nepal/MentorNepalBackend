import { Router } from 'express'
import { requireAuth } from '../middleware'

import { z } from 'zod'
import { logger } from '../logger'
import { db } from '../db'
import { menteeProfiles, sessions } from '../schema'
import { and, eq, or, sql } from 'drizzle-orm'
import { getMentorDetailsById } from '../lib/mentors'
import { getProfilesForUser } from '../lib/session'

// ---- Schemas ----

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
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id

    const { mentorId, startTime, endTime, topic, notes } = req.body
    const result = bookSessionSchema.safeParse({
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
    const start = new Date(startTime)
    const end = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res
        .status(400)
        .json({ error: 'BAD_REQUEST', message: 'Invalid time range' })
    }
    logger.debug(userId)

    const durationMins = Math.round((end.getTime() - start.getTime()) / 60000)

    const menteeProfile = db
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
    const conflict = db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.mentorId, mentorId),
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

    const newSession = await db
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

    return res.status(201).json(newSession)
  } catch (error) {
    logger.error(`Error when booking session ${error}`)
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
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

    const { status, role } = req.query
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    )
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

    const statusFilter = status
      ? eq(sessions.status, status as string)
      : undefined
    const where = statusFilter ? and(roleFilter, statusFilter) : roleFilter

    const [data, countResult] = await Promise.all([
      db.select().from(sessions).where(where).limit(limit).offset(offset).all(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(sessions)
        .where(where)
        .get(),
    ])

    const total = countResult?.count ?? 0

    return res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    logger.error(`Error fetching user sessions ${error}`)
  }
})

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
router.get('/:sessionId', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

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
router.patch('/:sessionId/confirm', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

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
router.patch('/:sessionId/cancel', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

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
router.patch('/:sessionId/complete', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

/**
 * @swagger
 * /api/sessions/{sessionId}/join:
 *   get:
 *     summary: Get Daily.co room URL to join session
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
router.get('/:sessionId/join', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
