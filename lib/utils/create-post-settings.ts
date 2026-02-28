import { MMKV } from 'react-native-mmkv'

const storage = new MMKV({ id: 'create-post-settings' })

const WARMUP_CALCULATOR_ENABLED_KEY = '@create_post_warmup_calculator_enabled'
const TOOLBAR_BUTTONS_KEY = '@create_post_toolbar_buttons'

export function getWarmupCalculatorEnabled(): boolean {
  return storage.getBoolean(WARMUP_CALCULATOR_ENABLED_KEY) ?? false
}

export function setWarmupCalculatorEnabled(enabled: boolean): void {
  storage.set(WARMUP_CALCULATOR_ENABLED_KEY, enabled)
}

export type ToolbarButtonId =
  | 'workout-scan'
  | 'voice-log'
  | 'rest-timer'
  | 'routines'
  | 'search'

export const DEFAULT_TOOLBAR_BUTTONS: ToolbarButtonId[] = [
  'rest-timer',
  'routines',
  'search',
]

export function getToolbarButtons(): ToolbarButtonId[] {
  const raw = storage.getString(TOOLBAR_BUTTONS_KEY)
  if (!raw) return DEFAULT_TOOLBAR_BUTTONS
  try {
    return JSON.parse(raw) as ToolbarButtonId[]
  } catch {
    return DEFAULT_TOOLBAR_BUTTONS
  }
}

export function setToolbarButtons(buttons: ToolbarButtonId[]): void {
  storage.set(TOOLBAR_BUTTONS_KEY, JSON.stringify(buttons))
}

const SHOW_WARMUP_SETS_KEY = '@create_post_show_warmup_sets'

export function getShowWarmupSets(): boolean {
  return storage.getBoolean(SHOW_WARMUP_SETS_KEY) ?? true
}

export function setShowWarmupSets(show: boolean): void {
  storage.set(SHOW_WARMUP_SETS_KEY, show)
}
