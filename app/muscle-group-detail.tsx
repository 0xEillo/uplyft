/**
 * Native Bottom Sheet for Muscle Group Detail (Strength)
 * 
 * This screen is presented as a native formSheet using Expo Router.
 * It shows exercise details and strength standards for a specific muscle group.
 */

import { EmptyState } from '@/components/EmptyState'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LevelBadge } from '@/components/LevelBadge'
import { SlideUpView } from '@/components/slide-up-view'
import { useProfile } from '@/contexts/profile-context'
import { useTheme } from '@/contexts/theme-context'
import { getLevelColor, type MuscleGroupData } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { BODY_PART_TO_DATABASE_MUSCLE, BodyPartSlug } from '@/lib/body-mapping'
import { getTrackableExercisesForMuscle } from '@/lib/exercise-standards-config'
import {
    getStrengthStandard,
    hasStrengthStandards
} from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function MuscleGroupDetailScreen() {
    const router = useRouter()
    const colors = useThemedColors()
    const { isDark } = useTheme()
    const insets = useSafeAreaInsets()
    const { formatWeight, weightUnit } = useWeightUnits()
    const { profile } = useProfile()
    const [shouldExit, setShouldExit] = useState(false)
    
    const params = useLocalSearchParams<{
        groupDisplayName: string
        bodyPartSlug: string
        groupDataJson: string
    }>()

    // Parse the group data from JSON params
    const groupDisplayName = params.groupDisplayName || ''
    const bodyPartSlug = (params.bodyPartSlug || null) as BodyPartSlug | null
    const groupData: MuscleGroupData | null = params.groupDataJson 
        ? JSON.parse(params.groupDataJson) 
        : null

    const filteredExercises = useMemo(() => {
        if (!groupData) return []
        if (!bodyPartSlug) return groupData.exercises

        const targetMuscle = BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug]
        if (!targetMuscle) return groupData.exercises

        return groupData.exercises.filter((exercise) => {
            return exercise.muscleGroup === targetMuscle
        })
    }, [groupData, bodyPartSlug])

    const allMuscleExercises = useMemo(() => {
        const getStrengthInfo = (exerciseName: string, max1RM: number) => {
            if (!profile?.gender || !profile?.weight_kg) {
                return null
            }

            if (!hasStrengthStandards(exerciseName)) {
                return null
            }

            return getStrengthStandard(
                exerciseName,
                profile.gender as 'male' | 'female',
                profile.weight_kg,
                max1RM,
            )
        }

        if (!bodyPartSlug) return []
        const dbMuscle = BODY_PART_TO_DATABASE_MUSCLE[bodyPartSlug]
        if (!dbMuscle) return []

        const trackableConfigs = getTrackableExercisesForMuscle(dbMuscle)

        return trackableConfigs.map(config => {
            const userExercise = filteredExercises.find(ex => ex.exerciseName === config.name)

            return {
                exerciseId: userExercise?.exerciseId || config.id,
                exerciseName: config.name,
                gifUrl: userExercise?.gifUrl || config.gifUrl || null,
                max1RM: userExercise?.max1RM || 0,
                isDone: !!userExercise,
                strengthInfo: userExercise ? getStrengthInfo(config.name, userExercise.max1RM) : null
            }
        }).sort((a, b) => {
            // Done first, then alphabetical
            if (a.isDone && !b.isDone) return -1
            if (!a.isDone && b.isDone) return 1
            return a.exerciseName.localeCompare(b.exerciseName)
        })
    }, [bodyPartSlug, filteredExercises, profile?.gender, profile?.weight_kg])

    const navigateToExercise = (exerciseId: string) => {
        setShouldExit(true)
        router.back()
        // Small delay to allow sheet to close before navigation
        setTimeout(() => {
            router.push({
                pathname: '/exercise/[exerciseId]',
                params: { exerciseId },
            })
        }, 100)
    }

    const styles = createStyles(colors)

    const closeSheet = () => setShouldExit(true)
    const handleExitComplete = () => router.back()

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
                    {!groupData ? (
                        <EmptyState
                            icon="body-outline"
                            title="No data available"
                            description="Could not load muscle group information."
                        />
                    ) : (
                        <View style={styles.contentContainer}>
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.title}>{groupDisplayName}</Text>
                                <LevelBadge 
                                    level={groupData.level} 
                                    size="medium" 
                                    variant="pill"
                                />
                            </View>

                            {/* Exercise List */}
                            <ScrollView
                                style={styles.scrollView}
                                contentContainerStyle={styles.scrollContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {allMuscleExercises.length === 0 ? (
                                    <EmptyState
                                        icon="body-outline"
                                        title="No exercises available"
                                        description={`We don't have any tracked exercises for ${groupDisplayName} yet.`}
                                    />
                                ) : (
                                    allMuscleExercises.map((exercise, index) => (
                                        <TouchableOpacity
                                            key={exercise.exerciseId || exercise.exerciseName}
                                            style={[
                                                styles.exerciseCard,
                                                isDark && exercise.isDone && { backgroundColor: colors.rowTint },
                                                !exercise.isDone && styles.untrackedCard,
                                                index === allMuscleExercises.length - 1 && styles.lastExerciseCard,
                                            ]}
                                            onPress={() => exercise.exerciseId && navigateToExercise(exercise.exerciseId)}
                                            activeOpacity={0.7}
                                            disabled={!exercise.exerciseId}
                                        >
                                            <View style={styles.exerciseLeft}>
                                                <View style={styles.thumbnailContainer}>
                                                    <ExerciseMediaThumbnail
                                                        gifUrl={exercise.gifUrl}
                                                        style={StyleSheet.flatten([
                                                            styles.exerciseThumbnail, 
                                                            !exercise.isDone && styles.untrackedThumbnail
                                                        ]) as ViewStyle}
                                                    />
                                                    {!exercise.isDone && (
                                                        <View style={styles.lockOverlay}>
                                                            <Ionicons name="lock-closed" size={14} color="#FFF" />
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.exerciseInfo}>
                                                    <Text style={[styles.exerciseName, !exercise.isDone && styles.untrackedText]}>
                                                        {exercise.exerciseName}
                                                    </Text>
                                                    {exercise.isDone ? (
                                                        <Text style={styles.exerciseWeight}>
                                                            Est. 1RM: {formatWeight(exercise.max1RM, {
                                                                maximumFractionDigits: weightUnit === 'kg' ? 1 : 0,
                                                            })}
                                                        </Text>
                                                    ) : (
                                                        <Text style={styles.exerciseStatus}>Not yet tracked</Text>
                                                    )}
                                                </View>
                                            </View>

                                            <View style={styles.exerciseRight}>
                                                {exercise.strengthInfo && (
                                                    <View
                                                        style={[
                                                            styles.levelBadgeItem,
                                                            {
                                                                backgroundColor: getLevelColor(
                                                                    exercise.strengthInfo.level as any,
                                                                ),
                                                            },
                                                        ]}
                                                    >
                                                        <Text style={styles.levelText}>{exercise.strengthInfo.level}</Text>
                                                    </View>
                                                )}
                                                <Ionicons
                                                    name="chevron-forward"
                                                    size={18}
                                                    color={colors.textTertiary}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}

                                <View style={styles.infoFooter}>
                                    <Ionicons name="shield-checkmark" size={14} color={colors.textTertiary} />
                                    <Text style={styles.infoFooterText}>
                                        Levels based on global strength standards
                                    </Text>
                                </View>
                            </ScrollView>
                        </View>
                    )}
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
        contentContainer: {
            flex: 1,
            padding: 20,
            paddingTop: 16,
        },
        header: {
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 12,
        },
        title: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.textPrimary,
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
            borderRadius: 8,
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
        exerciseWeight: {
            fontSize: 12,
            color: colors.textSecondary,
        },
        exerciseRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        levelBadgeItem: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
        },
        levelText: {
            color: '#FFF',
            fontSize: 11,
            fontWeight: '700',
        },
        untrackedCard: {
            backgroundColor: colors.bg,
            opacity: 0.8,
            borderStyle: 'dashed',
            elevation: 0,
            shadowOpacity: 0,
        },
        thumbnailContainer: {
            position: 'relative',
        },
        untrackedThumbnail: {
            opacity: 0.7,
        },
        lockOverlay: {
            position: 'absolute',
            right: -4,
            bottom: -4,
            backgroundColor: colors.textTertiary,
            borderRadius: 10,
            width: 18,
            height: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.bg,
        },
        untrackedText: {
            color: colors.textSecondary,
        },
        exerciseStatus: {
            fontSize: 12,
            color: colors.textTertiary,
            marginTop: 2,
        },
        infoFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 24,
            opacity: 0.6,
        },
        infoFooterText: {
            fontSize: 11,
            color: colors.textTertiary,
            fontWeight: '500',
        },
    })
