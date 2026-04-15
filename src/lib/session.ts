import { eq } from 'drizzle-orm'
import { db } from '../db'
import { menteeProfiles, mentorProfiles, sessions } from '../schema'

async function getProfilesForUser(userId: string) {
  const [mentor, mentee] = await Promise.all([
    db
      .select()
      .from(mentorProfiles)
      .where(eq(mentorProfiles.userId, userId))
      .get(),
    db
      .select()
      .from(menteeProfiles)
      .where(eq(menteeProfiles.userId, userId))
      .get(),
  ])
  return { mentor, mentee }
}

export function assertParticipant(
  session: typeof sessions.$inferSelect,
  mentorProfileId: string | undefined,
  menteeProfileId: string | undefined,
) {
  const isMentor = mentorProfileId && session.mentorId === mentorProfileId
  const isMentee = menteeProfileId && session.menteeId === menteeProfileId

  if (!isMentor && !isMentee) return null
  return { isMentor: !!isMentor, isMentee: !!isMentee }
}
