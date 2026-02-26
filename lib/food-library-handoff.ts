import AsyncStorage from '@react-native-async-storage/async-storage'

const FOOD_LIBRARY_CHAT_HANDOFF_KEY = 'food_library_chat_handoff_v1'

type FoodLibraryChatHandoffPayload = {
  type: 'prefill_text'
  text: string
  createdAt: string
}

export async function setPendingFoodLibraryChatText(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  const payload: FoodLibraryChatHandoffPayload = {
    type: 'prefill_text',
    text: trimmed,
    createdAt: new Date().toISOString(),
  }

  await AsyncStorage.setItem(FOOD_LIBRARY_CHAT_HANDOFF_KEY, JSON.stringify(payload))
}

export async function consumePendingFoodLibraryChatText(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(FOOD_LIBRARY_CHAT_HANDOFF_KEY)
  if (!raw) return null

  await AsyncStorage.removeItem(FOOD_LIBRARY_CHAT_HANDOFF_KEY)

  try {
    const payload = JSON.parse(raw) as Partial<FoodLibraryChatHandoffPayload>
    if (payload?.type !== 'prefill_text' || typeof payload.text !== 'string') {
      return null
    }

    const trimmed = payload.text.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

