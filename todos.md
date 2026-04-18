# Todo List - MentorNepal Backend

## Phase 1: Foundation (High Priority)

- [x] Set up project structure and package.json with dependencies
- [x] Create database setup with Drizzle ORM + better-sqlite3 + migrations
- [x] Configure better-auth with drizzleAdapter and custom fields
- [x] Implement custom in-memory cache with TTL
- [x] Create middleware: requireAuth, requireRole, requireOnboarding

## Phase 2: Core Features (High Priority)

- [x] Implement onboarding routes (role, mentor, mentee, complete)
- [x] Implement mentor profile routes with caching
- [x] Implement availability routes
- [x] Implement session booking with Daily.co integration
- [x] Implement review routes

## Phase 3: Supporting Features (Medium Priority)

- [x] Implement notification routes
- [x] Implement admin routes
- [ ] Set up background jobs (reminders, auto-complete, cache cleanup)
- [x] Configure rate limiting

## Phase 4: Configuration (High Priority)

- [x] Set up environment variables and configuration

---

## Detailed Tasks

### 1. Set up project structure and package.json with dependencies [x]
- Initialize Node.js project
- Install: express, better-auth, cors, helmet, express-rate-limit, zod, pino
- Create directory structure as per README section 9
- Add zod validation schemas for all route payloads

### 2. Create database setup with better-sqlite3 and migrations
- Set up db.ts with better-sqlite3 connection
- Create migrations/001_init.sql with all tables from README
- Handle migrations on startup

### 3. Configure better-auth with custom fields
- Set up auth.ts with better-auth configuration
- Configure emailAndPassword, emailVerification, session settings
- Add custom fields: role (mentee|mentor|admin), onboardingComplete

### 4. Implement custom in-memory cache with TTL [x]
- Create cache.ts with LRU-style cache
- Implement set, get, invalidate methods
- Add cleanup method for expired entries

### 5. Create middleware
- requireAuth.ts - verify session
- requireRole.ts - role-gated access
- requireOnboarding.ts - check onboarding status

### 6. Implement onboarding routes [x]
- POST /api/onboarding/role - set role and create profile
- POST /api/onboarding/mentor - save mentor profile fields
- POST /api/onboarding/mentee - save mentee profile fields
- POST /api/onboarding/complete - mark onboarding complete

### 7. Implement mentor profile routes [x]
- GET /api/mentors - paginated list with filters
- GET /api/mentors/:mentorId - public profile + reviews
- GET /api/mentors/me - own profile (auth required)
- PUT /api/mentors/me - update own profile
- Implement caching for list and detail endpoints

### 8. Implement availability routes [x]
- GET /api/availability/:mentorId - weekly slots + booked times
- PUT /api/availability - mentor sets weekly recurring slots
- GET /api/availability/:mentorId/open - open slots for given week

### 9. Implement session booking with Daily.co [x]
- POST /api/sessions - book session (create Daily room)
- GET /api/sessions - list own sessions
- GET /api/sessions/:sessionId - session detail
- PATCH /api/sessions/:sessionId/confirm - mentor confirms
- PATCH /api/sessions/:sessionId/cancel - cancel session
- PATCH /api/sessions/:sessionId/complete - mark completed
- GET /api/sessions/:sessionId/join - get meeting URL

### 10. Implement review routes [x]
- POST /api/reviews - submit review (after session completed)
- GET /api/reviews/:mentorId - public reviews for mentor

### 11. Implement notification routes [x]
- GET /api/notifications - list notifications
- PATCH /api/notifications/read - mark all as read
- PATCH /api/notifications/:id/read - mark one as read

### 12. Implement admin routes [x]
- GET /api/admin/verification-requests - list pending requests
- PATCH /api/admin/verification-requests/:id - approve/reject
- GET /api/admin/users - list all users
- GET /api/admin/stats - platform stats
- PATCH /api/admin/mentors/:mentorId/suspend - suspend mentor

### 13. Set up background jobs
- Session reminder notifications (every 5 min)
- Auto-complete sessions (every 10 min)
- Cache cleanup (every 30 min)

### 14. Configure rate limiting [x]
- Global: 100 req / 15 min / IP
- POST /api/sessions: 10 req / hour / user
- POST /api/reviews: 5 req / hour / user
- POST /api/auth/sign-in/*: 10 req / 15 min / IP

### 15. Set up environment variables [x]
- NODE_ENV, PORT, DATABASE_URL, FRONTEND_URL
- BETTER_AUTH_SECRET, BETTER_AUTH_URL
- DAILY_API_KEY, RESEND_API_KEY, FROM_EMAIL
