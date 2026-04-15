import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware'
import { db } from '../db'
import { logger } from '../logger'
import { and, gte, like, lte, sql } from 'drizzle-orm'
import { mentorProfiles } from '../schema'
import {
  fetchMentors,
  getMentorDetailsById,
  getMentorDetailsByUserId,
} from '../lib/mentors'

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
router.get('/', requireAuth, async (req, res) => {
  try {
    res.json(await fetchMentors())
  } catch (error) {
    logger.error(`Error during fetching mentors ${error}`)
  }
})

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
    res.json(await getMentorDetailsById(req.params.mentorId))
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
router.put('/me', requireRole('mentor'), async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing user context',
      })
    }

    const { expertise, experience, hourlyRate, bio, company, title } = req.body

    const updated = await db.update(mentorProfiles).set({
      expertise,
      experience,
      hourlyRate,
      bio,
      company,
      title,
      updatedAt: sql`(datetime('now'))`,
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update mentor profile',
    })
  }
})

export default router
