import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useProfile } from '@/contexts/profile-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { COACH_OPTIONS, CoachId } from '@/lib/coaches'
import { haptic } from '@/lib/haptics'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
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
  const { profile, updateProfile } = useProfile()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [isUpdating, setIsUpdating] = useState(false)
  const [contextText, setContextText] = useState(profile?.bio ?? '')
  const contextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleSelectCoach = async (coachId: CoachId) => {
    if (!profile || profile.coach === coachId) return
    haptic('light')
    try {
      setIsUpdating(true)
      await updateProfile({ coach: coachId })
    } catch (error) {
      console.error('Error updating coach:', error)
      Alert.alert('Error', 'Unable to update coach. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

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
          <Text style={styles.sectionTitle}>AI Coach</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.coachScroll}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {COACH_OPTIONS.map((coach) => {
              const isSelected = profile?.coach === coach.id
              return (
                <TouchableOpacity
                  key={coach.id}
                  style={[
                    styles.coachCard,
                    isSelected && styles.coachCardSelected,
                  ]}
                  onPress={() => handleSelectCoach(coach.id)}
                  disabled={isUpdating}
                >
                  <View style={styles.avatarContainer}>
                    <Image source={coach.image} style={styles.avatar} />
                    <View style={styles.emojiBadge}>
                      {coach.id === 'kino' && <Text style={styles.emojiText}>👊</Text>}
                      {coach.id === 'maya' && <Text style={styles.emojiText}>👏</Text>}
                      {coach.id === 'ross' && <Text style={styles.emojiText}>📋</Text>}
                    </View>
                  </View>
                  <Text style={styles.coachName}>{coach.name}</Text>
                  <Text style={styles.coachDescription} numberOfLines={3}>
                    {coach.description}
                  </Text>

                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={14} color={colors.surface} />
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Context</Text>
          <Text style={styles.sectionDescription}>
            Anything your coach should know — injuries, preferences, goals, etc.
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
      </ScrollView>

      {isUpdating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      )}
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
    coachScroll: {
      marginHorizontal: -20,
    },
    horizontalScrollContent: {
      paddingHorizontal: 20,
      gap: 12,
    },
    coachCard: {
      width: 160,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 24,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    coachCardSelected: {
      borderColor: colors.brandPrimary,
      backgroundColor: colors.bg,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 12,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.border,
    },
    emojiBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    emojiText: {
      fontSize: 14,
    },
    coachName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    coachDescription: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 16,
    },
    selectedBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: colors.brandPrimary,
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  })
