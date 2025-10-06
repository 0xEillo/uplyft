import { getColors } from '@/constants/colors'
import { useTheme } from '@/contexts/theme-context'

export function useThemedColors() {
  const { isDark } = useTheme()
  return getColors(isDark)
}
