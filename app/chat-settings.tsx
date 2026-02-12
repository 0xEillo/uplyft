import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { COACH_OPTIONS, CoachId } from '@/lib/coaches'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { Gender } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
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

const getLocalDateString = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const SHEET_SPACING = {
  top: 32,
  section: 28,
  sectionInner: 12,
} as const

export default function ChatSettingsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoadingGoal, setIsLoadingGoal] = useState(true)
  const [calorieInput, setCalorieInput] = useState('')
  const [currentCalorieGoal, setCurrentCalorieGoal] = useState<number | null>(
    null,
  )

  const hasProfileStats = useMemo(
    () =>
      Boolean(
        profile?.weight_kg && profile?.height_cm && profile?.age && profile?.gender,
      ),
    [profile?.weight_kg, profile?.height_cm, profile?.age, profile?.gender],
  )

  const calculateTDEE = (
    weight: number,
    height: number,
    age: number,
    gender: Gender | null,
  ) => {
    let bmr = 10 * weight + 6.25 * height - 5 * age
    bmr += gender === 'male' ? 5 : -161
    return Math.round(bmr * 1.375)
  }

  const recommendations = useMemo(() => {
    if (
      !hasProfileStats ||
      !profile?.weight_kg ||
      !profile?.height_cm ||
      !profile?.age ||
      !profile?.gender
    ) {
      return null
    }
    const tdee = calculateTDEE(
      profile.weight_kg,
      profile.height_cm,
      profile.age,
      profile.gender,
    )
    return [
      { label: 'Aggressive Cut', calories: Math.round(tdee * 0.75), color: '#ef4444' },
      { label: 'Cut', calories: Math.round(tdee * 0.85), color: '#f97316' },
      { label: 'Maintenance', calories: tdee, color: '#3b82f6' },
      { label: 'Bulk', calories: Math.round(tdee * 1.1), color: '#10b981' },
    ]
  }, [hasProfileStats, profile?.age, profile?.gender, profile?.height_cm, profile?.weight_kg])

  useEffect(() => {
    const loadCurrentGoal = async () => {
      if (!user?.id) {
        setIsLoadingGoal(false)
        return
      }
      try {
        const summary = await database.dailyLog.getDaySummary(user.id, getLocalDateString())
        const goal = summary.goals.calorie_goal ?? null
        setCurrentCalorieGoal(goal)
        setCalorieInput(goal ? String(goal) : '')
      } catch {
        setCurrentCalorieGoal(null)
        setCalorieInput('')
      } finally {
        setIsLoadingGoal(false)
      }
    }

    loadCurrentGoal()
  }, [user?.id])

  const saveCalorieGoal = async (goal: number) => {
    if (!user?.id) return
    try {
      setIsUpdating(true)
      await database.dailyLog.updateDay(user.id, { calorieGoal: goal })
      setCurrentCalorieGoal(goal)
      setCalorieInput(String(goal))
      haptic('medium')
    } catch (error) {
      console.error('Error updating calorie goal:', error)
      Alert.alert('Error', 'Unable to update calorie goal.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveCalories = async () => {
    const parsedGoal = parseInt(calorieInput.replace(/[^0-9]/g, ''), 10)
    if (Number.isNaN(parsedGoal)) return
    await saveCalorieGoal(parsedGoal)
  }

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

  const handleNavigateToProfile = () => {
    router.back()
    setTimeout(() => {
      router.push('/(tabs)/profile')
    }, 250)
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
      <ScrollView
        style={styles.formSheetScroll}
        contentContainerStyle={styles.formSheetScrollContent}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {!hasProfileStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Physical Attributes</Text>
            <TouchableOpacity
              style={styles.missingStatsContainer}
              onPress={handleNavigateToProfile}
            >
              <View style={styles.missingStatsIconContainer}>
                <Ionicons name="body-outline" size={24} color={colors.brandPrimary} />
              </View>
              <View style={styles.missingStatsTextContainer}>
                <Text style={styles.missingStatsTitle}>Complete Profile</Text>
                <Text style={styles.missingStatsDescription}>
                  Add weight, height, and age to get personalized calorie goals.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition Targets</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Daily Calorie Goal</Text>
              <Text style={styles.settingDescription}>Your target for today</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={calorieInput}
                onChangeText={setCalorieInput}
                keyboardType="numeric"
                placeholder={currentCalorieGoal ? String(currentCalorieGoal) : '2000'}
                placeholderTextColor={colors.textTertiary}
                onBlur={handleSaveCalories}
                returnKeyType="done"
              />
              <Text style={styles.unitText}>kcal</Text>
            </View>
          </View>

          {recommendations && (
            <View style={styles.recommendationsGrid}>
              {recommendations.map((rec) => (
                <TouchableOpacity
                  key={rec.label}
                  style={styles.recommendationCard}
                  onPress={() => saveCalorieGoal(rec.calories)}
                >
                  <Text style={[styles.recommendationLabel, { color: rec.color }]}>
                    {rec.label}
                  </Text>
                  <Text style={styles.recommendationValue}>{rec.calories} kcal</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

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
      </ScrollView>

      {(isUpdating || isLoadingGoal) && (
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
      backgroundColor: colors.surfaceSheet,
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
    sectionSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 0,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED',
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(0,0,0,0.30)' : colors.bg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 104,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.14)' : colors.border,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'right',
      marginRight: 4,
    },
    unitText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    recommendationsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    recommendationCard: {
      width: '48%',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED',
      alignItems: 'center',
    },
    recommendationLabel: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 4,
      color: colors.textSecondary,
    },
    recommendationValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    missingStatsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      padding: 16,
      borderRadius: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED',
    },
    missingStatsIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(0,0,0,0.30)' : colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
    },
    missingStatsTextContainer: {
      flex: 1,
    },
    missingStatsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    missingStatsDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
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
