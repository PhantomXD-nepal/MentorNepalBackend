import { Router } from 'express'
import { requireRole, validate } from '../middleware'
import { and, eq, like, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  verificationRequests,
  mentorProfiles,
  user,
  menteeProfiles,
  reviews,
  sessions,
} from '../schema'
import {
  getUsersSchema,
  getVerificationRequestsSchema,
  reviewVerificationRequestSchema,
  suspendMentorSchema,
} from '../validation/admin'
import { logger } from '../logger'
import { CacheKeys, CacheTTL, cache } from '../cache'
import { createNotification, getMentorUserId } from '../lib/notifications'

const router = Router()
router.use(requireRole('admin'))

function parseDocuments(value: string | null) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
  } catch {
    return []
  }
}

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     VerificationRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         mentorId:
 *           type: string
 *         mentorName:
 *           type: string
 *         documents:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         submittedAt:
 *           type: string
 *           format: date-time
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *         reviewerNotes:
 *           type: string
 *     AdminUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         email:
 *           type: string
 *         name:
 *           type: string
 *         role:
 *           type: string
 *           enum: [mentee, mentor, admin]
 *         onboardingComplete:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     PlatformStats:
 *       type: object
 *       properties:
 *         totalUsers:
 *           type: integer
 *         totalMentors:
 *           type: integer
 *         totalMentees:
 *           type: integer
 *         totalSessions:
 *           type: integer
 *         completedSessions:
 *           type: integer
 *         pendingVerifications:
 *           type: integer
 *         averageSessionRating:
 *           type: number
 */

