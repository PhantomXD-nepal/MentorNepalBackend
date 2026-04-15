import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '../auth'
import { db } from '../db'
import { user, mentorProfiles, menteeProfiles } from '../schema'
import { requireAuth } from '../middleware/requireAuth'
import { fromNodeHeaders } from 'better-auth/node'
import { logger } from '../logger'
import { requireRole } from '../middleware'
import { getUserDetailsFromEmail } from '../lib/auth'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Onboarding
 *     description: User onboarding and profile creation
 */

/**
 * @swagger
 * /api/onboarding/role:
 *   post:
 *     summary: Select user role
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [mentor, mentee]
 *     responses:
 *       200:
 *         description: Role selected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 role:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/onboarding/mentor:
 *   post:
 *     summary: Create or update mentor profile
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - headline
 *               - bio
 *               - expertise
 *               - yearsExp
 *             properties:
 *               fullName:
 *                 type: string
 *               headline:
 *                 type: string
 *               bio:
 *                 type: string
 *               expertise:
 *                 type: array
 *                 items:
 *                   type: string
 *               yearsExp:
 *                 type: integer
 *               hourlyRate:
 *                 type: integer
 *               company:
 *                 type: string
 *               title:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *               linkedinUrl:
 *                 type: string
 *                 format: uri
 *               location:
 *                 type: string
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Mentor profile created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/onboarding/mentee:
 *   post:
 *     summary: Create or update mentee profile
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - goals
 *               - careerStage
 *             properties:
 *               fullName:
 *                 type: string
 *               goals:
 *                 type: array
 *                 items:
 *                   type: string
 *               careerStage:
 *                 type: string
 *                 enum: [student, early, mid, senior]
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *               bio:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Mentee profile created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/onboarding/complete:
 *   post:
 *     summary: Complete onboarding
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
const roleSchema = z.object({
  role: z.enum(['mentor', 'mentee']),
})

const mentorProfileSchema = z.object({
  fullName: z.string().min(1),
  headline: z.string().min(1),
  bio: z.string().min(10),
  expertise: z.array(z.string()).min(1),
  yearsExp: z.number().int().min(0),
  hourlyRate: z.number().int().min(0).default(0),
  company: z.string().optional(),
  title: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  location: z.string().optional(),
  languages: z.array(z.string()).optional(),
})

const menteeProfileSchema = z.object({
  fullName: z.string().min(1),
  goals: z.array(z.string()).min(1),
  careerStage: z.enum(['student', 'early', 'mid', 'senior']),
  interests: z.array(z.string()).optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
})

router.post('/role', requireAuth, async (req, res) => {
  try {
    const parsed = roleSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid role. Must be mentor or mentee',
      })
    }

    const { role } = parsed.data

    await db.update(user).set({ role }).where(eq(user.id, req.user!.id))

    if (role === 'mentor') {
      const existing = await db
        .select()
        .from(mentorProfiles)
        .where(eq(mentorProfiles.userId, req.user!.id))
        .get()

      if (!existing) {
        await db.insert(mentorProfiles).values({
          userId: req.user!.id,
          fullName: '',
          headline: '',
          bio: '',
          expertiseTags: '[]',
          yearsExp: 0,
          sessionPrice: 0,
        })
      }
    } else {
      const existing = await db
        .select()
        .from(menteeProfiles)
        .where(eq(menteeProfiles.userId, req.user!.id))
        .get()

      if (!existing) {
        await db.insert(menteeProfiles).values({
          userId: req.user!.id,
          fullName: '',
          goals: '[]',
        })
      }
    }

    res.json({ message: 'Role selected successfully', role })
  } catch (error) {
    logger.error(`Error selecting role: ${error}`)
    res
      .status(500)
      .json({ error: 'INTERNAL_ERROR', message: 'Failed to select role' })
  }
})

router.post('/mentor', requireRole('mentor'), async (req, res) => {
  try {
    const parsed = mentorProfileSchema.safeParse(req.body)
    logger.debug(parsed)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message || 'Invalid input',
      })
    }

    const data = parsed.data

    logger.debug(
      {
        fullName: data.fullName,
        headline: data.headline,
        expertise: data.expertise,
        yearsExp: data.yearsExp,
        hourlyRate: data.hourlyRate,
      },
      'Creating mentor profile with data:',
    )

    await db
      .update(mentorProfiles)
      .set({
        fullName: data.fullName,
        headline: data.headline,
        bio: data.bio,
        expertiseTags: JSON.stringify(data.expertise),
        yearsExp: data.yearsExp,
        sessionPrice: data.hourlyRate,
        avatarUrl: data.avatarUrl,
        linkedinUrl: data.linkedinUrl,
        location: data.location,
        languages: data.languages ? JSON.stringify(data.languages) : undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(mentorProfiles.userId, req.user!.id))

    res.json({ message: 'Mentor profile created' })
  } catch (error) {
    console.error('Error creating mentor profile:', error)
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create mentor profile',
    })
  }
})

router.post('/mentee', requireAuth, async (req, res) => {
  try {
    logger.debug(
      {
        userId: req.user?.id,
        email: req.user?.email,
        role: req.user?.role,
        onboardingComplete: req.user?.onboardingComplete,
      },
      'Mentee profile - User details:',
    )

    if (req.user!.role !== 'mentee') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only mentees can access this endpoint',
      })
    }

    const parsed = menteeProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message || 'Invalid input',
      })
    }

    const data = parsed.data

    logger.debug(
      {
        fullName: data.fullName,
        careerStage: data.careerStage,
        goals: data.goals,
        interests: data.interests,
      },
      'Creating mentee profile with data:',
    )

    await db
      .update(menteeProfiles)
      .set({
        fullName: data.fullName,
        goals: JSON.stringify(data.goals),
        careerStage: data.careerStage,
        interests: data.interests ? JSON.stringify(data.interests) : undefined,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(menteeProfiles.userId, req.user!.id))

    res.json({ message: 'Mentee profile created' })
  } catch (error) {
    console.error('Error creating mentee profile:', error)
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create mentee profile',
    })
  }
})

router.post('/complete', requireAuth, async (req, res) => {
  try {
    await db
      .update(user)
      .set({ onboardingComplete: true })
      .where(eq(user.id, req.user!.id))

    res.json({ message: 'Onboarding completed' })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to complete onboarding',
    })
  }
})

export default router
