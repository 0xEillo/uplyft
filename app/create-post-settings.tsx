import {
  SettingsCard,
  SettingsScreen,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/ui/settings'
import { AnalyticsEvents } from '@/constants/analytics-events'
import {
  FontWeight,
  Radius,
  Spacing,
  Typography,
} from '@/constants/theme'
import { useAnalytics } from '@/contexts/analytics-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { haptic } from '@/lib/haptics'
import {
  getRestTimerSoundEnabled,
  getShowWarmupSets,
  getToolbarButtons,
  getWarmupCalculatorEnabled,
  setRestTimerSoundEnabled,
  setShowWarmupSets,
  setToolbarButtons,
  setWarmupCalculatorEnabled,
  type ToolbarButtonId,
} from '@/lib/utils/create-post-settings'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const TOOLBAR_BUTTON_OPTIONS: {
  id: ToolbarButtonId
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}[] = [
  { id: 'workout-scan', label: 'Workout Scan', icon: 'camera-outline' },
  { id: 'voice-log', label: 'Voice Log', icon: 'mic-outline' },
  { id: 'rest-timer', label: 'Rest Timer', icon: 'stopwatch-outline' },
  { id: 'routines', label: 'Routines', icon: 'albums-outline' },
  { id: 'search', label: 'Add Exercise', icon: 'add-outline' },
]

export default function CreatePostSettingsScreen() {
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const router = useRouter()
  const [warmupCalculatorEnabled, setWarmupCalculatorEnabledState] = useState(
    () => getWarmupCalculatorEnabled(),
  )
  const [toolbarButtons, setToolbarButtonsState] = useState<ToolbarButtonId[]>(
    () => getToolbarButtons(),
  )
  const [showWarmupSets, setShowWarmupSetsState] = useState(() =>
    getShowWarmupSets(),
  )
  const [restTimerSoundEnabled, setRestTimerSoundEnabledState] = useState(() =>
    getRestTimerSoundEnabled(),
  )
  const styles = createStyles(colors)

  const handleToggleShowWarmupSets = useCallback((enabled: boolean) => {
    setShowWarmupSetsState(enabled)
    setShowWarmupSets(enabled)
    haptic('light')
  }, [])

  const handleToggleToolbarButton = useCallback((id: ToolbarButtonId) => {
    haptic('light')
    setToolbarButtonsState((prev) => {
      const next = prev.includes(id)
        ? prev.filter((b) => b !== id)
        : [...prev, id]
      setToolbarButtons(next)
      return next
    })
  }, [])

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

  const handleToggleRestTimerSound = useCallback(
    (enabled: boolean) => {
      setRestTimerSoundEnabledState(enabled)
      setRestTimerSoundEnabled(enabled)
      haptic('light')
      trackEvent(AnalyticsEvents.SETTINGS_CHANGED, {
        setting: 'create_post_rest_timer_sound',
        value: enabled,
      })
    },
    [trackEvent],
  )

  return (
    <SettingsScreen title="Workout Settings" onBack={() => router.back()}>
      <SettingsSection title="Create Workout">
        <SettingsCard>
          <SettingsSwitchRow
            title="Warm-up Calculator"
            value={warmupCalculatorEnabled}
            onValueChange={handleToggleWarmupCalculator}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Workout Display">
        <SettingsCard>
          <SettingsSwitchRow
            title="Show Warm-up Sets"
            description="Display warm-up sets in workout posts."
            value={showWarmupSets}
            onValueChange={handleToggleShowWarmupSets}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Rest Timer">
        <SettingsCard>
          <SettingsSwitchRow
            title="Play Sound"
            description="Play a sound when your rest timer finishes."
            value={restTimerSoundEnabled}
            onValueChange={handleToggleRestTimerSound}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Toolbar Buttons">
        <SettingsCard>
          {TOOLBAR_BUTTON_OPTIONS.map((option) => {
            const isEnabled = toolbarButtons.includes(option.id)
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.toolbarOptionRow}
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
            )
          })}
        </SettingsCard>
      </SettingsSection>
    </SettingsScreen>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    toolbarOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
    },
    toolbarOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    toolbarOptionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: Radius.md - 2,
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
    settingTitle: {
      ...Typography.bodyLargeSemibold,
      fontWeight: FontWeight.semibold,
      color: colors.textPrimary,
    },
  })
