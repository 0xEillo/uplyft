import { MMKV } from 'react-native-mmkv'

const storage = new MMKV({ id: 'create-post-settings' })

const WARMUP_CALCULATOR_ENABLED_KEY = '@create_post_warmup_calculator_enabled'
const TOOLBAR_BUTTONS_KEY = '@create_post_toolbar_buttons'

export function getWarmupCalculatorEnabled(): boolean {
  return storage.getBoolean(WARMUP_CALCULATOR_ENABLED_KEY) ?? true
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

const LEGACY_DEFAULT_TOOLBAR_BUTTONS: ToolbarButtonId[] = [
  'rest-timer',
  'routines',
  'search',
]

export const DEFAULT_TOOLBAR_BUTTONS: ToolbarButtonId[] = [
  'rest-timer',
  'search',
]

const TOOLBAR_BUTTON_IDS = new Set<ToolbarButtonId>([
  'workout-scan',
  'voice-log',
  'rest-timer',
  'routines',
  'search',
])

function sanitizeToolbarButtons(value: unknown): ToolbarButtonId[] {
  if (!Array.isArray(value)) return DEFAULT_TOOLBAR_BUTTONS

  const buttons = value.filter(
    (button): button is ToolbarButtonId =>
      typeof button === 'string' &&
      TOOLBAR_BUTTON_IDS.has(button as ToolbarButtonId),
  )

  const dedupedButtons = buttons.filter(
    (button, index) => buttons.indexOf(button) === index,
  )

  if (dedupedButtons.length === 0) {
    return DEFAULT_TOOLBAR_BUTTONS
  }

  return dedupedButtons
}

function isToolbarButtonSet(
  value: ToolbarButtonId[],
  expected: ToolbarButtonId[],
): boolean {
  return (
    value.length === expected.length &&
    value.every((button, index) => button === expected[index])
  )
}

export function getToolbarButtons(): ToolbarButtonId[] {
  const raw = storage.getString(TOOLBAR_BUTTONS_KEY)
  if (!raw) return DEFAULT_TOOLBAR_BUTTONS
  try {
    const buttons = sanitizeToolbarButtons(JSON.parse(raw))

    if (isToolbarButtonSet(buttons, LEGACY_DEFAULT_TOOLBAR_BUTTONS)) {
      return DEFAULT_TOOLBAR_BUTTONS
    }

    return buttons
  } catch {
    return DEFAULT_TOOLBAR_BUTTONS
  }
}

export function setToolbarButtons(buttons: ToolbarButtonId[]): void {
  storage.set(TOOLBAR_BUTTONS_KEY, JSON.stringify(buttons))
}

const SHOW_WARMUP_SETS_KEY = '@create_post_show_warmup_sets'

export function getShowWarmupSets(): boolean {
  return storage.getBoolean(SHOW_WARMUP_SETS_KEY) ?? false
}

export function setShowWarmupSets(show: boolean): void {
  storage.set(SHOW_WARMUP_SETS_KEY, show)
}
