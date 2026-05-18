import { MMKV } from 'react-native-mmkv'

const storage = new MMKV({ id: 'coach-chat' })

const COACH_CHAT_COLLECTION_VERSION = 1
const COACH_CHAT_STORAGE_KEY_PREFIX = '@coach_chat_snapshots_v1:'
const CREATE_POST_DRAFT_SCOPE = 'create_post:draft'

export type CoachChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  linkedUserMessageId?: string
  createdAt?: string
  status?: 'sending' | 'sent' | 'failed'
}

export type CoachChatPersistenceDescriptor =
  | { kind: 'main' }
  | { kind: 'create_post'; sessionId?: string | null }

export interface CoachChatSnapshot {
  messages: CoachChatMessage[]
  input: string
  selectedImages: string[]
  // Assistant message IDs whose generated workout/program has been saved by the
  // user. Persisted so the "Saved" UI in workout/program cards survives chat
  // reloads and prevents accidental double-saves.
  savedAssistantMessageIds: string[]
}

interface PersistedCoachChatSnapshot extends CoachChatSnapshot {
  savedAt: number
}

interface PersistedCoachChatCollection {
  version: number
  snapshots: Record<string, PersistedCoachChatSnapshot>
}

function getStorageKey(userId: string): string {
  return `${COACH_CHAT_STORAGE_KEY_PREFIX}${userId}`
}

export function getCoachChatPersistenceScopeKey(
  descriptor: CoachChatPersistenceDescriptor,
): string {
  if (descriptor.kind === 'main') {
    return 'main'
  }

  const sessionId = descriptor.sessionId?.trim()
  return sessionId ? `create_post:${sessionId}` : CREATE_POST_DRAFT_SCOPE
}

function sanitizeMessages(value: unknown): CoachChatMessage[] {
  if (!Array.isArray(value)) return []

  const sanitized = value.flatMap((message): CoachChatMessage[] => {
    if (!message || typeof message !== 'object') return []

    const candidate = message as Partial<CoachChatMessage>
    if (
      typeof candidate.id !== 'string' ||
      (candidate.role !== 'user' && candidate.role !== 'assistant') ||
      typeof candidate.content !== 'string'
    ) {
      return []
    }

    const nextMessage: CoachChatMessage = {
      id: candidate.id,
      role: candidate.role,
      content: candidate.content,
    }

    const images = Array.isArray(candidate.images)
      ? candidate.images.filter(
          (image): image is string => typeof image === 'string' && image.length > 0,
        )
      : undefined
    if (images && images.length > 0) {
      nextMessage.images = images
    }

    if (typeof candidate.linkedUserMessageId === 'string') {
      nextMessage.linkedUserMessageId = candidate.linkedUserMessageId
    }

    if (typeof candidate.createdAt === 'string') {
      nextMessage.createdAt = candidate.createdAt
    }

    if (
      candidate.status === 'sending' ||
      candidate.status === 'sent' ||
      candidate.status === 'failed'
    ) {
      nextMessage.status =
        candidate.role === 'user' && candidate.status === 'sending'
          ? 'failed'
          : candidate.status
    }

    if (candidate.role === 'assistant' && !candidate.content.trim()) {
      return []
    }

    return [nextMessage]
  })

  return sanitized
}

export function hasMeaningfulCoachChatSnapshot(
  snapshot: CoachChatSnapshot | null | undefined,
): boolean {
  if (!snapshot) return false

  return (
    snapshot.messages.length > 0 ||
    snapshot.input.trim().length > 0 ||
    snapshot.selectedImages.length > 0 ||
    snapshot.savedAssistantMessageIds.length > 0
  )
}

export function sanitizeCoachChatSnapshot(
  value: unknown,
): CoachChatSnapshot | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<PersistedCoachChatSnapshot>
  const input = typeof candidate.input === 'string' ? candidate.input : ''
  const selectedImages = Array.isArray(candidate.selectedImages)
    ? candidate.selectedImages.filter(
        (image): image is string => typeof image === 'string' && image.length > 0,
      )
    : []
  const messages = sanitizeMessages(candidate.messages)
  const savedAssistantMessageIds = Array.isArray(
    candidate.savedAssistantMessageIds,
  )
    ? Array.from(
        new Set(
          candidate.savedAssistantMessageIds.filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          ),
        ),
      )
    : []

  if (
    messages.length === 0 &&
    input.trim().length === 0 &&
    selectedImages.length === 0 &&
    savedAssistantMessageIds.length === 0
  ) {
    return null
  }

  return {
    messages,
    input,
    selectedImages,
    savedAssistantMessageIds,
  }
}

