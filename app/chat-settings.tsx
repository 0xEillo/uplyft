import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useProfile } from '@/contexts/profile-context'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { clearAllCoachChatSnapshots } from '@/lib/utils/coach-chat-storage'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { RetentionPushPreferences } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SHEET_SPACING = {
  top: 32,
  section: 28,
  sectionInner: 12,
} as const

export default function ChatSettingsScreen() {
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [retentionPrefs, setRetentionPrefs] =
    useState<RetentionPushPreferences | null>(null)
  const [isProactiveUpdating, setIsProactiveUpdating] = useState(false)
  const [contextText, setContextText] = useState(profile?.bio ?? '')
  const contextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    void database.retentionPushPreferences
      .get(user.id)
      .then((prefs) => {
        if (!cancelled) {
          setRetentionPrefs(prefs)
        }
      })
      .catch((error) => {
        console.error('Error loading proactive coach setting:', error)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const saveContext = useCallback(
    async (text: string) => {
      if (!profile) return
      try {
        await updateProfile({ bio: text.trim() || null })
      } catch (error) {
        console.error('Error saving AI context:', error)
      }
    },
    [profile, updateProfile],
  )

  const handleContextChange = useCallback(
    (text: string) => {
      setContextText(text)
      if (contextTimerRef.current) clearTimeout(contextTimerRef.current)
      contextTimerRef.current = setTimeout(() => saveContext(text), 800)
    },
    [saveContext],
  )

  const handleClearAllCoachChats = useCallback(() => {
    Alert.alert(
      'Clear All Chats',
      'This will remove your saved AI chat history and drafts from the main chat and the create-post chat sheet on this device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            haptic('light')
            void clearAllCoachChatSnapshots(user?.id)
          },
        },
      ],
    )
  }, [user?.id])

  const handleToggleProactiveCoach = useCallback(
    async (value: boolean) => {
      if (!user?.id || !retentionPrefs) return
      haptic('light')

      try {
        setIsProactiveUpdating(true)
        const updated = await database.retentionPushPreferences.update(user.id, {
          proactive_coach_enabled: value,
        })
        setRetentionPrefs(updated)
      } catch (error) {
        console.error('Error updating proactive coach setting:', error)
        Alert.alert('Error', 'Unable to update proactive coach messages.')
      } finally {
        setIsProactiveUpdating(false)
      }
    },
    [retentionPrefs, user?.id],
  )

  const styles = createStyles(colors, isDark)

  return (
    <View
      collapsable={false}
      style={[
        styles.formSheetContainer,
        { paddingBottom: insets.bottom + NATIVE_SHEET_LAYOUT.bottomSafeAreaPadding },
      ]}
    >
      <LiquidGlassSurface style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.formSheetScroll}
        contentContainerStyle={styles.formSheetScrollContent}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Context</Text>
          <Text style={styles.sectionDescription}>
            Anything Rep AI should know — injuries, preferences, goals, etc.
          </Text>
          <TextInput
            style={styles.contextInput}
            value={contextText}
            onChangeText={handleContextChange}
            placeholder="E.g., I have a knee injury, I prefer powerlifting, cut to 180 lbs..."
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            maxLength={500}
            onBlur={() => saveContext(contextText)}
          />
          <Text style={styles.contextCharCount}>
            {contextText.length}/500
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Messages</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Proactive check-ins</Text>
              <Text style={styles.sectionDescription}>
                Let Rep AI start the chat around training moments.
              </Text>
            </View>
            <Switch
              value={retentionPrefs?.proactive_coach_enabled ?? true}
              onValueChange={handleToggleProactiveCoach}
              disabled={!retentionPrefs || isProactiveUpdating}
              trackColor={{
                false: isDark ? 'rgba(255,255,255,0.16)' : '#D9D9DE',
                true: colors.brandPrimary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          <TouchableOpacity
            style={styles.clearChatsButton}
            onPress={handleClearAllCoachChats}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color="#B42318" />
            <Text style={styles.clearChatsText}>Clear all chats</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    formSheetContainer: {
      flex: 1,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    },
    formSheetScroll: {
      flex: 1,
    },
    formSheetScrollContent: {
      paddingHorizontal: NATIVE_SHEET_LAYOUT.horizontalPadding,
      paddingTop: SHEET_SPACING.top,
      paddingBottom: NATIVE_SHEET_LAYOUT.contentBottomSpacing + 8,
      gap: SHEET_SPACING.section,
    },
    section: {
      gap: SHEET_SPACING.sectionInner,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 0,
    },
    sectionDescription: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 18,
    },
    contextInput: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED',
      padding: 14,
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
      minHeight: 100,
      lineHeight: 21,
    },
    contextCharCount: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textTertiary,
      textAlign: 'right',
    },
    toggleRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 4,
    },
    toggleCopy: {
      flex: 1,
      gap: 4,
    },
    toggleTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    clearChatsButton: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(180,35,24,0.35)' : '#F3C7C2',
      backgroundColor: isDark ? 'rgba(180,35,24,0.12)' : '#FFF4F2',
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    clearChatsText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#B42318',
    },
  })
