import { db } from '../db'
import { mentorProfiles } from '../schema'
import { and, gte, lte, like, sql, eq } from 'drizzle-orm'
import { cache } from '../cache'
import { logger } from '../logger'

type FetchMentorsParams = {
  page?: number
  limit?: number
  expertise?: string
  minRate?: number
  maxRate?: number
  search?: string
}

export async function fetchMentors(params: FetchMentorsParams = {}) {
  const { page = 1, limit = 20, expertise, minRate, maxRate, search } = params

  const key = `mentors:${JSON.stringify(params)}`
  const cached = await cache.get(key)
  if (cached) return cached

  const offset = (page - 1) * limit
  const filters = []

  if (minRate !== undefined) {
    filters.push(gte(mentorProfiles.sessionPrice, minRate))
  }

  if (maxRate !== undefined) {
    filters.push(lte(mentorProfiles.sessionPrice, maxRate))
  }

  if (search) {
    filters.push(like(mentorProfiles.fullName, `%${search}%`))
  }

  if (expertise) {
    const tags = expertise.split(',')
    for (const tag of tags) {
      filters.push(like(mentorProfiles.expertiseTags, `%${tag}%`))
    }
  }

  const data = await db
    .select({
      id: mentorProfiles.id,
      name: mentorProfiles.fullName,
      avatar: mentorProfiles.avatarUrl,
      expertise: mentorProfiles.expertiseTags,
      hourlyRate: mentorProfiles.sessionPrice,
      verified: sql<boolean>`false`,
      rating: sql<number>`0`,
      reviewCount: sql<number>`0`,
    })
    .from(mentorProfiles)
    .where(filters.length ? and(...filters) : undefined)
    .limit(limit)
    .offset(offset)

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(mentorProfiles)

  const total = totalResult[0]?.count ?? 0

  const result = {
    data: data.map(m => ({
      ...m,
      expertise: m.expertise ? JSON.parse(m.expertise) : [],
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }

  await cache.set(key, result, 60)

  return result
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
    verified: Boolean(mentor.isVerified),
  }

  await cache.set(key, result, 60 * 10)

  return result
}
