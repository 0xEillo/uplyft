import { Spacing, Typography } from '@/constants/theme'
import { useThemedColors } from '@/hooks/useThemedColors'
import { ReactNode } from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'

interface SettingsSectionProps {
  /** Uppercase heading rendered above the card. Omit for an untitled section. */
  title?: string
  children: ReactNode
  /** Override wrapper style (rare — prefer composition). */
  style?: ViewStyle
}

/**
 * Section wrapper with consistent title + spacing.
 * Place a <SettingsCard> inside for the typical card-of-rows pattern.
 */
export function SettingsSection({ title, children, style }: SettingsSectionProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.overline,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
      marginLeft: Spacing.xs,
    },
  })
