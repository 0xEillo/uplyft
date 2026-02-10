import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { ReactNode } from 'react'
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'

interface ScreenHeaderProps {
  title?: string
  onLeftPress?: () => void
  onRightPress?: () => void
  leftIcon?: keyof typeof Ionicons.glyphMap
  rightIcon?: keyof typeof Ionicons.glyphMap
  rightLoading?: boolean
  rightDisabled?: boolean
  rightStyle?: 'default' | 'primary'
  leftDisabled?: boolean
  centerComponent?: ReactNode
}

export function ScreenHeader({
  title,
  onLeftPress,
  onRightPress,
  leftIcon = 'close',
  rightIcon,
  rightLoading = false,
  rightDisabled = false,
  rightStyle = 'default',
  leftDisabled = false,
  centerComponent,
}: ScreenHeaderProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const leftControl = (
    <LiquidGlassSurface style={styles.iconShell}>
      <TouchableOpacity
        onPress={onLeftPress}
        style={styles.iconButton}
        disabled={leftDisabled}
      >
        {leftIcon && <Ionicons name={leftIcon} size={22} color={colors.textPrimary} />}
      </TouchableOpacity>
    </LiquidGlassSurface>
  )

  const rightControl = onRightPress ? (
    rightStyle === 'primary' ? (
      <TouchableOpacity
        onPress={onRightPress}
        style={[styles.primaryButton]}
        disabled={rightDisabled || rightLoading}
      >
        {rightLoading ? (
          <ActivityIndicator color={colors.surface} />
        ) : rightIcon ? (
          <Ionicons name={rightIcon} size={22} color={colors.surface} />
        ) : null}
      </TouchableOpacity>
    ) : (
      <LiquidGlassSurface style={styles.iconShell}>
        <TouchableOpacity
          onPress={onRightPress}
          style={styles.iconButton}
          disabled={rightDisabled || rightLoading}
        >
          {rightLoading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : rightIcon ? (
            <Ionicons name={rightIcon} size={22} color={colors.textPrimary} />
          ) : null}
        </TouchableOpacity>
      </LiquidGlassSurface>
    )
  ) : (
    <View style={styles.headerSpacer} />
  )

  return (
    <View style={styles.header}>
      {leftControl}

      {centerComponent ? (
        centerComponent
      ) : title ? (
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.headerSpacer} />
      )}

      {rightControl}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    iconShell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: {
      width: 44,
      height: 44,
    },
    primaryButton: {
      backgroundColor: colors.brandPrimary,
      borderRadius: 22,
      paddingHorizontal: 16,
      height: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      maxWidth: '72%',
      textAlign: 'center',
    },
  })
