import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { ReactNode } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

interface BaseNavbarProps {
  leftContent: ReactNode
  rightContent?: ReactNode
  centerContent?: ReactNode
  paddingVertical?: number
  centerGlass?: boolean
}
type NavbarIslandVariant = 'icon'

/**
 * Base navbar component used across Home, Progress, and Profile screens.
 * Provides consistent styling and layout for the top navigation bar.
 */
export function BaseNavbar({
  leftContent,
  rightContent,
  centerContent,
  paddingVertical = 8,
  centerGlass = false,
}: BaseNavbarProps) {
  const styles = createStyles(paddingVertical)

  return (
    <View style={styles.header}>
      <View style={styles.leftContainer}>{leftContent}</View>

      {centerContent && (
        <View style={styles.centerContainer} pointerEvents="box-none">
          {centerGlass ? <NavbarIsland style={styles.centerIsland}>{centerContent}</NavbarIsland> : centerContent}
        </View>
      )}

      <View style={styles.rightContainer}>
        {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
      </View>
    </View>
  )
}

export function NavbarIsland({
  children,
  style,
  glass = true,
  variant = 'icon',
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  glass?: boolean
  variant?: NavbarIslandVariant
}) {
  if (!glass) {
    return <View style={style}>{children}</View>
  }

  return (
    <LiquidGlassSurface style={[islandStyles.icon, style]}>
      {children}
    </LiquidGlassSurface>
  )
}

const createStyles = (paddingVertical: number) =>
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
    centerIsland: {
      maxWidth: '82%',
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  })

const islandStyles = StyleSheet.create({
  icon: {
    width: 44,
    height: 44,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
