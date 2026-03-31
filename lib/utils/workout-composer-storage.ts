import { MMKV } from 'react-native-mmkv'

import {
  clearDraft as clearLegacyWorkoutDraft,
  loadDraft as loadLegacyWorkoutDraft,
} from '@/lib/utils/workout-draft'
import {
  createEmptyWorkoutComposerSession,
  createWorkoutComposerSessionFromLegacyDraft,
  hasActiveWorkoutComposerSession,
  normalizePersistedWorkoutComposerSession,
  type WorkoutComposerSession,
} from '@/lib/utils/workout-composer-session'

const WORKOUT_COMPOSER_STORAGE_KEY = '@workout_composer_session_v1'
const WORKOUT_COMPOSER_STORAGE_VERSION = 1
const storage = new MMKV({ id: 'workout-composer' })

interface PersistedWorkoutComposerSnapshot {
  version: number
  session: WorkoutComposerSession
}

function readSnapshot(): PersistedWorkoutComposerSnapshot | null {
  const raw = storage.getString(WORKOUT_COMPOSER_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedWorkoutComposerSnapshot>
    if (parsed.version !== WORKOUT_COMPOSER_STORAGE_VERSION) {
      return null
    }

    if (!parsed.session) {
      return null
    }

    return {
      version: WORKOUT_COMPOSER_STORAGE_VERSION,
      session: parsed.session,
    }
  } catch {
    return null
  }
}

export async function loadStoredWorkoutComposerSession(): Promise<WorkoutComposerSession | null> {
  const snapshot = readSnapshot()
  if (!snapshot) {
    return null
  }

  const session = normalizePersistedWorkoutComposerSession(snapshot.session)
  if (!hasActiveWorkoutComposerSession(session)) {
    return null
  }

  return {
    ...session,
    meta: {
      ...session.meta,
      hydratedFrom: 'composer_snapshot',
    },
  }
}

export async function saveStoredWorkoutComposerSession(
  session: WorkoutComposerSession,
): Promise<void> {
  if (!hasActiveWorkoutComposerSession(session)) {
    storage.delete(WORKOUT_COMPOSER_STORAGE_KEY)
    return
  }

  storage.set(
    WORKOUT_COMPOSER_STORAGE_KEY,
    JSON.stringify({
      version: WORKOUT_COMPOSER_STORAGE_VERSION,
      session,
    } satisfies PersistedWorkoutComposerSnapshot),
  )
}

export async function clearStoredWorkoutComposerSession(): Promise<void> {
  storage.delete(WORKOUT_COMPOSER_STORAGE_KEY)
}

export async function loadWorkoutComposerSessionWithMigration(): Promise<WorkoutComposerSession> {
  const storedSession = await loadStoredWorkoutComposerSession()
  if (storedSession) {
    return storedSession
  }

  const legacyDraft = await loadLegacyWorkoutDraft()
  if (!legacyDraft) {
    return createEmptyWorkoutComposerSession()
  }

  const migratedSession = createWorkoutComposerSessionFromLegacyDraft(legacyDraft)
  if (!hasActiveWorkoutComposerSession(migratedSession)) {
    return createEmptyWorkoutComposerSession()
  }

  await saveStoredWorkoutComposerSession(migratedSession)
  await clearLegacyWorkoutDraft('migrated-to-workout-composer')

  return migratedSession
}
