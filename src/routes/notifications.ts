import { Router } from 'express'
import { requireAuth, validate } from '../middleware'
import {
  getNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../validation/notifications'
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications'
import { logger } from '../logger'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notifications
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [session_booked, session_confirmed, session_cancelled, session_completed, session_reminder, review_received, verification_approved, verification_rejected]
 *         title:
 *           type: string
 *         body:
 *           type: string
 *         isRead:
 *           type: boolean
 *         data:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
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
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 unreadCount:
 *                   type: integer
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/',
  requireAuth,
  validate(getNotificationsQuerySchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED' })
      }

      const { unreadOnly, page, limit } = req.query as unknown as {
        unreadOnly: boolean
        page: number
        limit: number
      }

      const result = (await getUserNotifications(
        userId,
        page,
        limit,
        unreadOnly,
      )) as Record<string, any> & { _cached?: boolean }
      if (result._cached) res.locals.cached = true
      const { _cached, ...payload } = result
      return res.json(payload)
    } catch (error) {
      logger.error({ error }, 'Error fetching notifications')
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch notifications',
      })
    }
  },
)

/**
 * @swagger
 * /api/notifications/read:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Not authenticated
 */
router.patch('/read', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED' })
    }

    await markAllNotificationsRead(userId)
    return res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    logger.error({ error }, 'Error marking all notifications as read')
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to mark notifications as read',
    })
  }
})

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Notification not found
 */
router.patch(
  '/:id/read',
  requireAuth,
  validate(notificationIdParamSchema),
  async (req, res) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED' })
      }

      const { id } = req.params as { id: string }
      const notification = await markNotificationRead(userId, id)

      if (!notification) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Notification not found',
        })
      }

      return res.json(notification)
    } catch (error) {
      logger.error({ error }, 'Error marking notification as read')
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to mark notification as read',
      })
    }
  },
)

export default router
