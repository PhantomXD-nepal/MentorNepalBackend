import { Router } from 'express'
import { requireRole, validate } from '../middleware'
import {
  getMentorAvailabilitySchema,
  getOpenSlotsSchema,
  updateAvailabilitySchema,
} from '../validation/availability'
import { db } from '../db'
import { availabilitySlots, mentorProfiles, sessions } from '../schema'
import { and, eq, or, sql } from 'drizzle-orm'
import { logger } from '../logger'
import { CacheKeys, CacheTTL, cache } from '../cache'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Availability
 *   description: Mentor availability management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AvailabilitySlot:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         mentorId:
 *           type: string
 *         dayOfWeek:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *         startTime:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         endTime:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         createdAt:
 *           type: string
 *           format: date-time
 *     TimeSlot:
 *       type: object
 *       properties:
 *         startTime:
 *           type: string
 *           format: date-time
 *         endTime:
 *           type: string
 *           format: date-time
 *         available:
 *           type: boolean
 */

/**
 * @swagger
 * /api/availability/{mentorId}:
 *   get:
 *     summary: Get mentor's weekly availability
 *     tags: [Availability]
 *     parameters:
 *       - in: path
 *         name: mentorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of availability slots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AvailabilitySlot'
 *       404:
 *         description: Mentor not found
 */
router.get(
  '/:mentorId',
  validate(getMentorAvailabilitySchema),
  async (req, res) => {
    try {
      const { mentorId } = req.params as { mentorId: string }

      // Try cache first
      const cacheKey = CacheKeys.mentorAvailabilitySlots(mentorId)
      const cached = cache.get(cacheKey)
      if (cached) { res.locals.cached = true; return res.json(cached) }

      const mentor = await db
        .select()
        .from(mentorProfiles)
        .where(eq(mentorProfiles.id, mentorId))
        .get()

      if (!mentor) {
        return res
          .status(404)
          .json({ error: 'NOT FOUND', message: 'Selected mentor not found' })
      }
      const slots = await db
        .select()
        .from(availabilitySlots)
        .where(
          and(
            eq(availabilitySlots.mentorId, mentorId),
            eq(availabilitySlots.isActive, true),
          ),
        )
        .all()

      cache.set(cacheKey, slots, CacheTTL.MENTOR_AVAILABILITY_SLOTS)

      return res.json(slots)
    } catch (err) {
      logger.error(err)
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch mentor',
      })
    }
  },
)

/**
 * @swagger
 * /api/availability:
 *   put:
 *     summary: Update current mentor's availability
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - dayOfWeek
 *                     - startTime
 *                     - endTime
 *                   properties:
 *                     dayOfWeek:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 6
 *                     startTime:
 *                       type: string
 *                       pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                     endTime:
 *                       type: string
 *                       pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *     responses:
 *       200:
 *         description: Availability updated
 *       400:
 *         description: Invalid slots
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: User is not a mentor
 */
router.put(
  '/',
  requireRole('mentor'),
  validate(updateAvailabilitySchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

      const mentorProfile = await db
        .select()
        .from(mentorProfiles)
        .where(eq(mentorProfiles.userId, userId))
        .get()

      if (!mentorProfile) {
        return res
          .status(403)
          .json({ error: 'FORBIDDEN', message: 'Mentor profile not found' })
      }

      const { slots }: { slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }> } = req.body

      await db.transaction(tx => {
        tx.delete(availabilitySlots)
          .where(eq(availabilitySlots.mentorId, mentorProfile.id))
          .run()

        tx.insert(availabilitySlots)
          .values(
            slots.map(slot => ({
              mentorId: mentorProfile.id,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              isActive: true,
            })),
          )
          .run()
      })
      // Bust all cached availability for this mentor (all weeks)
      cache.deletePattern(`mentor:availability:${mentorProfile.id}`)
      cache.delete(CacheKeys.mentorAvailabilitySlots(mentorProfile.id))

      const updated = await db
        .select()
        .from(availabilitySlots)
        .where(eq(availabilitySlots.mentorId, mentorProfile.id))
        .all()

      return res.json(updated)
    } catch (err) {
      logger.error(err)
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update availability',
      })
    }
  },
)
/**
 * @swagger
 * /api/availability/{mentorId}/open:
 *   get:
 *     summary: Get open time slots for a specific week (cached)
 *     tags: [Availability]
 *     parameters:
 *       - in: path
 *         name: mentorId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: weekStart
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Week start date (ISO 8601)
 *     responses:
 *       200:
 *         description: List of open time slots
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TimeSlot'
 *       404:
 *         description: Mentor not found
 */
