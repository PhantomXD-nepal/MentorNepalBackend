import { Router } from 'express'
import { requireAuth, requireRole, validate } from '../middleware'
import {
  getMentorsQuerySchema,
  mentorDocumentsSchema,
  mentorIdParamSchema,
  removeMentorDocumentSchema,
  updateMentorProfileSchema,
} from '../validation'
import { db } from '../db'
import { logger } from '../logger'
import { and, eq, gte, like, lte, sql } from 'drizzle-orm'
import { mentorProfiles } from '../schema'
import {
  addMentorDocumentsByUserId,
  fetchMentors,
  getMentorDetailsById,
  getMentorDocumentsById,
  getMentorDetailsByUserId,
  removeMentorDocumentByUserId,
  replaceMentorDocumentsByUserId,
  MentorFilters,
} from '../lib/mentors'
import { cache } from '../cache'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Mentors
 *   description: Mentor discovery and profile endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MentorProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         documents:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *         expertise:
 *           type: array
 *           items:
 *             type: string
 *         experience:
 *           type: string
 *         hourlyRate:
 *           type: number
 *         bio:
 *           type: string
 *         company:
 *           type: string
 *         title:
 *           type: string
 *         verified:
 *           type: boolean
 *         rating:
 *           type: number
 *         reviewCount:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *     MentorListItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         avatar:
 *           type: string
 *         expertise:
 *           type: array
 *           items:
 *             type: string
 *         hourlyRate:
 *           type: number
 *         verified:
 *           type: boolean
 *         rating:
 *           type: number
 *         reviewCount:
 *           type: integer
 *     MentorDocuments:
 *       type: object
 *       properties:
 *         documents:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 */

/**
 * @swagger
 * /api/mentors:
 *   get:
 *     summary: Get list of mentors (paginated, filtered, cached)
 *     tags: [Mentors]
 *     parameters:
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
 *       - in: query
 *         name: expertise
 *         schema:
 *           type: string
 *         description: Comma-separated expertise areas
 *       - in: query
 *         name: minRate
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxRate
 *         schema:
 *           type: number
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of mentors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MentorListItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get(
  '/',
  requireAuth,
  validate(getMentorsQuerySchema),
  async (req, res) => {
    try {
      const filters = req.query as unknown as MentorFilters
      const result = await fetchMentors(filters) as Record<string, any> & { _cached?: boolean }
      if (result._cached) res.locals.cached = true
      const { _cached, ...payload } = result
      res.json(payload)
    } catch (error) {
      logger.error(`Error during fetching mentors ${error}`)
    }
  },
)

/**
 * @swagger
 * /api/mentors/me:
 *   get:
 *     summary: Get current mentor's profile
 *     tags: [Mentors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mentor profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MentorProfile'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: User is not a mentor
 */
router.get('/me', requireRole('mentor'), async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing user in request context',
      })
    }

    const mentorProfile = await getMentorDetailsByUserId(userId)

    if (!mentorProfile) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Mentor profile not found',
      })
    }

    res.json(mentorProfile)
  } catch (err) {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch mentor profile',
    })
  }
})

/**
 * @swagger
 * /api/mentors/{mentorId}/documents:
 *   get:
 *     summary: Get a mentor's verification documents
 *     tags: [Mentors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mentorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mentor documents
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MentorDocuments'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Mentor not found
 */
router.get(
  '/:mentorId/documents',
  requireAuth,
  validate(mentorIdParamSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      const role = req.user?.role
      const { mentorId } = req.params as { mentorId: string }

      if (!userId) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Missing user in request context',
        })
      }

      const mentorDocuments = await getMentorDocumentsById(mentorId)

      if (!mentorDocuments) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Mentor profile not found',
        })
      }

      if (role !== 'admin' && mentorDocuments.userId !== userId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Not authorized to view mentor documents',
        })
      }

      return res.json({ documents: mentorDocuments.documents })
    } catch (error) {
      logger.error({ error }, 'Error fetching mentor documents')
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch mentor documents',
      })
    }
  },
)

/**
 * @swagger
 * /api/mentors/me/documents:
 *   post:
 *     summary: Append verification documents for the current mentor
 *     tags: [Mentors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MentorDocuments'
 *     responses:
 *       200:
 *         description: Updated mentor documents
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: User is not a mentor
 *       404:
 *         description: Mentor profile not found
 */
