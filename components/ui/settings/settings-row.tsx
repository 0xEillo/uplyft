import { IconSize, Spacing, Typography } from '@/constants/theme'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { ReactNode } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from 'react-native'

export interface SettingsRowProps {
  /** Ionicon name. Omit for rows without an icon. */
  icon?: keyof typeof Ionicons.glyphMap
  /** Row title. */
  title: string
  /** Secondary description rendered below the title. */
  description?: string
  /** Tap handler. If omitted, the row is static (no chevron, no ripple). */
  onPress?: () => void
  /** Use for sign-out / delete style rows. Red icon + red title. */
  destructive?: boolean
  /**
   * Right-hand content. When omitted and `onPress` is set,
   * a chevron is rendered automatically. Pass `null` to suppress it.
   */
  rightContent?: ReactNode | null
  /** Force-hide the default chevron even when onPress is set. */
  hideChevron?: boolean
  /** Disable the row (dims it and blocks onPress). */
  disabled?: boolean
  /** Forwarded to the underlying TouchableOpacity. */
  touchableProps?: Omit<
    TouchableOpacityProps,
    'onPress' | 'disabled' | 'style' | 'children'
  >
}

/**
 * Unified settings-card row. Handles the icon + title + description + right
 * content layout so every row across the app is pixel-identical.
 */
export function SettingsRow({
  icon,
  title,
  description,
  onPress,
  destructive = false,
  rightContent,
  hideChevron = false,
  disabled = false,
  touchableProps,
}: SettingsRowProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const iconColor = destructive ? colors.statusError : colors.textSecondary
  const titleStyle = destructive ? styles.titleDestructive : styles.title

  const defaultChevron =
    onPress && !hideChevron ? (
      <Ionicons
        name="chevron-forward"
        size={IconSize.md}
        color={colors.textMuted}
      />
    ) : null

  // `rightContent === null` means "explicitly no chevron"
  const right = rightContent !== undefined ? rightContent : defaultChevron

  const body = (
    <>
      <View style={styles.leading}>
        {icon ? <Ionicons name={icon} size={IconSize.lg} color={iconColor} /> : null}
        <View style={styles.textContainer}>
          <Text style={titleStyle}>{title}</Text>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
        </View>
      </View>
      {right}
    </>
  )

  if (!onPress) {
    return <View style={[styles.row, disabled && styles.disabled]}>{body}</View>
  }

  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      {...touchableProps}
    >
      {body}
    </TouchableOpacity>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    row: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.base,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    disabled: {
      opacity: 0.5,
    },
    leading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.base,
      flex: 1,
      marginRight: Spacing.base,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      ...Typography.bodyLargeSemibold,
      color: colors.textPrimary,
    },
    titleDestructive: {
      ...Typography.bodyLargeSemibold,
      fontWeight: '700',
      color: colors.statusError,
    },
    description: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: Spacing.xxs,
    },
  })
