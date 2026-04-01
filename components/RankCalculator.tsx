import { LevelBadge } from '@/components/LevelBadge'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { useTheme } from '@/contexts/theme-context'
import { LEVEL_COLORS, useStrengthData } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWeightUnits } from '@/hooks/useWeightUnits'
import { hapticLevelUp } from '@/lib/haptics'
import {
  EXERCISES_WITH_STANDARDS,
  type ExerciseStandardsConfig,
  type StrengthLevel,
} from '@/lib/exercise-standards-config'
import { estimateOneRepMaxKg } from '@/lib/strength-progress'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RulerPicker } from './RulerPicker'

const TILE_SIZE = 180
const MAX_WEIGHT_KG = 300

/** Carousel item: width 80 + marginHorizontal 12 each side */
const CAROUSEL_ITEM_LENGTH = 80 + 12 + 12

function sortRankedExercises(
  list: ExerciseStandardsConfig[],
): ExerciseStandardsConfig[] {
  return [...list].sort((a, b) => {
    const tierA = a.tier ?? 3
    const tierB = b.tier ?? 3
    if (tierA !== tierB) return tierA - tierB
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function getExerciseDisplayName(name: string): string {
  return name.replace(' (Barbell)', '')
}

export function RankCalculator() {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { width: viewportWidth } = useWindowDimensions()
  const { weightUnit, convertInputToKg, convertToPreferred, formatWeight } =
    useWeightUnits()
  const { getStrengthInfo } = useStrengthData()

  const rankedExercises = useMemo(
    () => sortRankedExercises(EXERCISES_WITH_STANDARDS),
    [],
  )

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    rankedExercises[0]?.id ?? null,
  )
  const [weightKg, setWeightKg] = useState<number>(0)
  const [reps, setReps] = useState<number>(0)
  const [showRankModal, setShowRankModal] = useState(false)

  const carouselRef = useRef<FlatList<ExerciseStandardsConfig>>(null)
  const skipCarouselScrollIntoView = useRef(true)

  const getCarouselItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: CAROUSEL_ITEM_LENGTH,
      offset: CAROUSEL_ITEM_LENGTH * index,
      index,
    }),
    [],
  )
  const fadeAnim = useRef(new Animated.Value(0)).current
  const contentScale = useRef(new Animated.Value(0.88)).current
  const tileScale = useRef(new Animated.Value(0)).current

  const selectedExercise = useMemo(() => {
    return rankedExercises.find((exercise) => exercise.id === selectedExerciseId) ?? null
  }, [rankedExercises, selectedExerciseId])

  const isRepBasedExercise = selectedExercise?.isRepBased ?? false
  const displayWeight = Math.round(convertToPreferred(weightKg) ?? 0)
  const maxDisplayWeight = Math.max(
    1,
    Math.round(convertToPreferred(MAX_WEIGHT_KG) ?? MAX_WEIGHT_KG),
  )

  const strengthMetric = useMemo(() => {
    if (reps <= 0) return 0
    if (isRepBasedExercise) return reps
    if (weightKg <= 0) return 0
    return estimateOneRepMaxKg(weightKg, reps)
  }, [isRepBasedExercise, reps, weightKg])

  const strengthInfo = useMemo(() => {
    if (!selectedExercise || strengthMetric <= 0) return null
    return getStrengthInfo(selectedExercise.name, strengthMetric)
  }, [selectedExercise, strengthMetric, getStrengthInfo])

  const currentLevel = strengthInfo?.level ?? 'Untrained'
  const levelColor = LEVEL_COLORS[currentLevel as StrengthLevel] ?? '#FF6B35'
  const tileBg = isDark ? 'rgba(34,37,43,0.86)' : 'rgba(255,255,255,0.94)'
  const canCalculate = isRepBasedExercise ? reps > 0 : weightKg > 0 && reps > 0
  const progressSummary = strengthInfo?.nextLevel
    ? `${Math.round(strengthInfo.progress)}% to ${strengthInfo.nextLevel.level}`
    : 'Highest rank achieved'

  const closeModal = () => {
    setShowRankModal(false)
  }

  useEffect(() => {
    if (!selectedExerciseId) return
    const index = rankedExercises.findIndex((e) => e.id === selectedExerciseId)
    if (index < 0) return
    if (skipCarouselScrollIntoView.current) {
      skipCarouselScrollIntoView.current = false
      return
    }
    const id = requestAnimationFrame(() => {
      carouselRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      })
    })
    return () => cancelAnimationFrame(id)
  }, [selectedExerciseId, rankedExercises])

  useEffect(() => {
    if (!showRankModal || !strengthInfo || !selectedExercise) return

    hapticLevelUp()
    fadeAnim.setValue(0)
    contentScale.setValue(0.88)
    tileScale.setValue(0)

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start()

    const t1 = setTimeout(() => {
      Animated.spring(tileScale, {
        toValue: 1,
        tension: 80,
        friction: 5,
        useNativeDriver: true,
      }).start()
    }, 200)

    return () => {
      clearTimeout(t1)
    }
  }, [
    showRankModal,
    strengthInfo,
    selectedExercise,
    fadeAnim,
    contentScale,
    tileScale,
  ])

  const handleGetRank = () => {
    if (!strengthInfo) return
    setShowRankModal(true)
  }

  const scrollLeft = () => {
    carouselRef.current?.scrollToOffset({ offset: 0, animated: true })
  }

  const scrollRight = () => {
    carouselRef.current?.scrollToEnd({ animated: true })
  }

  const modalStyles = useMemo(
    () =>
      StyleSheet.create({
        modalRoot: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: 24,
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark
            ? 'rgba(18, 18, 18, 0.97)'
            : 'rgba(255, 255, 255, 0.97)',
        },
        card: {
          alignItems: 'center',
          width: '100%',
          maxWidth: viewportWidth - 48,
        },
        exerciseName: {
          fontSize: 26,
          fontWeight: '900',
          color: colors.textPrimary,
          textAlign: 'center',
          letterSpacing: -0.5,
          marginBottom: 36,
          textTransform: 'uppercase',
        },
        badgeTile: {
          width: TILE_SIZE,
          minHeight: TILE_SIZE + 32,
          borderRadius: 22,
          paddingHorizontal: 12,
          paddingVertical: 16,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          shadowColor: levelColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 6,
        },
        badgeVisualWrap: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        textStack: {
          gap: 3,
          alignItems: 'center',
          width: '100%',
        },
        badgeName: {
          fontSize: 16,
          lineHeight: 20,
          fontWeight: '800',
          textAlign: 'center',
          includeFontPadding: false,
        },
        badgeStatusPill: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          minWidth: 80,
        },
        badgeStatusText: {
          fontSize: 11,
          fontWeight: '700',
        },
        metaBlock: {
          marginTop: 32,
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 8,
        },
        metaLine: {
          fontSize: 22,
          fontWeight: '800',
          color: colors.textPrimary,
          textAlign: 'center',
        },
        metaSub: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.textSecondary,
          textAlign: 'center',
        },
      }),
    [colors, insets.bottom, insets.top, isDark, levelColor, viewportWidth],
  )

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 16,
      backgroundColor: colors.bg,
    },
    carouselContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    carouselArrow: {
      padding: 10,
    },
    carousel: {
      flex: 1,
    },
    carouselContent: {
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    exerciseCard: {
      alignItems: 'center',
      marginHorizontal: 12,
      width: 80,
      opacity: 0.5,
    },
    exerciseCardSelected: {
      opacity: 1,
      transform: [{ scale: 1.1 }],
    },
    exerciseNameCarousel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    exerciseThumbnail: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: 'transparent',
    },
    getRankButton: {
      backgroundColor: colors.surfaceCard,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    getRankButtonActive: {
      backgroundColor: colors.brandPrimary,
    },
    getRankButtonText: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    getRankButtonTextActive: {
      color: '#fff',
    },
  })

  const exerciseTitle = selectedExercise
    ? getExerciseDisplayName(selectedExercise.name)
    : ''

  return (
    <View style={styles.container}>
      <View style={styles.carouselContainer}>
        <TouchableOpacity style={styles.carouselArrow} onPress={scrollLeft}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>

        <FlatList
          ref={carouselRef}
          data={rankedExercises}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}
          getItemLayout={getCarouselItemLayout}
          initialNumToRender={14}
          maxToRenderPerBatch={20}
          windowSize={7}
          removeClippedSubviews
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              carouselRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
              })
            }, 120)
          }}
          renderItem={({ item: exercise }) => (
            <TouchableOpacity
              style={[
                styles.exerciseCard,
                selectedExerciseId === exercise.id && styles.exerciseCardSelected,
              ]}
              onPress={() => {
                setSelectedExerciseId(exercise.id)
                setShowRankModal(false)
              }}
            >
              <Text style={styles.exerciseNameCarousel} numberOfLines={2}>
                {getExerciseDisplayName(exercise.name)}
              </Text>
              <ExerciseMediaThumbnail
                gifUrl={exercise.gifUrl}
                style={styles.exerciseThumbnail}
              />
            </TouchableOpacity>
          )}
        />

        <TouchableOpacity style={styles.carouselArrow} onPress={scrollRight}>
          <Ionicons
            name="chevron-forward"
            size={28}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {!isRepBasedExercise && (
        <RulerPicker
          label="WEIGHT"
          unit={weightUnit}
          value={displayWeight}
          onValueChange={(value) => {
            const nextWeightKg = convertInputToKg(value)
            setWeightKg(nextWeightKg ?? 0)
            setShowRankModal(false)
          }}
          min={0}
          max={maxDisplayWeight}
          step={1}
        />
      )}

      <RulerPicker
        label="REPS"
        unit="reps"
        value={reps}
        onValueChange={(val) => {
          setReps(val)
          setShowRankModal(false)
        }}
        min={0}
        max={50}
        step={1}
      />

      <TouchableOpacity
        style={[
          styles.getRankButton,
          canCalculate && styles.getRankButtonActive,
        ]}
        onPress={handleGetRank}
        disabled={!canCalculate}
      >
        <Text
          style={[
            styles.getRankButtonText,
            canCalculate && styles.getRankButtonTextActive,
          ]}
        >
          GET MY RANK!
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showRankModal && !!strengthInfo && !!selectedExercise}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeModal}
      >
        <View style={modalStyles.modalRoot}>
          <Pressable style={modalStyles.backdrop} onPress={closeModal} />
          <Animated.View
            style={{ opacity: fadeAnim, width: '100%', alignItems: 'center' }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[modalStyles.card, { transform: [{ scale: contentScale }] }]}
            >
              <Text style={modalStyles.exerciseName} numberOfLines={2}>
                {exerciseTitle}
              </Text>

              <Animated.View style={{ transform: [{ scale: tileScale }] }}>
                <LiquidGlassSurface
                  style={[
                    modalStyles.badgeTile,
                    {
                      backgroundColor: tileBg,
                      borderColor: levelColor,
                      borderWidth: 2,
                    },
                  ]}
                  debugLabel="rank-calculator-preview"
                >
                  <LinearGradient
                    colors={[`${levelColor}40`, 'transparent']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    pointerEvents="none"
                  />
                  <View style={modalStyles.badgeVisualWrap}>
                    <LevelBadge
                      level={currentLevel}
                      size="hero"
                      showTooltipOnPress={false}
                    />
                  </View>
                  <View style={modalStyles.textStack}>
                    <Text
                      style={[modalStyles.badgeName, { color: levelColor }]}
                      numberOfLines={2}
                    >
                      {currentLevel}
                    </Text>
                  </View>
                  <View
                    style={[
                      modalStyles.badgeStatusPill,
                      { backgroundColor: `${levelColor}33` },
                    ]}
                  >
                    <Ionicons
                      name="analytics-outline"
                      size={11}
                      color={levelColor}
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={[
                        modalStyles.badgeStatusText,
                        { color: levelColor },
                      ]}
                    >
                      {isRepBasedExercise ? 'Calculated' : 'Estimated'}
                    </Text>
                  </View>
                </LiquidGlassSurface>
              </Animated.View>

              <View style={modalStyles.metaBlock}>
                <Text style={modalStyles.metaLine}>
                  {isRepBasedExercise
                    ? `Reps: ${strengthMetric}`
                    : `Est. 1RM: ${formatWeight(strengthMetric)}`}
                </Text>
                <Text style={modalStyles.metaSub}>{progressSummary}</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  )
}
