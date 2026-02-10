import { getColors } from '@/constants/colors'
import { useTheme } from '@/contexts/theme-context'
import { ReactNode, useEffect } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'

interface SlideInViewProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Deprecated: kept for backward compatibility */
  duration?: number
  /** Deprecated: kept for backward compatibility */
  delay?: number
  /** Deprecated: kept for backward compatibility */
  enabled?: boolean
  /** Deprecated: kept for backward compatibility */
  fade?: boolean
  /** Optional override background color */
  backgroundColor?: string
  /** Trigger exit flow; callback fires immediately */
  shouldExit?: boolean
  /** Callback when exit flow completes */
  onExitComplete?: () => void
}

/**
 * Compatibility wrapper.
 *
 * Native stack transitions now handle page animation. This component no longer
 * applies custom JS-driven slide effects, but preserves the previous API so
 * existing screens don't break.
 */
export function SlideInView({
  children,
  style,
  backgroundColor,
  shouldExit = false,
  onExitComplete,
}: SlideInViewProps) {
  const { isDark } = useTheme()
  const colors = getColors(isDark)

  useEffect(() => {
    if (shouldExit) {
      onExitComplete?.()
    }
  }, [shouldExit, onExitComplete])

  return (
    <View
      style={[
        {
          backgroundColor: backgroundColor || colors.bg,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
