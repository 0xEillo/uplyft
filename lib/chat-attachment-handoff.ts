import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'chat_attachment_handoff_v1'

export type ChatAttachmentAction =
  | { action: 'launch_camera' }
  | { action: 'launch_library' }
  | { action: 'photo_selected'; uri: string }
  | { action: 'scan_food' }
  | { action: 'generate_workout' }

export async function setPendingChatAttachment(
  payload: ChatAttachmentAction,
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(payload))
}

export async function consumePendingChatAttachment(): Promise<ChatAttachmentAction | null> {
  const raw = await AsyncStorage.getItem(KEY)
  if (!raw) return null
  await AsyncStorage.removeItem(KEY)
  try {
    return JSON.parse(raw) as ChatAttachmentAction
  } catch {
    return null
  }
}
