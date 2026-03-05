const toNonEmptyTrimmedString = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const resolveOnboardingDisplayName = (
  onboardingName: string | null | undefined,
): string => {
  return toNonEmptyTrimmedString(onboardingName) ?? 'Guest'
}

export const resolveUserTagBase = (
  displayName: string,
  fallback = 'Athlete',
): string => {
  const cleanedName = displayName.replace(/[^a-zA-Z0-9]/g, '')
  return cleanedName.length >= 3 ? displayName : fallback
}
