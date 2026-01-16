import { BodyHighlighterDual } from '@/components/BodyHighlighterDual'
import { LevelBadge } from '@/components/LevelBadge'
import { LifterLevelsSheet } from '@/components/LifterLevelsSheet'
import {
    getLevelColor,
    getLevelIntensity,
    useStrengthData,
    type MuscleGroupData
} from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
    BODY_PART_DISPLAY_NAMES,
    BODY_PART_TO_DATABASE_MUSCLE,
    type BodyPartSlug
} from '@/lib/body-mapping'
import { type StrengthLevel } from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
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

// Custom colors for the body highlighter based on strength levels
// Custom colors for the body highlighter based on strength levels
// Indices: 0=Beginner, 1=Novice, 2=Intermediate, 3=Advanced, 4=Elite, 5=World Class
// Note: library maps intensity 1 to index 0, intensity 2 to index 1, etc.
const BODY_COLORS = [
  '#9CA3AF', // Beginner (Intensity 1)
  '#3B82F6', // Novice (Intensity 2)
  '#10B981', // Intermediate (Intensity 3)
  '#8B5CF6', // Advanced (Intensity 4)
  '#F59E0B', // Elite (Intensity 5)
  '#EF4444', // World Class (Intensity 6)
]



export function StrengthBodyView() {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const {
    profile,
    isLoading,
    refreshing,
    onRefresh,
    overallLevel,
    muscleGroups,
  } = useStrengthData()

  const [showLevelsSheet, setShowLevelsSheet] = useState(false)

  // Generate body data for highlighting
  const bodyData = useMemo(() => {
    const data: {
      slug: BodyPartSlug
      intensity: number
      side?: 'left' | 'right'
    }[] = []

    // Map database muscle names to their data for easy lookup
    const muscleMap = new Map<string, MuscleGroupData>()
    muscleGroups.forEach((mg) => muscleMap.set(mg.name, mg))

    // Iterate over all supported body part slugs
    Object.entries(BODY_PART_TO_DATABASE_MUSCLE).forEach(([slug, dbMuscleName]) => {
      const mgData = muscleMap.get(dbMuscleName)
      if (mgData) {
        data.push({
          slug: slug as BodyPartSlug,
          intensity: getLevelIntensity(mgData.level),
        })
      }
    })

    return data
  }, [muscleGroups])

  // Handle body part press - navigate to native formSheet
  const handleBodyPartPress = useCallback(
    (bodyPart: { slug?: string }, _side?: 'left' | 'right') => {
      if (!bodyPart.slug) return
      
      const slug = bodyPart.slug as BodyPartSlug
      const dbMuscleName = BODY_PART_TO_DATABASE_MUSCLE[slug]

      if (!dbMuscleName) {
        return
      }

      const mgData = muscleGroups.find((mg) => mg.name === dbMuscleName)
      const displayName = BODY_PART_DISPLAY_NAMES[slug] || slug

      // Build group data (with fallback for empty state)
      const groupData: MuscleGroupData = mgData || {
        name: dbMuscleName,
        level: 'Beginner',
        progress: 0,
        averageScore: 0,
        exercises: [],
      }

      // Navigate to native formSheet with params
      router.push({
        pathname: '/muscle-group-detail',
        params: {
          groupDisplayName: displayName,
          bodyPartSlug: slug,
          groupDataJson: JSON.stringify(groupData),
        },
      })
    },
    [muscleGroups, router],
  )

  const styles = createStyles(colors)

  // Determine gender for body display
  const bodyGender = profile?.gender === 'female' ? 'female' : 'male'

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading strength data...</Text>
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

          {/* Body Section */}
          <View style={styles.bodySection}>

            {/* Side-by-Side Body Highlighter */}
            <BodyHighlighterDual
              bodyData={bodyData}
              gender={bodyGender}
              colors={BODY_COLORS}
              onBodyPartPress={handleBodyPartPress}
            />

            {/* Integrated Legend Key - Directly under the chart */}
            <View style={styles.integratedLegend}>
              <View style={styles.legendGrid}>
                {(['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'World Class'] as StrengthLevel[]).map(
                  (level) => (
                    <LevelBadge 
                      key={level}
                      level={level}
                      variant="pill"
                      size="small"
                    />
                  ),
                )}
              </View>
            </View>

            {/* Overall Level Card */}
            {overallLevel && (
              <TouchableOpacity
                style={styles.levelCard}
                activeOpacity={0.9}
                onPress={() => setShowLevelsSheet(true)}
              >
                <View style={styles.levelCardContent}>
                  <View style={styles.levelCardLeft}>
                    <Text style={styles.levelCardLabel}>Lifter Level</Text>
                    <Text style={styles.levelCardValue}>
                      {overallLevel.balancedLevel}
                    </Text>
                    {overallLevel.balancedNextLevel ? (
                      <Text style={styles.levelCardProgress}>
                        {Math.round(overallLevel.balancedProgress)}% to{' '}
                        {overallLevel.balancedNextLevel}
                      </Text>
                    ) : (
                      <Text style={styles.levelCardProgress}>Max Level Reached</Text>
                    )}
                  </View>
                  <LevelBadge
                    level={overallLevel.balancedLevel}
                    size="large"
                    showTooltipOnPress={false}
                  />
                </View>

                {/* Progress Bar */}
                {overallLevel.balancedNextLevel && (
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${overallLevel.balancedProgress}%`,
                            backgroundColor: getLevelColor(overallLevel.balancedLevel),
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}

                {/* Weak Point Warning */}
                {overallLevel.weakestGroup && (
                  <View style={styles.weakPointContainer}>
                    <Ionicons name="warning" size={14} color={colors.warning} />
                    <Text style={styles.weakPointText}>
                      Focus on {overallLevel.weakestGroup}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Lifter Levels Sheet - keeping as modal since it's a full-screen carousel */}
      {overallLevel && (
        <LifterLevelsSheet
          isVisible={showLevelsSheet}
          onClose={() => setShowLevelsSheet(false)}
          currentLevel={overallLevel.balancedLevel}
          progressToNext={overallLevel.balancedProgress}
        />
      )}
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

    // Level Card
    levelCard: {
      marginTop: 24,
      backgroundColor: colors.feedCardBackground,
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
      color: colors.text,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    levelCardProgress: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
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
    weakPointContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    weakPointText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.warning,
    },

    // Body Section
    bodySection: {
      flex: 1,
      paddingHorizontal: 14,
      marginTop: 24,
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
      gap: 12,
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
  })
