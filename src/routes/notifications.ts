import { Router } from 'express'

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
 *           enum: [session_reminder, session_confirmed, session_cancelled, session_completed, review_received, verification_approved, verification_rejected]
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         read:
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
router.get('/', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

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
router.patch('/read', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
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
router.patch('/:id/read', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
