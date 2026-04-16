import { eq } from 'drizzle-orm'
import { db } from '../db'
import { cache } from '../cache'
import { user } from '../schema'
import { logger } from '../logger'

type UserDetails = {
  id: string
  email: string
  name: string
  role: 'mentee' | 'mentor' | 'admin' | null
}

export async function getUserDetailsFromEmail(
  email: string,
): Promise<UserDetails | null> {
  const cacheKey = `user:email:${email}`

// 1. Check cache
const cached = cache.get<UserDetails>(cacheKey)
if (cached) {
logger.debug({ userId: cached.id }, 'cache hit for user')
return cached
}

  // 2. Query DB
  const result = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (result.length === 0) {
    return null
  }

  const userData = result[0]

  // 3. Store in cache
  cache.set(cacheKey, userData)

  // 4. Return
  return userData
}