router.post(
  '/me/documents',
  requireRole('mentor'),
  validate(mentorDocumentsSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Missing user context',
        })
      }

      const documents = await addMentorDocumentsByUserId(
        userId,
        req.body.documents,
      )

      if (!documents) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Mentor profile not found',
        })
      }

      return res.json({ documents })
    } catch (error) {
      logger.error({ error }, 'Error appending mentor documents')
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to append mentor documents',
      })
    }
  },
)

/**
 * @swagger
 * /api/mentors/me/documents:
 *   patch:
 *     summary: Replace verification documents for the current mentor
 *     tags: [Mentors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MentorDocuments'
 *     responses:
 *       200:
 *         description: Updated mentor documents
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: User is not a mentor
 *       404:
 *         description: Mentor profile not found
 */
router.patch(
  '/me/documents',
  requireRole('mentor'),
  validate(mentorDocumentsSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Missing user context',
        })
      }

      const documents = await replaceMentorDocumentsByUserId(
        userId,
        req.body.documents,
      )

      if (!documents) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Mentor profile not found',
        })
      }

      return res.json({ documents })
    } catch (error) {
      logger.error({ error }, 'Error replacing mentor documents')
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to replace mentor documents',
      })
    }
  },
)

/**
 * @swagger
 * /api/mentors/me/documents:
 *   delete:
 *     summary: Remove a single verification document for the current mentor
 *     tags: [Mentors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *             properties:
 *               document:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Updated mentor documents
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: User is not a mentor
 *       404:
 *         description: Mentor profile not found
 */
router.delete(
  '/me/documents',
  requireRole('mentor'),
  validate(removeMentorDocumentSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Missing user context',
        })
      }

      const documents = await removeMentorDocumentByUserId(
        userId,
        req.body.document,
      )

      if (!documents) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Mentor profile not found',
        })
      }

      return res.json({ documents })
    } catch (error) {
      logger.error({ error }, 'Error removing mentor document')
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to remove mentor document',
      })
    }
  },
)

/**
 * @swagger
 * /api/mentors/{mentorId}:
 *   get:
 *     summary: Get mentor profile by ID (cached)
 *     tags: [Mentors]
 *     parameters:
 *       - in: path
 *         name: mentorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mentor profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MentorProfile'
 *       404:
 *         description: Mentor not found
 */
router.get('/:mentorId', async (req, res) => {
  try {
    const result = await getMentorDetailsById(req.params.mentorId) as Record<string, any> & { _cached?: boolean } | null
    if (result && result._cached) res.locals.cached = true
    if (result) {
      const { _cached, ...payload } = result
      res.json(payload)
    } else {
      res.json(null)
    }
  } catch (error) {
    logger.error(`Error when getting a mentor from id ${error}`)
  }
})

/**
 * @swagger
 * /api/mentors/me:
 *   put:
 *     summary: Update current mentor's profile
 *     tags: [Mentors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expertise:
 *                 type: array
 *                 items:
 *                   type: string
 *               experience:
 *                 type: string
 *               hourlyRate:
 *                 type: number
 *               bio:
 *                 type: string
 *               company:
 *                 type: string
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: User is not a mentor
 */
router.put(
  '/me',
  requireRole('mentor'),
  validate(updateMentorProfileSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Missing user context',
        })
      }

      const {
        expertiseTags,
        yearsExp,
        sessionPrice,
        bio,
        fullName,
        headline,
        avatarUrl,
        linkedinUrl,
        location,
        languages,
      } = req.body

      const updateData: Record<string, any> = {
        updatedAt: sql`(datetime('now'))`,
      }

      if (expertiseTags !== undefined)
        updateData.expertiseTags = JSON.stringify(expertiseTags)
      if (yearsExp !== undefined) updateData.yearsExp = yearsExp
      if (sessionPrice !== undefined) updateData.sessionPrice = sessionPrice
      if (bio !== undefined) updateData.bio = bio
      if (fullName !== undefined) updateData.fullName = fullName
      if (headline !== undefined) updateData.headline = headline
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
      if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl
      if (location !== undefined) updateData.location = location
      if (languages !== undefined)
        updateData.languages = JSON.stringify(languages)

      const updated = await db
        .update(mentorProfiles)
        .set(updateData)
        .where(eq(mentorProfiles.userId, userId))
        .returning()
        .get()

      cache.deletePattern('mentors:')

      res.json(updated)
    } catch (err) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update mentor profile',
      })
    }
  },
)

export default router
