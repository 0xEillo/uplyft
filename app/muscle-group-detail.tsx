/**
 * Native Bottom Sheet for Muscle Group Detail (Strength)
 * 
 * This screen is presented as a native formSheet using Expo Router.
 * It shows exercise details and strength standards for a specific muscle group.
 */

import { EmptyState } from '@/components/EmptyState'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LevelBadge } from '@/components/LevelBadge'
import { useProfile } from '@/contexts/profile-context'
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
import { useMemo } from 'react'
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
    const insets = useSafeAreaInsets()
    const { formatWeight, weightUnit } = useWeightUnits()
    const { profile } = useProfile()
    
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

    if (!groupData) {
        return (
            <View style={[styles.container, { paddingBottom: insets.bottom }]}>
                <EmptyState
                    icon="body-outline"
                    title="No data available"
                    description="Could not load muscle group information."
                />
            </View>
        )
    }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.titleRow}>
                        <Text style={styles.headerTitle}>{groupDisplayName}</Text>
                        <LevelBadge level={groupData.level} size="small" showTooltipOnPress={false} />
                    </View>
                    <Text style={styles.progressText}>
                        {Math.round(groupData.progress)}% to next level
                    </Text>
                </View>
            </View>

            {/* Exercise List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>
                    {groupDisplayName} Strength
                </Text>

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
    )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: colors.background,
            padding: 20,
            paddingTop: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        headerLeft: {
            flex: 1,
        },
        headerTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
        },
        titleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 6,
        },
        progressText: {
            fontSize: 13,
            color: colors.textSecondary,
            fontWeight: '600',
            letterSpacing: -0.2,
        },
        scrollView: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            padding: 20,
        },
        sectionTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 16,
        },
        exerciseCard: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.feedCardBackground,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
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
            width: 44,
            height: 44,
            borderRadius: 8,
            backgroundColor: '#f0f0f0',
        },
        exerciseInfo: {
            flex: 1,
        },
        exerciseName: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 2,
            letterSpacing: -0.4,
        },
        exerciseWeight: {
            fontSize: 13,
            color: colors.textSecondary,
        },
        exerciseRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        levelBadgeItem: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
        },
        levelText: {
            color: '#FFF',
            fontSize: 12,
            fontWeight: '700',
        },
        untrackedCard: {
            backgroundColor: colors.background,
        },
        thumbnailContainer: {
            position: 'relative',
        },
        untrackedThumbnail: {},
        lockOverlay: {
            position: 'absolute',
            right: -4,
            bottom: -4,
            backgroundColor: colors.textTertiary,
            borderRadius: 10,
            width: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.background,
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
            marginTop: 32,
            opacity: 0.8,
        },
        infoFooterText: {
            fontSize: 12,
            color: colors.textTertiary,
            fontWeight: '500',
        },
    })
