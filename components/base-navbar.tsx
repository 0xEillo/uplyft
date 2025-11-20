import { useThemedColors } from '@/hooks/useThemedColors'
import { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface BaseNavbarProps {
  leftContent: ReactNode
  rightContent?: ReactNode
  paddingVertical?: number
}

/**
 * Base navbar component used across Home, Progress, and Profile screens.
 * Provides consistent styling and layout for the top navigation bar.
 */
export function BaseNavbar({
  leftContent,
  rightContent,
  paddingVertical = 8,
}: BaseNavbarProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()

  const styles = createStyles(colors, paddingVertical)

  return (
    <>
      {/* Status bar background to match navbar */}
      <View style={[styles.statusBarBackground, { height: insets.top }]} />

      {/* Header */}
      <View style={styles.header}>
        {leftContent}
        {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
      </View>
    </>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  paddingVertical: number,
) =>
  StyleSheet.create({
    statusBarBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.white,
      zIndex: 0,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      height: 50,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  })
