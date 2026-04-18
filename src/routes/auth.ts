import { Router } from 'express'
import { auth } from '../auth'
import { fromNodeHeaders } from 'better-auth/node'
import { logger } from '../logger'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /api/auth/sign-up/email:
 *   post:
 *     summary: Sign up with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Email already exists
 */
router.post('/sign-up/email', (req, res) => {
  // Handled by better-auth
  res.status(501).json({ message: 'Handled by better-auth' })
})

/**
 * @swagger
 * /api/auth/sign-in/email:
 *   post:
 *     summary: Sign in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signed in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid credentials
 */
router.post('/sign-in/email', (req, res) => {
  res.status(501).json({ message: 'Handled by better-auth' })
})

/**
 * @swagger
 * /api/auth/sign-out:
 *   post:
 *     summary: Sign out current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Signed out successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/sign-out', (req, res) => {
  res.status(501).json({ message: 'Handled by better-auth' })
})

/**
 * @swagger
 * /api/auth/session:
 *   get:
 *     summary: Get current session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 session:
 *                   type: object
 *       401:
 *         description: No active session
 */
router.get('/session', async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })
  logger.debug(session)
  return res.json(session)
})

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-email', (req, res) => {
  res.status(501).json({ message: 'Handled by better-auth' })
})

/**
 * @swagger
 * /api/auth/forget-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent
 *       404:
 *         description: Email not found
 */
router.post('/forget-password', (req, res) => {
  res.status(501).json({ message: 'Handled by better-auth' })
})

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', (req, res) => {
  res.status(501).json({ message: 'Handled by better-auth' })
})

export default router
