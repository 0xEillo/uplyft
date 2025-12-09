import { useThemedColors } from '@/hooks/useThemedColors'
import { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface BaseNavbarProps {
  leftContent: ReactNode
  rightContent?: ReactNode
  centerContent?: ReactNode
  paddingVertical?: number
}

/**
 * Base navbar component used across Home, Progress, and Profile screens.
 * Provides consistent styling and layout for the top navigation bar.
 */
export function BaseNavbar({
  leftContent,
  rightContent,
  centerContent,
  paddingVertical = 8,
}: BaseNavbarProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()

  const styles = createStyles(colors, paddingVertical)

  return (
    <View style={styles.header}>
      <View style={styles.leftContainer}>{leftContent}</View>

      {centerContent && (
        <View style={styles.centerContainer} pointerEvents="box-none">
          {centerContent}
        </View>
      )}

      <View style={styles.rightContainer}>
        {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
      </View>
    </View>
  )
}

export function NavbarIsland({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={style}>{children}</View>
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  paddingVertical: number,
) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: paddingVertical,
      minHeight: 60,
      backgroundColor: 'transparent',
      zIndex: 10,
    },
    leftContainer: {
      zIndex: 2,
    },
    rightContainer: {
      zIndex: 2,
    },
    centerContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  })
