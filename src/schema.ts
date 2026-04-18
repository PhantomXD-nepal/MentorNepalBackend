import { relations, sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  index,
  real,
  unique,
} from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .default(false)
    .notNull(),
  image: text('image'),
  role: text('role').$type<'mentee' | 'mentor' | 'admin'>().default('mentee'),
  onboardingComplete: integer('onboarding_complete', {
    mode: 'boolean',
  }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  table => [index('session_userId_idx').on(table.userId)],
)

export const account = sqliteTable(
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
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  table => [index('account_userId_idx').on(table.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  table => [index('verification_identifier_idx').on(table.identifier)],
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))
export const mentorProfiles = sqliteTable('mentor_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`(lower(hex(randomblob(16))))`),
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
  languages: text('languages').default('["Nepali","English"]'), // JSON string
  documents: text('documents').default('[]'), // JSON string
  expertiseTags: text('expertise_tags').notNull(), // JSON string
  yearsExp: integer('years_exp').notNull(),
  sessionPrice: integer('session_price').default(0),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  totalSessions: integer('total_sessions').default(0),
  avgRating: real('avg_rating').default(0.0),
  reviewCount: integer('review_count').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// --- Mentee Profiles ---
export const menteeProfiles = sqliteTable('mentee_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  goals: text('goals'), // JSON string
  careerStage: text('career_stage').$type<
    'student' | 'early' | 'mid' | 'senior'
  >(),
  interests: text('interests'), // JSON string
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// --- Availability Slots ---
export const availabilitySlots = sqliteTable(
  'availability_slots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => sql`(lower(hex(randomblob(16))))`),
    mentorId: text('mentor_id')
      .notNull()
      .references(() => mentorProfiles.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0-6
    startTime: text('start_time').notNull(), // "09:00"
    endTime: text('end_time').notNull(), // "10:00"
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
  },
  t => ({
    unq: unique().on(t.mentorId, t.dayOfWeek, t.startTime),
  }),
)

// --- Sessions ---
export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`(lower(hex(randomblob(16))))`),
  mentorId: text('mentor_id')
    .notNull()
    .references(() => mentorProfiles.id),
  menteeId: text('mentee_id')
    .notNull()
    .references(() => menteeProfiles.id),
  scheduledAt: text('scheduled_at').notNull(), // ISO8601
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
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// --- Reviews ---
export const reviews = sqliteTable('reviews', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`(lower(hex(randomblob(16))))`),
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
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// --- Verification Requests ---
export const verificationRequests = sqliteTable('verification_requests', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`(lower(hex(randomblob(16))))`),
  mentorId: text('mentor_id')
    .notNull()
    .references(() => mentorProfiles.id),
  linkedinUrl: text('linkedin_url').notNull(),
  documents: text('documents'), // JSON array of URLs
  status: text('status')
    .$type<'pending' | 'approved' | 'rejected'>()
    .default('pending'),
  adminNote: text('admin_note'),
  reviewedBy: text('reviewed_by').references(() => user.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// --- Notifications ---
export const notifications = sqliteTable('notifications', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`(lower(hex(randomblob(16))))`),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: text('data'), // JSON string
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
