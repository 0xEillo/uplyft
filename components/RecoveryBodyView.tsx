import { BodyHighlighterDual } from '@/components/BodyHighlighterDual'
import {
  getRecoveryGradientColors,
  getRecoveryIntensityFromPercentage,
  useRecoveryData,
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
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Get the gradient colors for the body highlighter (10 steps)
const RECOVERY_COLORS = getRecoveryGradientColors()

export function RecoveryBodyView() {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const {
    profile,
    muscleRecoveryData,
    recoveryOverview,
    isLoading,
    refreshing,
    onRefresh,
  } = useRecoveryData()

  // Generate body data for highlighting with gradient-based intensity
  const bodyData = useMemo(() => {
    const data: {
      slug: BodyPartSlug
      intensity: number
      side?: 'left' | 'right'
    }[] = []

    // Iterate over ALL supported body part slugs to ensure the whole body is colored
    ALL_BODY_PART_SLUGS.forEach((slug) => {
      // Skip non-muscular/non-target parts for a cleaner aesthetic
      if (['head', 'hands', 'feet', 'hair', 'ankles', 'neck'].includes(slug)) return
      
      const dbMuscleName = BODY_PART_TO_DATABASE_MUSCLE[slug]
      const recoveryData = dbMuscleName ? muscleRecoveryData.get(dbMuscleName) : null
      
      // Default to 100% recovered (intensity 6) for all muscles
      let intensity = 6
      
      if (recoveryData && recoveryData.recoveryStatus !== 'untrained') {
        // Use percentage-based intensity for gradient coloring
        intensity = getRecoveryIntensityFromPercentage(recoveryData.recoveryPercentage)
      }
      
      data.push({
        slug: slug,
        intensity,
      })
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
              colors={RECOVERY_COLORS}
              onBodyPartPress={handleBodyPartPress}
            />

            {/* Recovery Gradient Legend */}
            <View style={styles.gradientLegendContainer}>
              <LinearGradient
                colors={['#EF4444', '#F59E0B', '#546073']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBar}
              />
              <View style={styles.gradientLabels}>
                <Text style={styles.gradientLabelText}>Not Recovered</Text>
                <Text style={styles.gradientLabelText}>Recovering</Text>
                <Text style={styles.gradientLabelText}>Recovered</Text>
              </View>
            </View>

            {/* Recovery Stats Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {formatDaysSince(recoveryOverview.daysSinceLastWorkout)}
                </Text>
                <Text style={styles.summaryLabel}>DAYS SINCE LAST WORKOUT</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {recoveryOverview.totalMuscleGroups > 0
                    ? recoveryOverview.freshMuscleGroups
                    : '—'}
                </Text>
                <Text style={styles.summaryLabel}>FRESH MUSCLE GROUPS</Text>
              </View>
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
      marginTop: 20,
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

    // Summary Card
    summaryCard: {
      marginTop: 24,
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    summaryDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border,
      marginHorizontal: 12,
    },
  })
