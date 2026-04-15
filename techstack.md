# Tech Stack - MentorNepal Backend

## Core Technologies

### Runtime & Framework

| Technology | Purpose            | Version    |
| ---------- | ------------------ | ---------- |
| Node.js    | JavaScript runtime | Latest LTS |
| Express.js | Web framework      | ^4.x       |

### Database

| Technology | Purpose | Details |
| ---------- | ---------------------- | -------------------- |
| Drizzle ORM | Type-safe SQL ORM | TypeScript-first, lightweight |
| SQLite | Embedded database | File-based, no setup |
| drizzle-kit | Schema management | Migrations, generate, push |

### Authentication

| Technology | Purpose | Details |
| ----------- | ------------------------ | -------------------------------------------- |
| better-auth | Authentication framework | Email/password, sessions, email verification |
| drizzleAdapter | better-auth adapter | Integration with Drizzle ORM |

### Caching

| Technology             | Purpose                 | Details                                |
| ---------------------- | ----------------------- | -------------------------------------- |
| Custom In-Memory Cache | Read-heavy data caching | LRU-style with TTL, built from scratch |

### Video Meetings

| Technology | Purpose                | Details                               |
| ---------- | ---------------------- | ------------------------------------- |
| Daily.co   | Video conferencing API | Room creation, expiry, 2 participants |

### Email

| Technology | Purpose        | Details                                            |
| ---------- | -------------- | -------------------------------------------------- |
| Resend     | Email delivery | Transactional emails (verification, notifications) |

---

## Security & Utilities

### Security Middleware

| Package            | Purpose                       |
| ------------------ | ----------------------------- |
| cors               | Cross-origin resource sharing |
| helmet             | HTTP security headers         |
| express-rate-limit | Rate limiting                 |
### Request Validation

| Package   | Purpose                  | Details                                         |
| --------- | ------------------------ | ----------------------------------------------- |
| zod       | Request body validation | Schema validation for all API route payloads  |

### Development

| Package | Purpose |
| ---------- | ----------------------- |
| typescript | Type safety |
| tsx | Run TypeScript directly |
| dotenv | Environment variables |
| drizzle-kit | Schema management |

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts          # App bootstrap
│   ├── db.ts             # Drizzle ORM connection + schema
│   ├── schema.ts         # Drizzle table definitions
│   ├── auth.ts           # better-auth config with drizzleAdapter
│   ├── cache.ts          # In-memory cache
│   ├── middleware/
│   │   ├── requireAuth.ts
│   │   ├── requireRole.ts
│   │   └── requireOnboarding.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── onboarding.ts
│   │   ├── mentors.ts
│   │   ├── availability.ts
│   │   ├── sessions.ts
│   │   ├── reviews.ts
│   │   ├── notifications.ts
│   │   └── admin.ts
│   ├── services/
│   │   ├── daily.ts      # Daily.co API wrapper
│   │   ├── email.ts      # Resend wrapper
│   │   └── notifications.ts
│   └── jobs.ts           # Background job intervals
├── drizzle/              # Drizzle migrations
│   ├── schema.ts
│   └── migrations/
├── .env
└── package.json
```
backend/
├── src/
│   ├── index.ts              # App bootstrap
│   ├── db.ts                 # better-sqlite3 connection + migrations
│   ├── auth.ts               # better-auth config
│   ├── cache.ts              # In-memory cache
│   ├── middleware/
│   │   ├── requireAuth.ts
│   │   ├── requireRole.ts
│   │   └── requireOnboarding.ts
│   ├── routes/
│   │   ├── onboarding.ts
│   │   ├── mentors.ts
│   │   ├── availability.ts
│   │   ├── sessions.ts
│   │   ├── reviews.ts
│   │   ├── notifications.ts
│   │   └── admin.ts
│   ├── services/
│   │   ├── daily.ts          # Daily.co API wrapper
│   │   ├── email.ts          # Resend wrapper
│   │   └── notifications.ts  # Notification service
│   └── jobs.ts               # Background job intervals
├── migrations/
│   └── 001_init.sql
├── .env
└── package.json
```

