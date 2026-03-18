/**
 * Native Bottom Sheet for Muscle Group Detail (Strength)
 * 
 * This screen is presented as a native formSheet using Expo Router.
 * It shows exercise details and strength standards for a specific muscle group.
 */

import { EmptyState } from '@/components/EmptyState'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { SlideUpView } from '@/components/slide-up-view'
import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useTheme } from '@/contexts/theme-context'
import { type MuscleGroupData } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { BODY_PART_TO_DATABASE_MUSCLE, BodyPartSlug } from '@/lib/body-mapping'
import { getTrackableExercisesForMuscle } from '@/lib/exercise-standards-config'
import {
  getTrackableExercisesForDisplayGroup,
  isDisplayStrengthGroup,
} from '@/lib/strength-display-groups'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TIER_ONE_ICON_COLOR = '#8E8E93'

export default function MuscleGroupDetailScreen() {
  const router = useRouter()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [shouldExit, setShouldExit] = useState(false)
  const isIOSFormSheet = Platform.OS === 'ios'

  const params = useLocalSearchParams<{
    groupDisplayName: string
    bodyPartSlug: string
    groupDataJson: string
  }>()

  const groupDisplayName = params.groupDisplayName || ''
  const bodyPartSlug = (params.bodyPartSlug || null) as BodyPartSlug | null
  const groupData = useMemo<MuscleGroupData | null>(() => {
    if (!params.groupDataJson) return null
    try {
      return JSON.parse(params.groupDataJson) as MuscleGroupData
    } catch (error) {
      console.warn(
        '[muscle-group-detail] Failed to parse groupDataJson:',
        error,
      )
      return null
    }
  }, [params.groupDataJson])

  const filteredExercises = useMemo(() => {
    if (!groupData) return []
    // The payload already contains exercises for the selected display group.
    // Avoid re-filtering on the raw database muscle value because it can differ
    // from the canonical display group mapping.
    return groupData.exercises
  }, [groupData])

  const allMuscleExercises = useMemo(() => {
    if (!bodyPartSlug) return []
    const dbMuscle = BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug]
    if (!dbMuscle) return []

    const trackableConfigs =
      groupData?.name && isDisplayStrengthGroup(groupData.name)
        ? getTrackableExercisesForDisplayGroup(groupData.name)
        : getTrackableExercisesForMuscle(dbMuscle)

    return trackableConfigs
      .map((config) => {
        const userExercise = filteredExercises.find(
          (ex) => ex.exerciseName === config.name,
        )

        return {
          exerciseId: userExercise?.exerciseId || config.id,
          exerciseName: config.name,
          gifUrl: userExercise?.gifUrl || config.gifUrl || null,
          isDone: !!userExercise,
          isTierOne: config.tier === 1,
        }
      })
      .sort((a, b) => {
        if (a.isTierOne && !b.isTierOne) return -1
        if (!a.isTierOne && b.isTierOne) return 1
        if (a.isDone && !b.isDone) return -1
        if (!a.isDone && b.isDone) return 1
        return a.exerciseName.localeCompare(b.exerciseName)
      })
  }, [bodyPartSlug, filteredExercises, groupData?.name])

  const navigateToExercise = (exerciseId: string) => {
    if (!exerciseId) return

    if (!isIOSFormSheet) {
      setShouldExit(true)
    }

    router.back()
    setTimeout(() => {
      router.push({
        pathname: '/exercise/[exerciseId]',
        params: { exerciseId },
      })
    }, isIOSFormSheet ? 220 : 100)
  }

  const styles = createStyles(colors)

  const closeSheet = () => {
    if (isIOSFormSheet) {
      router.back()
      return
    }
    setShouldExit(true)
  }
  const handleExitComplete = () => router.back()

  const listContent =
    allMuscleExercises.length === 0 ? (
      <EmptyState
        icon="body-outline"
        title="No exercises available"
        description={`We don't have any tracked exercises for ${groupDisplayName} yet.`}
      />
    ) : (
      <>
        {allMuscleExercises.map((exercise, index) => (
          <TouchableOpacity
            key={exercise.exerciseName}
            style={[
               styles.exerciseCard,
               !isDark && exercise.isDone && { borderColor: colors.border },
               !exercise.isDone && styles.untrackedCard,
               index === allMuscleExercises.length - 1 && styles.lastExerciseCard,
            ]}
            onPress={() =>
              exercise.exerciseId && navigateToExercise(exercise.exerciseId)
            }
            activeOpacity={0.7}
            disabled={!exercise.exerciseId}
          >
            <View style={styles.exerciseLeft}>
              <View style={styles.thumbnailContainer}>
                <ExerciseMediaThumbnail
                  gifUrl={exercise.gifUrl}
                  style={StyleSheet.flatten([
                    styles.exerciseThumbnail,
                    !exercise.isDone && styles.untrackedThumbnail,
                  ]) as ViewStyle}
                />
              </View>
              <View style={styles.exerciseInfo}>
                <View style={styles.exerciseNameRow}>
                  <Text
                    style={[
                      styles.exerciseName,
                      !exercise.isDone && styles.untrackedText,
                    ]}
                    numberOfLines={1}
                  >
                    {exercise.exerciseName}
                  </Text>
                  {exercise.isTierOne && (
                    <Ionicons
                      name="trophy"
                      size={12}
                      color={exercise.isDone ? colors.textPrimary : TIER_ONE_ICON_COLOR}
                      style={{ opacity: exercise.isDone ? 0.8 : 0.4 }}
                    />
                  )}
                </View>
              </View>
            </View>

             <View style={styles.exerciseRight}>
               {exercise.isDone && (
                 <Ionicons
                   name="checkmark-circle"
                   size={18}
                   color={colors.statusSuccess}
                   style={{ opacity: 0.8 }}
                 />
               )}
             </View>
          </TouchableOpacity>
        ))}

      </>
    )

  if (isIOSFormSheet) {
    return (
      <View collapsable={false} style={styles.formSheetContainer}>
        <LiquidGlassSurface style={StyleSheet.absoluteFill} />
        <View collapsable={false} style={styles.formSheetHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{groupDisplayName}</Text>
            <View style={styles.tierExplainer}>
              <Ionicons name="trophy" size={14} color={TIER_ONE_ICON_COLOR} />
              <Text style={styles.tierExplainerText}>
                Tier 1 lifts award the most strength points
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.formSheetScroll}
          contentContainerStyle={[
            styles.formSheetScrollContent,
            {
              paddingBottom:
                insets.bottom + NATIVE_SHEET_LAYOUT.bottomSafeAreaPadding,
            },
          ]}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          {!groupData ? (
            <EmptyState
              icon="body-outline"
              title="No data available"
              description="Could not load muscle group information."
            />
          ) : (
            listContent
          )}
        </ScrollView>
      </View>
    )
  }

  const content = !groupData ? (
    <EmptyState
      icon="body-outline"
      title="No data available"
      description="Could not load muscle group information."
    />
  ) : (
    <View style={styles.contentContainer}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{groupDisplayName}</Text>
          <View style={styles.tierExplainer}>
            <Ionicons name="trophy" size={14} color={TIER_ONE_ICON_COLOR} />
            <Text style={styles.tierExplainerText}>
              Tier 1 lifts award the most strength points
            </Text>
          </View>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {listContent}
      </ScrollView>
    </View>
  )

  return (
    <View style={styles.backdrop}>
      <TouchableOpacity
        style={styles.backdropPress}
        activeOpacity={1}
        onPress={closeSheet}
      />
      <SlideUpView
        style={styles.sheetWrapper}
        backgroundColor="transparent"
        shouldExit={shouldExit}
        onExitComplete={handleExitComplete}
        duration={260}
        tension={50}
        friction={8}
      >
        <View style={[styles.sheetContainer, { paddingBottom: insets.bottom }]}>
          {content}
        </View>
      </SlideUpView>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    backdropPress: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    sheetWrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    sheetContainer: {
      flex: 1,
      backgroundColor: colors.surfaceSheet,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    formSheetContainer: {
      flex: 1,
      paddingHorizontal: NATIVE_SHEET_LAYOUT.horizontalPadding,
      paddingTop: NATIVE_SHEET_LAYOUT.topPadding,
    },
    header: {
      marginBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 12,
    },
    formSheetHeader: {
      marginBottom: NATIVE_SHEET_LAYOUT.headerBottomSpacing,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      gap: 12,
    },
    formSheetScroll: {
      flex: 1,
    },
    formSheetScrollContent: {
      paddingBottom: NATIVE_SHEET_LAYOUT.contentBottomSpacing,
    },
    contentContainer: {
      flex: 1,
      padding: NATIVE_SHEET_LAYOUT.horizontalPadding,
      paddingTop: NATIVE_SHEET_LAYOUT.topPadding,
    },
    headerCopy: {
      flex: 1,
      gap: 8,
    },
    title: {
      fontSize: NATIVE_SHEET_LAYOUT.titleFontSize,
      fontWeight: '700',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    tierExplainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tierExplainerText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      lineHeight: 16,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    exerciseCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    lastExerciseCard: {
      marginBottom: 0,
    },
    exerciseLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    exerciseThumbnail: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#f0f0f0',
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
      letterSpacing: -0.2,
    },
    exerciseRight: {
      minWidth: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
     untrackedCard: {
      backgroundColor: 'transparent',
      borderColor: colors.border + '35',
      elevation: 0,
      shadowOpacity: 0,
    },
    thumbnailContainer: {
      position: 'relative',
    },
    untrackedThumbnail: {
      opacity: 0.35,
    },
    untrackedText: {
      color: colors.textTertiary,
    },
  })