export function mergeExternalMessages(
  existing: CoachChatMessage[],
  incoming: CoachChatMessage[],
): CoachChatMessage[] {
  if (incoming.length === 0) return existing

  const seen = new Set(existing.map((message) => message.id))
  const next = [...existing]

  for (const message of incoming) {
    if (seen.has(message.id)) continue
    seen.add(message.id)
    next.push(message)
  }

  return next.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return aTime - bTime
  })
}

function readCollection(userId: string): PersistedCoachChatCollection | null {
  const raw = storage.getString(getStorageKey(userId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedCoachChatCollection>
    if (parsed.version !== COACH_CHAT_COLLECTION_VERSION) {
      return null
    }

    if (!parsed.snapshots || typeof parsed.snapshots !== 'object') {
      return null
    }

    return {
      version: COACH_CHAT_COLLECTION_VERSION,
      snapshots: parsed.snapshots as Record<string, PersistedCoachChatSnapshot>,
    }
  } catch {
    return null
  }
}

function writeCollection(
  userId: string,
  collection: PersistedCoachChatCollection | null,
): void {
  const storageKey = getStorageKey(userId)
  if (!collection || Object.keys(collection.snapshots).length === 0) {
    storage.delete(storageKey)
    return
  }

  storage.set(storageKey, JSON.stringify(collection))
}

export async function loadCoachChatSnapshot(
  userId: string | undefined,
  descriptor: CoachChatPersistenceDescriptor,
): Promise<CoachChatSnapshot | null> {
  if (!userId) return null

  const collection = readCollection(userId)
  if (!collection) return null

  return sanitizeCoachChatSnapshot(
    collection.snapshots[getCoachChatPersistenceScopeKey(descriptor)],
  )
}

export async function saveCoachChatSnapshot(
  userId: string | undefined,
  descriptor: CoachChatPersistenceDescriptor,
  snapshot: CoachChatSnapshot,
): Promise<void> {
  if (!userId) return

  const scopeKey = getCoachChatPersistenceScopeKey(descriptor)
  const collection = readCollection(userId) ?? {
    version: COACH_CHAT_COLLECTION_VERSION,
    snapshots: {},
  }
  const sanitizedSnapshot = sanitizeCoachChatSnapshot(snapshot)

  if (!sanitizedSnapshot) {
    delete collection.snapshots[scopeKey]
    writeCollection(userId, collection)
    return
  }

  collection.snapshots[scopeKey] = {
    ...sanitizedSnapshot,
    savedAt: Date.now(),
  }
  writeCollection(userId, collection)
}

export async function clearCoachChatSnapshot(
  userId: string | undefined,
  descriptor: CoachChatPersistenceDescriptor,
): Promise<void> {
  if (!userId) return

  const collection = readCollection(userId)
  if (!collection) return

  delete collection.snapshots[getCoachChatPersistenceScopeKey(descriptor)]
  writeCollection(userId, collection)
}

export async function clearAllCoachChatSnapshots(
  userId: string | undefined,
): Promise<void> {
  if (!userId) return

  storage.delete(getStorageKey(userId))
}

export async function migrateCoachChatSnapshot(
  userId: string | undefined,
  from: CoachChatPersistenceDescriptor,
  to: CoachChatPersistenceDescriptor,
): Promise<void> {
  if (!userId) return

  const fromScopeKey = getCoachChatPersistenceScopeKey(from)
  const toScopeKey = getCoachChatPersistenceScopeKey(to)

  if (fromScopeKey === toScopeKey) return

  const collection = readCollection(userId)
  if (!collection) return

  const existing = sanitizeCoachChatSnapshot(collection.snapshots[fromScopeKey])
  delete collection.snapshots[fromScopeKey]

  if (existing && !collection.snapshots[toScopeKey]) {
    collection.snapshots[toScopeKey] = {
      ...existing,
      savedAt: Date.now(),
    }
  }

  writeCollection(userId, collection)
}