---

## Database Schema

### Setup

Using **Drizzle ORM** with **better-auth drizzle adapter**:

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db"; // your drizzle instance

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
});
```

Generate better-auth schema: `npx auth@latest generate`
Apply migrations: `npx drizzle-kit migrate` or `npx auth@latest migrate`

### Tables Created

1. **users** (managed by better-auth via Drizzle adapter) - Extended with role, onboarding_complete
2. **mentor_profiles** - Mentor details, expertise, pricing, verification status
3. **mentee_profiles** - Mentee details, goals, career stage
4. **availability_slots** - Mentor weekly recurring availability
5. **sessions** - Booked mentorship sessions with Daily.co room info
6. **reviews** - Session reviews and ratings
7. **verification_requests** - Mentor verification documents
8. **notifications** - User notifications

---

## API Routes Overview

### Auth (better-auth)

- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`
- `POST /api/auth/verify-email`
- `POST /api/auth/forget-password`
- `POST /api/auth/reset-password`

### Onboarding

- `POST /api/onboarding/role`
- `POST /api/onboarding/mentor`
- `POST /api/onboarding/mentee`
- `POST /api/onboarding/complete`

### Mentors

- `GET /api/mentors` (paginated, filtered, cached)
- `GET /api/mentors/:mentorId` (cached)
- `GET /api/mentors/me`
- `PUT /api/mentors/me`

### Availability

- `GET /api/availability/:mentorId`
- `PUT /api/availability`
- `GET /api/availability/:mentorId/open`

### Sessions

- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:sessionId`
- `PATCH /api/sessions/:sessionId/confirm`
- `PATCH /api/sessions/:sessionId/cancel`
- `PATCH /api/sessions/:sessionId/complete`
- `GET /api/sessions/:sessionId/join`

### Reviews

- `POST /api/reviews`
- `GET /api/reviews/:mentorId`

### Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/read`
- `PATCH /api/notifications/:id/read`

### Admin

- `GET /api/admin/verification-requests`
- `PATCH /api/admin/verification-requests/:id`
- `GET /api/admin/users`
- `GET /api/admin/stats`
- `PATCH /api/admin/mentors/:mentorId/suspend`

---

## Environment Variables

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=./data/mentornepal.db
FRONTEND_URL=http://localhost:3000
BETTER_AUTH_SECRET=<32+ char secret>
BETTER_AUTH_URL=http://localhost:3001
DAILY_API_KEY=<daily.co key>
RESEND_API_KEY=<resend key>
FROM_EMAIL=noreply@mentornepal.com
```

---

## Rate Limits

| Route                      | Limit                 |
| -------------------------- | --------------------- |
| All `/api/*`               | 100 req / 15 min / IP |
| `POST /api/sessions`       | 10 req / hour / user  |
| `POST /api/reviews`        | 5 req / hour / user   |
| `POST /api/auth/sign-in/*` | 10 req / 15 min / IP  |

---

## Background Jobs

1. **Session Reminders** - Every 5 minutes
2. **Auto-Complete Sessions** - Every 10 minutes
3. **Cache Cleanup** - Every 30 minutes

---

## Cache Keys & TTLs

| Key                                          | TTL    | Invalidated On                          |
| -------------------------------------------- | ------ | --------------------------------------- |
| `mentors:list:{page}:{filters}`              | 5 min  | mentor profile update, new verification |
| `mentor:profile:{mentorId}`                  | 10 min | profile update                          |
| `mentor:reviews:{mentorId}:{page}`           | 10 min | new review                              |
| `mentor:availability:{mentorId}:{weekStart}` | 2 min  | slot update, new booking                |
| `stats:platform`                             | 30 min | any session completed                   |