router.get(
  '/:mentorId/open',
  validate(getOpenSlotsSchema),
  async (req, res) => {
    try {
      const { mentorId } = req.params as { mentorId: string }
      const { weekStart } = req.query as { weekStart: string }

      const cacheKey = CacheKeys.mentorAvailability(mentorId, weekStart)
      const cached = cache.get(cacheKey)
      if (cached) { res.locals.cached = true; return res.json(cached) }

      const mentor = await db
        .select()
        .from(mentorProfiles)
        .where(eq(mentorProfiles.id, mentorId))
        .get()

      if (!mentor) {
        return res
          .status(404)
          .json({ error: 'NOT_FOUND', message: 'Mentor not found' })
      }

      // Build the 7 dates for the requested week (Mon–Sun or Sun–Sat depending on weekStart)
      const weekStartDate = new Date(weekStart)
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStartDate)
        d.setDate(d.getDate() + i)
        return d
      })
      const weekEnd = weekDates[6]
      weekEnd.setHours(23, 59, 59, 999)

      // Fetch mentor's recurring weekly slots
      const slots = await db
        .select()
        .from(availabilitySlots)
        .where(
          and(
            eq(availabilitySlots.mentorId, mentorId),
            eq(availabilitySlots.isActive, true),
          ),
        )
        .all()

      if (slots.length === 0) return res.json([])

      // Fetch already-booked sessions in this week
      const bookedSessions = await db
        .select({
          scheduledAt: sessions.scheduledAt,
          durationMins: sessions.durationMins,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.mentorId, mentorId),
            or(
              eq(sessions.status, 'pending'),
              eq(sessions.status, 'confirmed'),
            ),
            sql`datetime(${sessions.scheduledAt}) >= datetime(${weekStartDate.toISOString()})`,
            sql`datetime(${sessions.scheduledAt}) <= datetime(${weekEnd.toISOString()})`,
          ),
        )
        .all()

      // Expand recurring slots into concrete time slots for the week,
      // then mark each as available or taken
      const result = slots.flatMap(slot => {
        // Find the date in this week that matches this slot's dayOfWeek
        const date = weekDates.find(d => d.getDay() === slot.dayOfWeek)
        if (!date) return []

        const [startHour, startMin] = slot.startTime.split(':').map(Number)
        const [endHour, endMin] = slot.endTime.split(':').map(Number)

        const startTime = new Date(date)
        startTime.setHours(startHour, startMin, 0, 0)

        const endTime = new Date(date)
        endTime.setHours(endHour, endMin, 0, 0)

        // Check if any booked session overlaps with this slot
        const isBooked = bookedSessions.some(s => {
          const bookedStart = new Date(s.scheduledAt).getTime()
          const bookedEnd = bookedStart + (s.durationMins ?? 30) * 60000
          return (
            bookedStart < endTime.getTime() && bookedEnd > startTime.getTime()
          )
        })

        return [
          {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            available: !isBooked && startTime > new Date(), // also exclude past slots
          },
        ]
      })

      // Sort chronologically
      result.sort((a, b) => a.startTime.localeCompare(b.startTime))

      cache.set(cacheKey, result, CacheTTL.MENTOR_AVAILABILITY)

      return res.json(result)
    } catch (err) {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch open slots',
      })
    }
  },
)

export default router
