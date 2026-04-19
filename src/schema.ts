import { relations, sql } from 'drizzle-orm'
import {
  pgTable,
  text,
  integer,
  boolean,
  real,
  index,
  unique,
  timestamp,
} from 'drizzle-orm/pg-core'

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    role: text('role').$type<'mentee' | 'mentor' | 'admin'>().default('mentee'),
    onboardingComplete: boolean('onboarding_complete').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    index('user_email_idx').on(table.email),
    index('user_role_idx').on(table.role),
  ],
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  table => [
    index('session_userId_idx').on(table.userId),
    index('session_token_idx').on(table.token),
    index('session_expiresAt_idx').on(table.expiresAt),
  ],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    index('account_userId_idx').on(table.userId),
    index('account_providerId_accountId_idx').on(
      table.providerId,
      table.accountId,
    ), // for OAuth lookups
  ],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    index('verification_identifier_idx').on(table.identifier),
    index('verification_expiresAt_idx').on(table.expiresAt),
  ],
)

export const mentorProfiles = pgTable(
  'mentor_profiles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    headline: text('headline').notNull(),
    bio: text('bio').notNull(),
    avatarUrl: text('avatar_url'),
    linkedinUrl: text('linkedin_url'),
    location: text('location').default('Kathmandu, Nepal'),
    languages: text('languages').default('["Nepali","English"]'),
    documents: text('documents').default('[]'),
    expertiseTags: text('expertise_tags').notNull(),
    yearsExp: integer('years_exp').notNull(),
    sessionPrice: integer('session_price').default(0),
    isVerified: boolean('is_verified').default(false),
    isActive: boolean('is_active').default(true),
    totalSessions: integer('total_sessions').default(0),
    avgRating: real('avg_rating').default(0.0),
    reviewCount: integer('review_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('mentor_userId_idx').on(table.userId),
    index('mentor_isActive_isVerified_idx').on(
      table.isActive,
      table.isVerified,
    ), // listing active verified mentors
    index('mentor_avgRating_idx').on(table.avgRating), // sorting by rating
    index('mentor_sessionPrice_idx').on(table.sessionPrice), // filtering by price
    index('mentor_location_idx').on(table.location), // filtering by location
    index('mentor_yearsExp_idx').on(table.yearsExp), // filtering by experience
  ],
)

export const menteeProfiles = pgTable(
  'mentee_profiles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    goals: text('goals'),
    careerStage: text('career_stage').$type<
      'student' | 'early' | 'mid' | 'senior'
    >(),
    interests: text('interests'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('mentee_userId_idx').on(table.userId),
    index('mentee_careerStage_idx').on(table.careerStage),
  ],
)

export const availabilitySlots = pgTable(
  'availability_slots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mentorId: text('mentor_id')
      .notNull()
      .references(() => mentorProfiles.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    isActive: boolean('is_active').default(true),
  },
  t => [
    unique().on(t.mentorId, t.dayOfWeek, t.startTime),
    index('availability_mentorId_idx').on(t.mentorId),
    index('availability_mentorId_day_idx').on(t.mentorId, t.dayOfWeek), // "show me mentor's monday slots"
    index('availability_isActive_idx').on(t.isActive),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mentorId: text('mentor_id')
      .notNull()
      .references(() => mentorProfiles.id),
    menteeId: text('mentee_id')
      .notNull()
      .references(() => menteeProfiles.id),
    scheduledAt: text('scheduled_at').notNull(),
    durationMins: integer('duration_mins').default(30),
    status: text('status')
      .$type<'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'>()
      .default('pending'),
    meetingUrl: text('meeting_url'),
    dailyRoomName: text('daily_room_name'),
    topic: text('topic'),
    menteeNote: text('mentee_note'),
    mentorNote: text('mentor_note'),
    cancelledBy: text('cancelled_by').references(() => user.id),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('sessions_mentorId_idx').on(table.mentorId),
    index('sessions_menteeId_idx').on(table.menteeId),
    index('sessions_status_idx').on(table.status),
    index('sessions_scheduledAt_idx').on(table.scheduledAt),
    index('sessions_mentorId_status_idx').on(table.mentorId, table.status), // mentor's pending sessions
    index('sessions_menteeId_status_idx').on(table.menteeId, table.status), // mentee's completed sessions
    index('sessions_mentorId_scheduledAt_idx').on(
      table.mentorId,
      table.scheduledAt,
    ), // mentor's upcoming sessions
  ],
)

export const reviews = pgTable(
  'reviews',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .unique()
      .references(() => sessions.id),
    mentorId: text('mentor_id')
      .notNull()
      .references(() => mentorProfiles.id),
    menteeId: text('mentee_id')
      .notNull()
      .references(() => menteeProfiles.id),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    isPublic: boolean('is_public').default(true),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('reviews_mentorId_idx').on(table.mentorId),
    index('reviews_menteeId_idx').on(table.menteeId),
    index('reviews_mentorId_isPublic_idx').on(table.mentorId, table.isPublic), // public reviews for a mentor
    index('reviews_rating_idx').on(table.rating),
  ],
)

export const verificationRequests = pgTable(
  'verification_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mentorId: text('mentor_id')
      .notNull()
      .references(() => mentorProfiles.id),
    linkedinUrl: text('linkedin_url').notNull(),
    documents: text('documents'),
    status: text('status')
      .$type<'pending' | 'approved' | 'rejected'>()
      .default('pending'),
    adminNote: text('admin_note'),
    reviewedBy: text('reviewed_by').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    index('verification_req_mentorId_idx').on(table.mentorId),
    index('verification_req_status_idx').on(table.status), // admin queue of pending requests
    index('verification_req_mentorId_status_idx').on(
      table.mentorId,
      table.status,
    ),
  ],
)

export const notifications = pgTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: text('data'),
    isRead: boolean('is_read').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    index('notifications_userId_idx').on(table.userId),
    index('notifications_userId_isRead_idx').on(table.userId, table.isRead), // unread count query
    index('notifications_userId_createdAt_idx').on(
      table.userId,
      table.createdAt,
    ), // paginated feed
  ],
)

// Relations (unchanged)
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))