/**
 * @swagger
 * /api/admin/verification-requests:
 *   get:
 *     summary: Get pending verification requests
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           default: pending
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
 *         description: List of verification requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VerificationRequest'
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 */
router.get(
  '/verification-requests',
  validate(getVerificationRequestsSchema),
  async (req, res) => {
    try {
      const { status, page, limit } = req.query as unknown as {
        status: 'pending' | 'approved' | 'rejected'
        page: number
        limit: number
      }
      const offset = (page - 1) * limit

      // Try cache first
      const cacheKey = CacheKeys.adminVerification(status, page, limit)
      const cached = cache.get(cacheKey)
      if (cached) { res.locals.cached = true; return res.json(cached) }

      const where = eq(verificationRequests.status, status)

      const [data, countResult] = await Promise.all([
        db
          .select({
            id: verificationRequests.id,
            mentorId: verificationRequests.mentorId,
            mentorName: mentorProfiles.fullName,
            linkedinUrl: verificationRequests.linkedinUrl,
            documents: verificationRequests.documents,
            status: verificationRequests.status,
            adminNote: verificationRequests.adminNote,
            reviewedBy: verificationRequests.reviewedBy,
            createdAt: verificationRequests.createdAt,
            updatedAt: verificationRequests.updatedAt,
          })
          .from(verificationRequests)
          .innerJoin(
            mentorProfiles,
            eq(verificationRequests.mentorId, mentorProfiles.id),
          )
          .where(where)
          .limit(limit)
          .offset(offset)
          .all(),
        db
          .select({ count: sql<number>`count(*)` })
          .from(verificationRequests)
          .where(where)
          .get(),
      ])
      logger.debug(data)

      const total = countResult?.count ?? 0

      const payload = {
        data: data.map(request => ({
          ...request,
          documents: parseDocuments(request.documents),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }

      cache.set(cacheKey, payload, CacheTTL.ADMIN_VERIFICATION)

      return res.json(payload)
    } catch (err) {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch verification requests',
      })
    }
  },
)

/**
 * @swagger
 * /api/admin/verification-requests/{id}:
 *   patch:
 *     summary: Approve or reject verification request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification request updated
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 *       404:
 *         description: Request not found
 */
router.patch(
  '/verification-requests/:id',
  validate(reviewVerificationRequestSchema),
  async (req, res) => {
    try {
      const adminId = req.user?.id!
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const { status, notes } = req.body

      const verificationRequest = await db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.id, id))
        .get()

      if (!verificationRequest) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Verification request not found',
        })
      }

      if (verificationRequest.status !== 'pending') {
        return res.status(409).json({
          error: 'CONFLICT',
          message: `Request has already been ${verificationRequest.status}`,
        })
      }

      // Update the verification request and mentor's isVerified flag in parallel
      const [updated] = await Promise.all([
        db
          .update(verificationRequests)
          .set({
            status,
            adminNote: notes ?? null,
            reviewedBy: adminId,
            updatedAt: sql`(datetime('now'))`,
          })
          .where(eq(verificationRequests.id, id))
          .returning()
          .get(),
        db
          .update(mentorProfiles)
          .set({
            isVerified: status === 'approved',
            updatedAt: sql`(datetime('now'))`,
          })
          .where(eq(mentorProfiles.id, verificationRequest.mentorId)),
      ])

      // Bust mentor profile cache since isVerified changed
      cache.delete(CacheKeys.mentorProfile(verificationRequest.mentorId))
      cache.deletePattern('mentors:list')
      cache.deletePattern('admin:verification:')

      // Notify the mentor about the verification result
      try {
        const mentorUserId = await getMentorUserId(verificationRequest.mentorId)
        if (mentorUserId) {
          await createNotification({
            userId: mentorUserId,
            type: status === 'approved' ? 'verification_approved' : 'verification_rejected',
            title: status === 'approved' ? 'Verification Approved' : 'Verification Rejected',
            body: status === 'approved'
              ? 'Your mentor verification has been approved! You are now a verified mentor.'
              : `Your mentor verification has been rejected.${notes ? ` Reason: ${notes}` : ''}`,
            data: { verificationRequestId: id, status },
          })
        }
      } catch (notifError) {
        logger.error({ notifError }, 'Failed to send verification notification')
      }

      return res.json(updated)
    } catch (err) {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to review verification request',
      })
    }
  },
)

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [mentee, mentor, admin]
 *       - in: query
 *         name: search
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
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminUser'
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 */
router.get('/users', validate(getUsersSchema), async (req, res) => {
  try {
    const { role, search, page, limit } = req.query as unknown as {
      role?: 'mentee' | 'mentor' | 'admin'
      search?: string
      page: number
      limit: number
    }
    const offset = (page - 1) * limit

    // Try cache first
    const cacheKey = CacheKeys.adminUsers(page, limit, role, search)
    const cached = cache.get(cacheKey)
    if (cached) { res.locals.cached = true; return res.json(cached) }

    const conditions = []
    if (role) conditions.push(eq(user.role, role))
    if (search) conditions.push(like(user.name, `%${search}%`))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          onboardingComplete: user.onboardingComplete,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(where)
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .where(where)
        .get(),
    ])

    const total = countResult?.count ?? 0

    const payload = {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }

    cache.set(cacheKey, payload, CacheTTL.ADMIN_USERS)

    return res.json(payload)
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch users' })
  }
})

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get platform statistics (cached)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlatformStats'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 */
router.get('/stats', async (req, res) => {
  try {
    const cacheKey = CacheKeys.platformStats()
    const cached = cache.get(cacheKey)
    if (cached) { res.locals.cached = true; return res.json(cached) }

    const [
      totalUsers,
      totalMentors,
      totalMentees,
      sessionStats,
      pendingVerifications,
      ratingResult,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(mentorProfiles)
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(menteeProfiles)
        .get(),
      db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`sum(case when ${sessions.status} = 'completed' then 1 else 0 end)`,
        })
        .from(sessions)
        .get(),
      db
        .select({ count: sql<number>`count(*)` })
        .from(verificationRequests)
        .where(eq(verificationRequests.status, 'pending'))
        .get(),
      db
        .select({ avg: sql<number>`round(avg(${reviews.rating}), 2)` })
        .from(reviews)
        .get(),
    ])

    const stats = {
      totalUsers: totalUsers?.count ?? 0,
      totalMentors: totalMentors?.count ?? 0,
      totalMentees: totalMentees?.count ?? 0,
      totalSessions: sessionStats?.total ?? 0,
      completedSessions: sessionStats?.completed ?? 0,
      pendingVerifications: pendingVerifications?.count ?? 0,
      averageSessionRating: ratingResult?.avg ?? 0,
    }

    cache.set(cacheKey, stats, CacheTTL.PLATFORM_STATS)

    return res.json(stats)
  } catch (err) {
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch platform stats',
    })
  }
})

/**
 * @swagger
 * /api/admin/mentors/{mentorId}/suspend:
 *   patch:
 *     summary: Suspend or unsuspend a mentor
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mentorId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - suspended
 *             properties:
 *               suspended:
 *                 type: boolean
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mentor status updated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized (admin only)
 *       404:
 *         description: Mentor not found
 */
router.patch(
  '/mentors/:mentorId/suspend',
  validate(suspendMentorSchema),
  async (req, res) => {
    try {
      const mentorId = Array.isArray(req.params.mentorId)
        ? req.params.mentorId[0]
        : req.params.mentorId
      const { suspended } = req.body

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

      const updated = await db
        .update(mentorProfiles)
        .set({
          isActive: !suspended,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(mentorProfiles.id, mentorId))
        .returning()
        .get()

      // Bust mentor profile and list caches since isActive changed
      cache.delete(CacheKeys.mentorProfile(mentorId))
      cache.deletePattern('mentors:list')
      cache.deletePattern('admin:users:')

      return res.json(updated)
    } catch (err) {
      return res
        .status(500)
        .json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to update mentor status',
        })
    }
  },
)

export default router
