import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { IconSize, Layout, Radius, Spacing, Typography } from '@/constants/theme'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import { ReactNode } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ScrollViewProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface SettingsScreenProps {
  /** Title rendered in the centre of the navbar. */
  title: string
  /** Back handler. Omit to hide the back button. */
  onBack?: () => void
  /** Optional right-side control (e.g. a "Save" button). */
  rightAction?: ReactNode
  /** Shows a centred spinner instead of children. */
  loading?: boolean
  /** ScrollView children. */
  children: ReactNode
  /** Override the underlying ScrollView props (e.g. refreshControl). */
  scrollViewProps?: Omit<
    ScrollViewProps,
    'contentContainerStyle' | 'scrollIndicatorInsets' | 'children'
  >
}

/**
 * Standard settings screen scaffold.
 *
 * Handles the full header/scroll/insets dance that was copy-pasted across
 * ~11 screens. Compose its children with <SettingsSection> and <SettingsCard>.
 */
export function SettingsScreen({
  title,
  onBack,
  rightAction,
  loading = false,
  children,
  scrollViewProps,
}: SettingsScreenProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors)

  const header = (
    <BlurredHeader>
      <BaseNavbar
        leftContent={
          onBack ? (
            <NavbarIsland>
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Ionicons
                  name="arrow-back"
                  size={IconSize.xl}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </NavbarIsland>
          ) : (
            <View style={styles.backButton} />
          )
        }
        centerContent={<Text style={styles.headerTitle}>{title}</Text>}
        rightContent={rightAction}
      />
    </BlurredHeader>
  )

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Layout.navbarHeight },
        ]}
        scrollIndicatorInsets={{ top: insets.top + Layout.navbarHeight }}
        showsVerticalScrollIndicator={false}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerTitle: {
      ...Typography.headerTitle,
      color: colors.textPrimary,
    },
    backButton: {
      width: Layout.tapTarget,
      height: Layout.tapTarget,
      borderRadius: Radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: Spacing.xxxl,
    },
  })
