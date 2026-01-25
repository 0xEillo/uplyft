import { BodyHighlighterDual } from '@/components/BodyHighlighterDual'
import { useTheme } from '@/contexts/theme-context'
import {
    getRecoveryColorFromPercentage,
    getRecoveryGradientColors,
    getRecoveryIntensityFromPercentage,
    useRecoveryData
} from '@/hooks/useRecoveryData'
import { useThemedColors } from '@/hooks/useThemedColors'

import {
    ALL_BODY_PART_SLUGS,
    BODY_PART_DISPLAY_NAMES,
    BODY_PART_TO_DATABASE_MUSCLE,
    type BodyPartSlug,
} from '@/lib/body-mapping'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'


// Get the base gradient colors for the body highlighter
const BASE_RECOVERY_COLORS = getRecoveryGradientColors()
const READY_GREEN = '#10B981' // Green for Ready to Train chips

export function RecoveryBodyView() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  
  // Match the exact body baseline color from BodyHighlighterDual
  // Unified with StrengthBodyView:
  // Dark: #2A2A2A
  // Light: #4A4A4A
  const bodyBaseColor = isDark ? '#2A2A2A' : '#4A4A4A'
  
  // Create theme-aware recovery colors
  // Index 0: Base Body Color (for Unranked/Intensity 1)
  // Index 1-6: Recovery Gradient Colors (for Intensity 2-7)
  const recoveryColors = useMemo(() => {
    // We keep the last color (recovered) as is from the gradient
    return [bodyBaseColor, ...BASE_RECOVERY_COLORS]
  }, [bodyBaseColor])
  
  const {
    profile,
    muscleRecoveryData,
    recoveryOverview,
    isLoading,
    refreshing,
    onRefresh,
  } = useRecoveryData()


  // Generate body data for highlighting with gradient-based intensity
  // Only include muscles that are RECOVERING - recovered muscles stay as SVG default (like Strength page)
  const bodyData = useMemo(() => {
    const data: {
      slug: BodyPartSlug
      intensity: number
      side?: 'left' | 'right'
    }[] = []

    // Iterate over supported body part slugs
    ALL_BODY_PART_SLUGS.forEach((slug) => {
      // Skip non-muscular/non-target parts for a cleaner aesthetic
      if (['head', 'hands', 'feet', 'hair', 'ankles', 'neck'].includes(slug)) return
      
      const dbMuscleName = BODY_PART_TO_DATABASE_MUSCLE[slug]
      const recoveryData = dbMuscleName ? muscleRecoveryData.get(dbMuscleName) : null
      
      // Only add muscles that are still recovering (not at 100%)
      // Recovered/untrained muscles are left out so they use the SVG's natural base color
      if (recoveryData && recoveryData.recoveryStatus !== 'untrained' && recoveryData.recoveryPercentage < 100) {
        const intensity = getRecoveryIntensityFromPercentage(recoveryData.recoveryPercentage)
        data.push({
          slug: slug,
          intensity,
        })
      }
    })

    return data
  }, [muscleRecoveryData])


  // Handle body part press - navigate to native formSheet
  const handleBodyPartPress = useCallback(
    (bodyPart: { slug?: string }, _side?: 'left' | 'right') => {
      if (!bodyPart.slug) return

      const slug = bodyPart.slug as BodyPartSlug
      const dbMuscleName = BODY_PART_TO_DATABASE_MUSCLE[slug]

      if (!dbMuscleName) {
        return
      }

      const recoveryData = muscleRecoveryData.get(dbMuscleName)
      const displayName = BODY_PART_DISPLAY_NAMES[slug] || slug

      // Navigate to native formSheet with params
      router.push({
        pathname: '/recovery-detail',
        params: {
          muscleGroup: displayName,
          recoveryStatus: recoveryData?.recoveryStatus || 'untrained',
          recoveryPercentage: recoveryData?.recoveryPercentage?.toString() || '100',
          hoursSinceLastWorkout: recoveryData?.hoursSinceLastWorkout?.toString() || '',
          lastWorkedDate: recoveryData?.lastWorkedDate?.toISOString() || '',
          intensity: recoveryData?.intensity || '',
          recoveryTimeHours: recoveryData?.recoveryTimeHours?.toString() || '',
        },
      })
    },
    [muscleRecoveryData, router]
  )

  const styles = createStyles(colors)

  // Determine gender for body display
  const bodyGender = profile?.gender === 'female' ? 'female' : 'male'


  // Format days since last workout
  const formatDaysSince = (days: number | null) => {
    if (days === null) return '—'
    if (days === 0) return '0'
    if (days === 1) return '1'
    return `${days}`
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>Loading recovery data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: 100 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.brandPrimary]}
              tintColor={colors.brandPrimary}
            />
          }
        >


          {/* Body Section */}
          <View style={styles.bodySection}>
            {/* Side-by-Side Body Highlighter */}
            <BodyHighlighterDual
              bodyData={bodyData}
              gender={bodyGender}
              colors={recoveryColors}

              onBodyPartPress={handleBodyPartPress}
            />

            {/* Recovery Gradient Legend */}
            <View style={styles.gradientLegendContainer}>
              <LinearGradient
                colors={['#991B1B', '#DC2626', '#F97316', '#FB923C', '#FDBA74']}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBar}
              />
              <View style={styles.gradientLabels}>
                <Text style={styles.gradientLabelText}>Not Recovered</Text>
                <Text style={styles.gradientLabelText}>Recovering</Text>
              </View>
            </View>

          {/* Recovery Zone Card */}
          <View style={styles.levelCard}>
            {/* Still Recovering Section */}
            {Array.from(muscleRecoveryData.values()).filter(m => m.recoveryPercentage < 100).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Still Recovering</Text>
                <View style={styles.chipsContainer}>
                  {Array.from(muscleRecoveryData.values())
                    .filter(m => m.recoveryPercentage < 100)
                    .sort((a, b) => a.recoveryPercentage - b.recoveryPercentage)
                    .map((m) => {
                      const recoveryColor = getRecoveryColorFromPercentage(m.recoveryPercentage)
                      const hoursLeft = Math.max(
                        0,
                        (m.recoveryTimeHours || 0) - (m.hoursSinceLastWorkout || 0),
                      )
                      const days = Math.floor(hoursLeft / 24)
                      const hours = Math.ceil(hoursLeft % 24)
                      const timeLeftStr = days > 0 ? ` • ${days}d ${hours}h` : ` • ${hours}h`

                      return (
                        <TouchableOpacity
                          key={m.muscleGroup}
                          style={[
                            styles.unifiedChip,
                            {
                              borderColor: recoveryColor,
                              backgroundColor: recoveryColor + '12',
                            },
                          ]}
                          onPress={() => {
                            const entries = Object.entries(BODY_PART_TO_DATABASE_MUSCLE)
                            const entry = entries.find(
                              ([_, val]) => val === m.muscleGroup,
                            )
                            if (entry) handleBodyPartPress({ slug: entry[0] })
                          }}
                        >
                          <Text style={[styles.unifiedChipText, { color: recoveryColor }]}>
                            {m.muscleGroup}{timeLeftStr}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                </View>
              </>
            )}

            {/* Ready to Train Section */}
            {Array.from(muscleRecoveryData.values()).filter(m => m.recoveryPercentage >= 100).length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Ready to Train</Text>
                <View style={styles.chipsContainer}>
                  {Array.from(muscleRecoveryData.values())
                    .filter(m => m.recoveryPercentage >= 100)
                    .map((m) => (
                      <TouchableOpacity
                        key={m.muscleGroup}
                        style={[
                          styles.unifiedChip,
                          {
                            borderColor: READY_GREEN,
                            backgroundColor: READY_GREEN + '15',
                          },
                        ]}
                        onPress={() => {
                          const entries = Object.entries(BODY_PART_TO_DATABASE_MUSCLE)
                          const entry = entries.find(
                            ([_, val]) => val === m.muscleGroup,
                          )
                          if (entry) handleBodyPartPress({ slug: entry[0] })
                        }}
                      >
                        <Text style={[styles.unifiedChipText, { color: READY_GREEN }]}>
                          {m.muscleGroup}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </>
            )}
          </View>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: colors.textSecondary,
    },



    // Body Section
    bodySection: {
      flex: 1,
      paddingHorizontal: 14,
      marginTop: 24,
    },

    // Gradient Legend
    gradientLegendContainer: {
      marginTop: 8,
      alignItems: 'center',
    },
    gradientBar: {
      width: '100%',
      height: 8,
      borderRadius: 4,
    },
    gradientLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: 8,
    },
    gradientLabelText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    // Level Card (matches strength section)
    levelCard: {
      marginTop: 16,
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    levelCardContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    levelCardLeft: {
      flex: 1,
    },
    levelCardLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    levelCardValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    levelCardProgress: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    statusBadgeWrapper: {
      marginLeft: 16,
    },
    progressBarContainer: {
      marginTop: 16,
    },
    progressBarBackground: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
      letterSpacing: 0.2,
    },
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    unifiedChip: {
      borderWidth: 1,
      borderRadius: 100,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    unifiedChipText: {
      fontSize: 11,
      fontWeight: '600',
    },
  })
