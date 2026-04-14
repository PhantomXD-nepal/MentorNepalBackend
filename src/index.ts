import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { logger } from './logger'
import { apiReference } from '@scalar/express-api-reference'
import { swaggerSpec } from './docs'

// Route imports
import authRoutes from './routes/auth'
import onboardingRoutes from './routes/onboarding'
import mentorsRoutes from './routes/mentors'
import availabilityRoutes from './routes/availability'
import sessionsRoutes from './routes/sessions'
import reviewsRoutes from './routes/reviews'
import notificationsRoutes from './routes/notifications'
import adminRoutes from './routes/admin'

dotenv.config()

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  }),
)

app.use(express.json())
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:'],
      },
    },
  }),
)

app.use(
  '/docs',
  apiReference({
    content: swaggerSpec,
  }),
)

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }),
)

// Health check
app.get('/', (req, res) => {
  res.send('MentorNepal API running')
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/mentors', mentorsRoutes)
app.use('/api/availability', availabilityRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/admin', adminRoutes)

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
