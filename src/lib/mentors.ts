import { db } from '../db'
import { mentorProfiles, verificationRequests } from '../schema'
import { and, gte, lte, like, sql, eq } from 'drizzle-orm'
import { cache, CacheKeys, CacheTTL } from '../cache'
import { logger } from '../logger'

export interface MentorFilters {
  page: number
  limit: number
  expertise?: string
  minRate?: number
  maxRate?: number
  verified?: boolean
  search?: string
}

export async function fetchMentors(filters: MentorFilters) {
  const { page, limit, expertise, minRate, maxRate, verified, search } = filters
  const offset = (page - 1) * limit

  // Build a stable cache key from the filters
  const filterString = JSON.stringify({
    expertise,
    minRate,
    maxRate,
    verified,
    search,
  })
  const cacheKey = CacheKeys.mentorsList(page, filterString)
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const conditions = [sql`${mentorProfiles.isActive} = 1`]

  if (verified !== undefined) {
    conditions.push(sql`${mentorProfiles.isVerified} = ${verified ? 1 : 0}`)
  }

  if (minRate !== undefined) {
    conditions.push(gte(mentorProfiles.sessionPrice, minRate))
  }

  if (maxRate !== undefined) {
    conditions.push(lte(mentorProfiles.sessionPrice, maxRate))
  }

  if (search) {
    conditions.push(
      sql`(${mentorProfiles.fullName} LIKE ${'%' + search + '%'}
        OR ${mentorProfiles.headline} LIKE ${'%' + search + '%'})`,
    )
  }

  if (expertise) {
    // expertiseTags is a JSON string — check each comma-separated value
    const tags = expertise
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    for (const tag of tags) {
      conditions.push(
        sql`${mentorProfiles.expertiseTags} LIKE ${'%' + tag + '%'}`,
      )
    }
  }

  const where = and(...conditions)

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: mentorProfiles.id,
        fullName: mentorProfiles.fullName,
        headline: mentorProfiles.headline,
        avatarUrl: mentorProfiles.avatarUrl,
        expertiseTags: mentorProfiles.expertiseTags,
        sessionPrice: mentorProfiles.sessionPrice,
        isVerified: mentorProfiles.isVerified,
        avgRating: mentorProfiles.avgRating,
        reviewCount: mentorProfiles.reviewCount,
        yearsExp: mentorProfiles.yearsExp,
        location: mentorProfiles.location,
      })
      .from(mentorProfiles)
      .where(where)
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mentorProfiles)
      .where(where)
      .get(),
  ])

  const total = countResult?.count ?? 0
  console.log(filters)

  console.log(data)

  const payload = {
    data: data.map(m => ({
      ...m,
      expertiseTags: JSON.parse(m.expertiseTags ?? '[]'),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }

  cache.set(cacheKey, payload, CacheTTL.MENTORS_LIST)

  return payload
}

export async function getMentorDetailsById(mentorId: string) {
  const key = `mentor:details:${mentorId}`

  const cached = await cache.get(key)
  if (cached) return cached

  const data = await db
    .select({
      id: mentorProfiles.id,
      userId: mentorProfiles.userId,
      fullName: mentorProfiles.fullName,
      headline: mentorProfiles.headline,
      bio: mentorProfiles.bio,
      avatarUrl: mentorProfiles.avatarUrl,
      linkedinUrl: mentorProfiles.linkedinUrl,
      location: mentorProfiles.location,
      languages: mentorProfiles.languages,
      documents: mentorProfiles.documents,
      expertise: mentorProfiles.expertiseTags,
      yearsExp: mentorProfiles.yearsExp,
      sessionPrice: mentorProfiles.sessionPrice,
      isVerified: mentorProfiles.isVerified,
      isActive: mentorProfiles.isActive,
      totalSessions: mentorProfiles.totalSessions,
      avgRating: mentorProfiles.avgRating,
      reviewCount: mentorProfiles.reviewCount,
      createdAt: mentorProfiles.createdAt,
      updatedAt: mentorProfiles.updatedAt,
    })
    .from(mentorProfiles)
    .where(eq(mentorProfiles.id, mentorId))
    .limit(1)

  const mentor = data[0]

  if (!mentor) return null

  const result = {
    ...mentor,
    expertise: mentor.expertise ? JSON.parse(mentor.expertise) : [],
    languages: mentor.languages ? JSON.parse(mentor.languages) : [],
    documents: parseJsonArray(mentor.documents),
    verified: Boolean(mentor.isVerified),
  }

  await cache.set(key, result, 60 * 10)

  return result
}

export async function getMentorDetailsByUserId(userId: string) {
  const key = `mentor:details:user:${userId}`

  const cached = await cache.get(key)
  if (cached) return cached

  const data = await db
    .select({
      id: mentorProfiles.id,
      userId: mentorProfiles.userId,
      fullName: mentorProfiles.fullName,
      headline: mentorProfiles.headline,
      bio: mentorProfiles.bio,
      avatarUrl: mentorProfiles.avatarUrl,
      linkedinUrl: mentorProfiles.linkedinUrl,
      location: mentorProfiles.location,
      languages: mentorProfiles.languages,
      documents: mentorProfiles.documents,
      expertise: mentorProfiles.expertiseTags,
      yearsExp: mentorProfiles.yearsExp,
      sessionPrice: mentorProfiles.sessionPrice,
      isVerified: mentorProfiles.isVerified,
      isActive: mentorProfiles.isActive,
      totalSessions: mentorProfiles.totalSessions,
      avgRating: mentorProfiles.avgRating,
      reviewCount: mentorProfiles.reviewCount,
      createdAt: mentorProfiles.createdAt,
      updatedAt: mentorProfiles.updatedAt,
    })
    .from(mentorProfiles)
    .where(eq(mentorProfiles.userId, userId))
    .limit(1)

  const mentor = data[0]
  if (!mentor) return null

  const result = {
    ...mentor,
    expertise: mentor.expertise ? JSON.parse(mentor.expertise) : [],
    languages: mentor.languages ? JSON.parse(mentor.languages) : [],
    documents: parseJsonArray(mentor.documents),
    verified: Boolean(mentor.isVerified),
  }

  await cache.set(key, result, 600)

  return result
}

export async function getMentorDocumentsById(mentorId: string) {
  const mentor = await db
    .select({
      id: mentorProfiles.id,
      userId: mentorProfiles.userId,
      documents: mentorProfiles.documents,
    })
    .from(mentorProfiles)
    .where(eq(mentorProfiles.id, mentorId))
    .get()

  if (!mentor) return null

  return {
    mentorId: mentor.id,
    userId: mentor.userId,
    documents: parseJsonArray(mentor.documents),
  }
}

export async function addMentorDocumentsByUserId(
  userId: string,
  documents: string[],
) {
  const mentor = await db
    .select({
      id: mentorProfiles.id,
      userId: mentorProfiles.userId,
      linkedinUrl: mentorProfiles.linkedinUrl,
      documents: mentorProfiles.documents,
    })
    .from(mentorProfiles)
    .where(eq(mentorProfiles.userId, userId))
    .get()

  if (!mentor) return null

  const nextDocuments = [
    ...new Set([...parseJsonArray(mentor.documents), ...documents]),
  ]

  await db
    .update(mentorProfiles)
    .set({
      documents: JSON.stringify(nextDocuments),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(mentorProfiles.id, mentor.id))

  await syncVerificationRequestDocuments(
    mentor.id,
    mentor.linkedinUrl,
    nextDocuments,
  )

  cache.delete(`mentor:details:${mentor.id}`)
  cache.delete(`mentor:details:user:${userId}`)

  return nextDocuments
}

export async function replaceMentorDocumentsByUserId(
  userId: string,
  documents: string[],
) {
  const mentor = await db
    .select({
      id: mentorProfiles.id,
      userId: mentorProfiles.userId,
      linkedinUrl: mentorProfiles.linkedinUrl,
    })
    .from(mentorProfiles)
    .where(eq(mentorProfiles.userId, userId))
    .get()

  if (!mentor) return null

  await db
    .update(mentorProfiles)
    .set({
      documents: JSON.stringify(documents),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(mentorProfiles.id, mentor.id))

  await syncVerificationRequestDocuments(
    mentor.id,
    mentor.linkedinUrl,
    documents,
  )

  cache.delete(`mentor:details:${mentor.id}`)
  cache.delete(`mentor:details:user:${userId}`)

  return documents
}

export async function removeMentorDocumentByUserId(
  userId: string,
  document: string,
) {
  const mentor = await db
    .select({
      id: mentorProfiles.id,
      userId: mentorProfiles.userId,
      linkedinUrl: mentorProfiles.linkedinUrl,
      documents: mentorProfiles.documents,
    })
    .from(mentorProfiles)
    .where(eq(mentorProfiles.userId, userId))
    .get()

  if (!mentor) return null

  const nextDocuments = parseJsonArray(mentor.documents).filter(
    item => item !== document,
  )

  await db
    .update(mentorProfiles)
    .set({
      documents: JSON.stringify(nextDocuments),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(mentorProfiles.id, mentor.id))

  await syncVerificationRequestDocuments(
    mentor.id,
    mentor.linkedinUrl,
    nextDocuments,
  )

  cache.delete(`mentor:details:${mentor.id}`)
  cache.delete(`mentor:details:user:${userId}`)

  return nextDocuments
}

/**
 * Safely parses a JSON string into a string array.
 * Returns an empty array for null/undefined input or malformed JSON.
 * Validates that the parsed value is actually an array of strings.
 */
function parseJsonArray(value: string | null | undefined): string[] {
  if (value === null || value === undefined) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    logger.warn({ value }, 'Failed to parse JSON array value')
    return []
  }
}

/**
 * Synchronizes the documents on the latest pending verification request
 * for a mentor. If a pending request exists it is updated; otherwise a new
 * one is created so that admin can review the updated documents.
 */
async function syncVerificationRequestDocuments(
  mentorId: string,
  linkedinUrl: string | null,
  documents: string[],
): Promise<void> {
  if (!linkedinUrl) return

  const existing = await db
    .select({ id: verificationRequests.id })
    .from(verificationRequests)
    .where(
      and(
        eq(verificationRequests.mentorId, mentorId),
        eq(verificationRequests.status, 'pending'),
      ),
    )
    .limit(1)

  const pending = existing[0]

  if (pending) {
    await db
      .update(verificationRequests)
      .set({
        linkedinUrl,
        documents: JSON.stringify(documents),
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(verificationRequests.id, pending.id))
  } else {
    await db.insert(verificationRequests).values({
      mentorId,
      linkedinUrl,
      documents: JSON.stringify(documents),
      status: 'pending',
    })
  }
}
