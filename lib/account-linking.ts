import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'

export async function syncLinkedProfile(sourceUserId: string | null | undefined) {
  if (!sourceUserId) return null

  const previousProfile = await database.profiles
    .getByIdOrNull(sourceUserId)
    .catch((error) => {
      console.warn('[AccountLinking] Could not load existing profile:', error)
      return null
    })

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser?.id) {
    return sourceUserId
  }

  if (currentUser.id !== sourceUserId) {
    console.error(
      '[AccountLinking] Linked account resolved to a new user ID; aborting to protect guest data.',
      {
        sourceUserId,
        currentUserId: currentUser.id,
      },
    )

    throw new Error(
      'We could not safely connect that account without risking your guest data. Please try a different sign-up method.',
    )
  }

  const currentProfile = await database.profiles
    .getByIdOrNull(currentUser.id)
    .catch((error) => {
      console.warn('[AccountLinking] Could not load linked profile:', error)
      return null
    })

  let userTag = currentProfile?.user_tag ?? null
  if (!userTag) {
    const displayNameBase = previousProfile?.display_name?.trim() || 'Athlete'
    userTag = await database.profiles.generateUniqueUserTag(displayNameBase)
  }

  await database.profiles.upsert({
    id: currentUser.id,
    user_tag: userTag,
    display_name:
      previousProfile?.display_name ?? currentProfile?.display_name ?? 'Guest',
    gender: previousProfile?.gender ?? currentProfile?.gender ?? null,
    height_cm: previousProfile?.height_cm ?? currentProfile?.height_cm ?? null,
    age: previousProfile?.age ?? currentProfile?.age ?? null,
    goals: previousProfile?.goals ?? currentProfile?.goals ?? null,
    commitment: previousProfile?.commitment ?? currentProfile?.commitment ?? null,
    commitment_frequency:
      previousProfile?.commitment_frequency ??
      currentProfile?.commitment_frequency ??
      null,
    experience_level:
      previousProfile?.experience_level ??
      currentProfile?.experience_level ??
      null,
    bio: previousProfile?.bio ?? currentProfile?.bio ?? null,
    coach: previousProfile?.coach ?? currentProfile?.coach ?? null,
    is_guest: false,
  })

  return currentUser.id
}
