import { Router } from 'express'
import {
  createReviewSchema,
  getMentorReviewsSchema,
} from '../validation/reviews'
import { requireAuth, validate } from '../middleware'
import { db } from '../db'
import { menteeProfiles, mentorProfiles, reviews, sessions } from '../schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { logger } from '../logger'
import { cache, CacheKeys, CacheTTL } from '../cache'
import { createNotification, getMentorUserId } from '../lib/notifications'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Session reviews and ratings
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         sessionId:
 *           type: string
 *         mentorId:
 *           type: string
 *         menteeId:
 *           type: string
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         content:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *     ReviewCreate:
 *       type: object
 *       required:
 *         - sessionId
 *         - rating
 *       properties:
 *         sessionId:
 *           type: string
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         content:
 *           type: string
 */

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Submit a review for a completed session
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewCreate'
 *     responses:
 *       201:
 *         description: Review created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Session not completed or already reviewed
 *       404:
 *         description: Session not found
 *       429:
 *         description: Rate limit exceeded (5 req/hour)
 */
// POST /api/reviews
router.post(
  '/',
  requireAuth,
  validate(createReviewSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' })

      const { sessionId, rating, content } = req.body

      const menteeProfile = await db
        .select()
        .from(menteeProfiles)
        .where(eq(menteeProfiles.userId, userId))
        .get()

      if (!menteeProfile) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Only mentees can leave reviews',
        })
      }

      const session = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get()

      if (!session) {
        return res
          .status(404)
          .json({ error: 'NOT_FOUND', message: 'Session not found' })
      }

      if (session.menteeId !== menteeProfile.id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You were not part of this session',
        })
      }

      if (session.status !== 'completed') {
        return res
          .status(403)
          .json({ error: 'FORBIDDEN', message: 'Session is not completed yet' })
      }

      const newReview = await db.transaction(async tx => {
        const existing = await tx
          .select()
          .from(reviews)
          .where(eq(reviews.sessionId, sessionId))
          .get()

        if (existing) {
          throw new Error('ALREADY_REVIEWED')
        }

        const review = await tx
          .insert(reviews)
          .values({
            sessionId,
            mentorId: session.mentorId,
            menteeId: menteeProfile.id,
            rating,
            comment: content ?? null,
          })
          .returning()
          .get()

        await tx
          .update(mentorProfiles)
          .set({
            reviewCount: sql`${mentorProfiles.reviewCount} + 1`,
            avgRating: sql`
            ROUND(
              (${mentorProfiles.avgRating} * ${mentorProfiles.reviewCount} + ${rating})
              / (${mentorProfiles.reviewCount} + 1),
              2
            )
          `,
          })
          .where(eq(mentorProfiles.id, session.mentorId))

        return review
      })

      if (!newReview) {
        return res.status(409).json({
          error: 'ALREADY_REVIEWED',
          message: 'Session has already been reviewed',
        })
      }

      // Invalidate all cached review pages and the mentor profile for this mentor
      // since avgRating and reviewCount have changed
      cache.deletePattern(`mentor:reviews:${session.mentorId}`)
      cache.delete(CacheKeys.mentorProfile(session.mentorId))
      cache.deletePattern('mentors:list')

      // Notify the mentor about the new review
      try {
        const mentorUserId = await getMentorUserId(session.mentorId)
        if (mentorUserId) {
          await createNotification({
            userId: mentorUserId,
            type: 'review_received',
            title: 'New Review Received',
            body: `You received a ${rating}-star review from a mentee`,
            data: { reviewId: newReview.id, sessionId, rating },
          })
        }
      } catch (notifError) {
        logger.error({ notifError }, 'Failed to send review_received notification')
      }

      return res.status(201).json({
        ...newReview,
        content: newReview.comment,
        comment: undefined,
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_REVIEWED') {
        return res.status(409).json({
          error: 'ALREADY_REVIEWED',
          message: 'Session has already been reviewed',
        })
      }

      logger.error({ err }, 'Failed to submit review')
      return res
        .status(500)
        .json({ error: 'INTERNAL_ERROR', message: 'Failed to submit review' })
    }
  },
)

/**
 * @swagger
 * /api/reviews/{mentorId}:
 *   get:
 *     summary: Get reviews for a mentor (cached)
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: mentorId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: List of reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     average:
 *                       type: number
 *                     total:
 *                       type: integer
 *                 pagination:
 *                   type: object
 *       404:
 *         description: Mentor not found
 */
router.get('/:mentorId', validate(getMentorReviewsSchema), async (req, res) => {
  try {
    const { mentorId } = req.params as { mentorId: string }
    const { page, limit } = req.query as unknown as {
      page: number
      limit: number
    }
    const offset = (page - 1) * limit

    const cacheKey = CacheKeys.mentorReviews(mentorId, page, limit)
    const cached = cache.get(cacheKey)
    if (cached) return res.json(cached)

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

    const where = and(
      eq(reviews.mentorId, mentorId),
      eq(reviews.isPublic, true),
    )

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviews)
        .where(where)
        .get(),
    ])

    const total = countResult?.count ?? 0

    const payload = {
      data: data.map(review => ({
        ...review,
        content: review.comment,
        comment: undefined,
      })),
      stats: {
        average: mentor.avgRating,
        total: mentor.reviewCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }

    cache.set(cacheKey, payload, CacheTTL.MENTOR_REVIEWS)

    return res.json(payload)
  } catch (err) {
    logger.error({ err }, 'Failed to fetch reviews')
    return res
      .status(500)
      .json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch reviews' })
  }
})

export default router
