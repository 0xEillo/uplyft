import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import {
  getShowWarmupSets,
  getToolbarButtons,
  getWarmupCalculatorEnabled,
  setShowWarmupSets,
  setToolbarButtons,
  setWarmupCalculatorEnabled,
  type ToolbarButtonId,
} from '@/lib/utils/create-post-settings'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TOOLBAR_BUTTON_OPTIONS: {
  id: ToolbarButtonId
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}[] = [
  { id: 'workout-scan', label: 'Workout Scan', icon: 'camera-outline' },
  { id: 'voice-log', label: 'Voice Log', icon: 'mic-outline' },
  { id: 'rest-timer', label: 'Rest Timer', icon: 'stopwatch-outline' },
  { id: 'routines', label: 'Routines', icon: 'albums-outline' },
  { id: 'search', label: 'Search', icon: 'search-outline' },
]

const NAVBAR_HEIGHT = 76

export default function CreatePostSettingsScreen() {
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [
    warmupCalculatorEnabled,
    setWarmupCalculatorEnabledState,
  ] = useState(() => getWarmupCalculatorEnabled())
  const [toolbarButtons, setToolbarButtonsState] = useState<ToolbarButtonId[]>(
    () => getToolbarButtons(),
  )
  const [showWarmupSets, setShowWarmupSetsState] = useState(
    () => getShowWarmupSets(),
  )
  const styles = createStyles(colors)

  const handleGoBack = useCallback(() => {
    router.back()
  }, [router])

  const handleToggleShowWarmupSets = useCallback(
    (enabled: boolean) => {
      setShowWarmupSetsState(enabled)
      setShowWarmupSets(enabled)
      haptic('light')
    },
    [],
  )

  const handleToggleToolbarButton = useCallback(
    (id: ToolbarButtonId) => {
      haptic('light')
      setToolbarButtonsState((prev) => {
        const next = prev.includes(id)
          ? prev.filter((b) => b !== id)
          : [...prev, id]
        setToolbarButtons(next)
        return next
      })
    },
    [],
  )

  const handleToggleWarmupCalculator = useCallback(
    (enabled: boolean) => {
      setWarmupCalculatorEnabledState(enabled)
      setWarmupCalculatorEnabled(enabled)
      haptic('light')
      trackEvent(AnalyticsEvents.SETTINGS_CHANGED, {
        setting: 'create_post_warmup_calculator',
        value: enabled,
      })
    },
    [trackEvent],
  )

  return (
    <View style={styles.container}>
      <BlurredHeader>
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity
                onPress={handleGoBack}
                style={styles.backButton}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={
            <Text style={styles.headerTitle}>Workout Settings</Text>
          }
        />
      </BlurredHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + NAVBAR_HEIGHT },
        ]}
        scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create Workout</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Warm-up Calculator</Text>
              </View>
              <Switch
                value={warmupCalculatorEnabled}
                onValueChange={handleToggleWarmupCalculator}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={
                  warmupCalculatorEnabled ? colors.brandPrimary : '#F3F4F6'
                }
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Display</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Show Warm-up Sets</Text>
                <Text style={styles.settingDescription}>
                  Display warm-up sets in workout detail views and feed cards.
                </Text>
              </View>
              <Switch
                value={showWarmupSets}
                onValueChange={handleToggleShowWarmupSets}
                trackColor={{ false: '#D1D5DB', true: colors.brandPrimarySoft }}
                thumbColor={showWarmupSets ? colors.brandPrimary : '#F3F4F6'}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Toolbar Buttons</Text>
          <View style={styles.card}>
            {TOOLBAR_BUTTON_OPTIONS.map((option, index) => {
              const isEnabled = toolbarButtons.includes(option.id)
              const isLast = index === TOOLBAR_BUTTON_OPTIONS.length - 1
              return (
                <View key={option.id}>
                  <TouchableOpacity
                    style={[
                      styles.toolbarOptionRow,
                      !isLast && styles.toolbarOptionDivider,
                    ]}
                    onPress={() => handleToggleToolbarButton(option.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.toolbarOptionLeft}>
                      <View
                        style={[
                          styles.toolbarOptionIconWrap,
                          isEnabled && styles.toolbarOptionIconWrapActive,
                        ]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={18}
                          color={
                            isEnabled ? colors.brandPrimary : colors.textSecondary
                          }
                        />
                      </View>
                      <Text style={styles.settingTitle}>{option.label}</Text>
                    </View>
                    <Ionicons
                      name={isEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isEnabled ? colors.brandPrimary : colors.border}
                    />
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        </View>
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
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 18,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    settingTextContainer: {
      flex: 1,
      paddingRight: 4,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    sectionDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    toolbarOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    toolbarOptionDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    toolbarOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    toolbarOptionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    toolbarOptionIconWrapActive: {
      backgroundColor: colors.brandPrimarySoft,
      borderColor: colors.brandPrimary,
    },
  })
