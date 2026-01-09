import {
  getRecoveryColor,
  getRecoveryIntensity,
  getRecoveryLabel,
  useRecoveryData,
  type RecoveryStatus,
  type WorkoutIntensity,
} from '@/hooks/useRecoveryData'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  BODY_PART_DISPLAY_NAMES,
  BODY_PART_TO_DATABASE_MUSCLE,
  type BodyPartSlug,
} from '@/lib/body-mapping'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Body from 'react-native-body-highlighter'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RecoveryDetailSheet } from './RecoveryDetailSheet'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// Custom colors for the body highlighter based on recovery status
// Note: library maps intensity 1 to index 0, intensity 2 to index 1, etc.
// Indices: 0=Not Recovered (intensity 1), 1=Recovering (intensity 2)
const RECOVERY_COLORS = [
  '#EF4444', // Not Recovered (Red) - Intensity 1 maps to colors[0]
  '#F59E0B', // Recovering (Amber) - Intensity 2 maps to colors[1]
  '#10B981', // Fully Recovered (Green) - Intensity 3 maps to colors[2] (not used)
]

export function RecoveryBodyView() {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const {
    profile,
    muscleRecoveryData,
    recoveryOverview,
    isLoading,
    refreshing,
    onRefresh,
    getRecoveryForBodyPart,
  } = useRecoveryData()

  const [bodySide, setBodySide] = useState<'front' | 'back'>('front')
  const [selectedMuscle, setSelectedMuscle] = useState<{
    muscleGroup: string
    displayName: string
    recoveryStatus: RecoveryStatus
    hoursSinceLastWorkout: number | null
    lastWorkedDate: Date | null
    intensity: WorkoutIntensity | null
    recoveryTimeHours: number | null
  } | null>(null)

  // Generate body data for highlighting
  const bodyData = useMemo(() => {
    const data: Array<{
      slug: BodyPartSlug
      intensity: number
      side?: 'left' | 'right'
    }> = []

    // Iterate over all supported body part slugs
    Object.entries(BODY_PART_TO_DATABASE_MUSCLE).forEach(([slug, dbMuscleName]) => {
      const recoveryData = muscleRecoveryData.get(dbMuscleName)
      // Only add muscles that are still recovering (not 'untrained' or 'recovered')
      if (recoveryData && 
          recoveryData.recoveryStatus !== 'untrained' && 
          recoveryData.recoveryStatus !== 'recovered') {
        const intensity = getRecoveryIntensity(recoveryData.recoveryStatus)
        data.push({
          slug: slug as BodyPartSlug,
          intensity,
        })
      }
    })

    return data
  }, [muscleRecoveryData])

  // Handle body part press
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

      setSelectedMuscle({
        muscleGroup: dbMuscleName,
        displayName,
        recoveryStatus: recoveryData?.recoveryStatus || 'untrained',
        hoursSinceLastWorkout: recoveryData?.hoursSinceLastWorkout || null,
        lastWorkedDate: recoveryData?.lastWorkedDate || null,
        intensity: recoveryData?.intensity || null,
        recoveryTimeHours: recoveryData?.recoveryTimeHours || null,
      })
    },
    [muscleRecoveryData]
  )

  const styles = createStyles(colors)

  // Determine gender for body display
  const bodyGender = profile?.gender === 'female' ? 'female' : 'male'

  // Calculate scale to fit the body nicely
  const bodyScale = Math.min(SCREEN_WIDTH / 190, 1.35)

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
          <ActivityIndicator size="large" color={colors.primary} />
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
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatDaysSince(recoveryOverview.daysSinceLastWorkout)}
              </Text>
              <Text style={styles.statLabel}>DAYS SINCE YOUR{'\n'}LAST WORKOUT</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {recoveryOverview.totalMuscleGroups > 0
                  ? recoveryOverview.freshMuscleGroups
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>FRESH MUSCLE{'\n'}GROUPS</Text>
            </View>
          </View>

          {/* Body Section */}
          <View style={styles.bodySection}>
            {/* Swipeable Body Highlighter */}
            <View style={styles.swipeContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const contentOffset = e.nativeEvent.contentOffset.x
                  const viewSize = e.nativeEvent.layoutMeasurement.width
                  const pageNum = Math.floor(contentOffset / viewSize)
                  setBodySide(pageNum === 0 ? 'front' : 'back')
                }}
              >
                {/* Front View */}
                <View style={styles.bodyWrapper}>
                  <Body
                    data={bodyData}
                    gender={bodyGender}
                    side="front"
                    scale={bodyScale}
                    colors={RECOVERY_COLORS}
                    onBodyPartPress={handleBodyPartPress}
                    border={colors.border}
                  />
                </View>

                {/* Back View */}
                <View style={styles.bodyWrapper}>
                  <Body
                    data={bodyData}
                    gender={bodyGender}
                    side="back"
                    scale={bodyScale}
                    colors={RECOVERY_COLORS}
                    onBodyPartPress={handleBodyPartPress}
                    border={colors.border}
                  />
                </View>
              </ScrollView>

              {/* Page Indicators */}
              <View style={styles.pageIndicators}>
                <View style={[styles.dot, bodySide === 'front' && styles.dotActive]} />
                <View style={[styles.dot, bodySide === 'back' && styles.dotActive]} />
              </View>
            </View>

            {/* Recovery Legend */}
            <View style={styles.integratedLegend}>
              <View style={styles.legendGrid}>
                {(
                  [
                    'not_recovered',
                    'recovering',
                  ] as RecoveryStatus[]
                ).map((status) => (
                  <View key={status} style={styles.legendItemCompact}>
                    <View
                      style={[
                        styles.legendDotSmall,
                        { backgroundColor: getRecoveryColor(status) },
                      ]}
                    />
                    <Text style={styles.legendTextCompact}>
                      {getRecoveryLabel(status)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Recovery Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>How Muscle Recovery Works</Text>
              <View style={styles.infoRow}>
                <View style={[styles.infoIndicator, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Not Recovered</Text> — Needs more rest, avoid training
                </Text>
              </View>
              <View style={styles.infoRow}>
                <View style={[styles.infoIndicator, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Recovering</Text> — Getting there, light training OK
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Detail Sheet */}
      <RecoveryDetailSheet
        isVisible={!!selectedMuscle}
        onClose={() => setSelectedMuscle(null)}
        muscleGroup={selectedMuscle?.displayName || ''}
        recoveryStatus={selectedMuscle?.recoveryStatus || 'untrained'}
        hoursSinceLastWorkout={selectedMuscle?.hoursSinceLastWorkout || null}
        lastWorkedDate={selectedMuscle?.lastWorkedDate || null}
        intensity={selectedMuscle?.intensity || null}
        recoveryTimeHours={selectedMuscle?.recoveryTimeHours || null}
      />
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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

    // Stats Row
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      letterSpacing: 0.5,
    },

    // Body Section
    bodySection: {
      flex: 1,
      paddingHorizontal: 14,
    },

    // Swipe Section
    swipeContainer: {
      height: 500,
      width: SCREEN_WIDTH - 28,
      alignItems: 'center',
    },
    bodyWrapper: {
      width: SCREEN_WIDTH - 28,
      height: 500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageIndicators: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textPlaceholder,
      opacity: 0.3,
    },
    dotActive: {
      backgroundColor: colors.primary,
      opacity: 1,
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    // Legend
    integratedLegend: {
      marginTop: 16,
      paddingHorizontal: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    legendGrid: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 16,
    },
    legendItemCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDotSmall: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendTextCompact: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },

    // Info Card
    infoCard: {
      marginTop: 24,
      backgroundColor: colors.feedCardBackground,
      borderRadius: 16,
      padding: 16,
    },
    infoCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 10,
    },
    infoIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    infoText: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
    },
    infoBold: {
      fontWeight: '700',
      color: colors.text,
    },
    infoNote: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 8,
    },
  })
