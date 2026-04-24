import { Layout, Radius } from '@/constants/theme'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Children, Fragment, ReactNode, isValidElement } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

interface SettingsCardProps {
  children: ReactNode
  /** Visual emphasis for the card border (e.g. destructive sections). */
  tone?: 'default' | 'destructive'
  /** Override border/background (rare — prefer tone). */
  style?: ViewStyle
}

/**
 * Rounded bordered container for grouped rows. Automatically inserts
 * <SettingsDivider/> between children so each screen doesn't have to.
 */
export function SettingsCard({ children, tone = 'default', style }: SettingsCardProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  const rows = Children.toArray(children).filter(Boolean)

  const toneStyle =
    tone === 'destructive' ? { borderColor: colors.statusError + '40' } : null

  return (
    <View style={[styles.card, toneStyle, style]}>
      {rows.map((child, i) => {
        const key = isValidElement(child) && child.key != null ? child.key : i
        return (
          <Fragment key={key}>
            {i > 0 ? <SettingsDivider /> : null}
            {child}
          </Fragment>
        )
      })}
    </View>
  )
}

/**
 * Hairline divider. Indented to align with row text.
 * Exposed for the rare case where callers need manual control.
 */
export function SettingsDivider() {
  const colors = useThemedColors()
  return (
    <View
      style={{
        height: Layout.hairline,
        backgroundColor: colors.border,
        marginLeft: ROW_DIVIDER_INSET,
      }}
    />
  )
}

/** Matches icon (22) + gap (16) + row padding (16) = 54. Tuned visually to 50. */
export const ROW_DIVIDER_INSET = 50

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      borderWidth: Layout.hairline,
      borderColor: colors.border,
      overflow: 'hidden',
    },
  })
