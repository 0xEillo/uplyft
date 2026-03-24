import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'

import { ExerciseMediaThumbnail } from '@/components/ExerciseMedia'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  type ParsedProgramDisplay,
  type ParsedWorkoutDisplay,
  getExerciseIcon,
} from '@/lib/ai/workoutParsing'
import { findExerciseByName } from '@/lib/utils/exercise-matcher'

export type { ParsedProgramDisplay }

interface ProgramCardProps {
  program: ParsedProgramDisplay
  coachImage?: ImageSourcePropType
  username?: string
  onSaveProgram?: () => void | Promise<void>
}

function RoutineSlide({
  routine,
  dayIndex,
  isDark,
  colors,
}: {
  routine: ParsedWorkoutDisplay
  dayIndex: number
  isDark: boolean
  colors: ReturnType<typeof useThemedColors>
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedExerciseIndices, setExpandedExerciseIndices] = useState<
    number[]
  >([])
  const styles = routineStyles(colors, isDark)

  const visibleExercises = isExpanded
    ? routine.exercises
    : routine.exercises.slice(0, 4)
  const hasMoreExercises = routine.exercises.length > 4

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>{dayIndex + 1}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {routine.title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons
              name="barbell-outline"
              size={10}
              color={isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary}
            />
            <Text style={styles.metaText}>
              {routine.exercises.length} exercises
            </Text>
            {routine.duration ? (
              <>
                <View style={styles.metaDot} />
                <Ionicons
                  name="time-outline"
                  size={10}
                  color={
                    isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary
                  }
                />
                <Text style={styles.metaText}>{routine.duration}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.routineDivider} />

      <View style={styles.exerciseList}>
        {visibleExercises.map((exercise, index) => {
          const isLast =
            index === visibleExercises.length - 1 && !hasMoreExercises
          const isExerciseExpanded = expandedExerciseIndices.includes(index)
          const exerciseMatch = findExerciseByName(exercise.name)
          const canNavigate = !!exerciseMatch?.id

          const handleNav = () => {
            if (exerciseMatch?.id) {
              router.push(`/exercise/${exerciseMatch.id}`)
            }
          }

          return (
            <View
              key={index}
              style={[styles.exRow, !isLast && styles.exRowBorder]}
            >
              <TouchableOpacity
                style={[
                  styles.exThumb,
                  exercise.gifUrl ? styles.exThumbMedia : null,
                ]}
                onPress={handleNav}
                disabled={!canNavigate}
                activeOpacity={canNavigate ? 0.7 : 1}
              >
                {exercise.gifUrl ? (
                  <ExerciseMediaThumbnail
                    gifUrl={exercise.gifUrl}
                    style={styles.thumbImg}
                  />
                ) : (
                  <Ionicons
                    name={getExerciseIcon(exercise.name)}
                    size={16}
                    color={
                      isDark ? 'rgba(255,255,255,0.38)' : colors.textTertiary
                    }
                  />
                )}
              </TouchableOpacity>

              <View style={styles.exContent}>
                <View style={styles.exNameRow}>
                  <TouchableOpacity
                    onPress={handleNav}
                    disabled={!canNavigate}
                    activeOpacity={canNavigate ? 0.7 : 1}
                    style={styles.exNameTouch}
                  >
                    <Text style={styles.exName} numberOfLines={1}>
                      {exercise.name}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.exMeta}>
                    <Text style={styles.setSummary}>
                      {exercise.sets.length} sets
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setExpandedExerciseIndices((prev) =>
                          prev.includes(index)
                            ? prev.filter((i) => i !== index)
                            : [...prev, index],
                        )
                      }
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.chevronBtn}
                    >
                      <Ionicons
                        name={
                          isExerciseExpanded ? 'chevron-up' : 'chevron-down'
                        }
                        size={16}
                        color={
                          isDark
                            ? 'rgba(255,255,255,0.28)'
                            : colors.textTertiary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {isExerciseExpanded && (
                  <View style={styles.setsContainer}>
                    {(() => {
                      let workingNum = 0
                      return exercise.sets.map((set, si) => {
                        const isWarmup = set.type === 'warmup'
                        if (!isWarmup) workingNum++
                        return (
                          <View key={si} style={styles.setRow}>
                            <View
                              style={[
                                styles.setBadge,
                                isWarmup && styles.warmupBadge,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.setBadgeText,
                                  isWarmup && styles.warmupBadgeText,
                                ]}
                              >
                                {isWarmup ? 'W' : String(workingNum)}
                              </Text>
                            </View>
                            <Text style={styles.setDetail}>
                              {set.reps} reps
                              {set.weight ? (
                                <Text style={styles.setDetailMuted}>
                                  {' '}
                                  · {set.weight}
                                </Text>
                              ) : null}
                            </Text>
                          </View>
                        )
                      })
                    })()}
                  </View>
                )}
              </View>
            </View>
          )
        })}

        {hasMoreExercises && (
          <TouchableOpacity
            style={styles.expandFooter}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary}
            />
            <Text style={styles.expandText}>
              {isExpanded
                ? 'Show less'
                : `${routine.exercises.length - 4} more exercises`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export function ProgramCard({
  program,
  coachImage,
  username,
  onSaveProgram,
}: ProgramCardProps) {
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { width: windowWidth } = useWindowDimensions()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [canExpandDescription, setCanExpandDescription] = useState(false)
  const [hasMeasuredDescription, setHasMeasuredDescription] = useState(false)
  const [hasDescriptionWidth, setHasDescriptionWidth] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )
  const flatListRef = useRef<FlatList<ParsedWorkoutDisplay>>(null)
  const resetSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  const CAROUSEL_PAD = 10
  const CARD_SPACING = 10
  const PEEK_WIDTH = 20
  const ROUTINE_CARD_WIDTH = windowWidth - 40 - CAROUSEL_PAD * 2 - PEEK_WIDTH
  const SNAP_INTERVAL = ROUTINE_CARD_WIDTH + CARD_SPACING

  const styles = createStyles(colors, isDark)

  useEffect(() => {
    return () => {
      if (resetSavedTimeoutRef.current) {
        clearTimeout(resetSavedTimeoutRef.current)
      }
    }
  }, [])

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL)
    if (idx !== activeIndex) {
      setActiveIndex(Math.min(idx, program.routines.length - 1))
    }
  }

  const handleSavePress = async () => {
    if (!onSaveProgram || saveState === 'saving') return

    try {
      setSaveState('saving')
      await onSaveProgram()
      setSaveState('saved')

      if (resetSavedTimeoutRef.current) {
        clearTimeout(resetSavedTimeoutRef.current)
      }

      resetSavedTimeoutRef.current = setTimeout(() => {
        setSaveState('idle')
      }, 2000)
    } catch {
      setSaveState('idle')
    }
  }

  return (
    <LiquidGlassSurface
      style={styles.container}
      fallbackStyle={styles.containerFallback}
      debugLabel="program-card"
    >
      {coachImage && (
        <View style={styles.coachRow}>
          <Image source={coachImage} style={styles.coachAvatar} />
          <Text style={styles.coachLabel}>
            Program for{' '}
            <Text style={styles.coachLabelName}>{username ?? 'you'}</Text>
          </Text>
        </View>
      )}

      <View style={[styles.cardHeader, !coachImage && { paddingTop: 22 }]}>
        <Text style={styles.cardTitle}>{program.title}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons
              name="calendar-outline"
              size={11}
              color={colors.brandPrimary}
            />
            <Text style={styles.statChipText}>
              {program.routines.length} workouts
            </Text>
          </View>
          {program.frequency ? (
            <>
              <View style={styles.statDot} />
              <View style={styles.statChip}>
                <Ionicons
                  name="repeat-outline"
                  size={11}
                  color={colors.brandPrimary}
                />
                <Text style={styles.statChipText}>{program.frequency}</Text>
              </View>
            </>
          ) : null}
          {program.goal ? (
            <>
              <View style={styles.statDot} />
              <View style={styles.statChip}>
                <Ionicons
                  name="trophy-outline"
                  size={11}
                  color={colors.brandPrimary}
                />
                <Text style={styles.statChipText}>{program.goal}</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {program.description ? (
        <TouchableOpacity
          onPress={() =>
            canExpandDescription &&
            setIsDescriptionExpanded(!isDescriptionExpanded)
          }
          activeOpacity={canExpandDescription ? 0.7 : 1}
          disabled={!canExpandDescription}
          style={styles.descriptionWrapper}
          onLayout={({ nativeEvent }) => {
            if (nativeEvent.layout.width > 0 && !hasDescriptionWidth) {
              setHasDescriptionWidth(true)
            }
          }}
        >
          {!hasMeasuredDescription && hasDescriptionWidth ? (
            <View
              pointerEvents="none"
              style={styles.descriptionMeasureContainer}
            >
              <Text
                style={styles.description}
                onTextLayout={({ nativeEvent }) => {
                  setCanExpandDescription(nativeEvent.lines.length > 2)
                  setHasMeasuredDescription(true)
                }}
              >
                {program.description}
              </Text>
            </View>
          ) : null}
          <Text
            style={styles.description}
            numberOfLines={isDescriptionExpanded ? undefined : 2}
          >
            {program.description}
          </Text>
          {canExpandDescription && (
            <Text style={styles.descriptionMoreText}>
              {isDescriptionExpanded ? 'Show less' : 'Read more'}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.carouselSection}>
        <FlatList
          ref={flatListRef}
          data={program.routines}
          keyExtractor={(_, i) => String(i)}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: CAROUSEL_PAD }}
          renderItem={({ item: routine, index }) => (
            <View
              style={[
                { width: ROUTINE_CARD_WIDTH },
                index < program.routines.length - 1 && {
                  marginRight: CARD_SPACING,
                },
              ]}
            >
              <RoutineSlide
                routine={routine}
                dayIndex={index}
                isDark={isDark}
                colors={colors}
              />
            </View>
          )}
        />

        {program.routines.length > 1 && (
          <View style={styles.paginationRow}>
            {program.routines.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {onSaveProgram && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              saveState === 'saved' && styles.primaryButtonSaved,
            ]}
            onPress={handleSavePress}
            activeOpacity={0.85}
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving' ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.primaryButtonText}>Saving...</Text>
              </>
            ) : saveState === 'saved' ? (
              <>
                <Text style={styles.primaryButtonText}>Saved</Text>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Save Program</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </LiquidGlassSurface>
  )
}

const routineStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    card: {
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 12,
    },
    dayBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark
        ? `${colors.brandPrimary}20`
        : `${colors.brandPrimary}14`,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark
        ? `${colors.brandPrimary}40`
        : `${colors.brandPrimary}30`,
    },
    dayBadgeText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.brandPrimary,
      letterSpacing: -0.3,
    },
    headerText: { flex: 1 },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? 'rgba(255,255,255,0.88)' : colors.textPrimary,
      letterSpacing: -0.2,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 11,
      fontWeight: '500',
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
    },
    metaDot: {
      width: 2.5,
      height: 2.5,
      borderRadius: 1.25,
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : colors.border,
      marginHorizontal: 2,
    },
    routineDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      marginHorizontal: 14,
    },
    exerciseList: {
      paddingHorizontal: 10,
      paddingBottom: 6,
    },
    exRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 10,
    },
    exRowBorder: {},
    exThumb: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.06)'
        : colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    exThumbMedia: {
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'transparent',
      borderWidth: 0,
    },
    thumbImg: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
    },
    exContent: { flex: 1 },
    exNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    exNameTouch: { flex: 1 },
    exName: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? 'rgba(255,255,255,0.88)' : colors.textPrimary,
      letterSpacing: -0.1,
    },
    exMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    setSummary: {
      fontSize: 12,
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
      fontWeight: '500',
    },
    chevronBtn: { padding: 2 },
    setsContainer: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
      gap: 7,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    setBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
    },
    warmupBadge: {
      backgroundColor: `${colors.statusWarning}22`,
      borderColor: `${colors.statusWarning}40`,
    },
    setBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary,
    },
    warmupBadgeText: { color: colors.statusWarning },
    setDetail: {
      fontSize: 13,
      color: isDark ? 'rgba(255,255,255,0.62)' : colors.textSecondary,
      fontWeight: '400',
    },
    setDetailMuted: {
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
    },
    expandFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 5,
      marginTop: 2,
    },
    expandText: {
      fontSize: 13,
      color: isDark ? 'rgba(255,255,255,0.35)' : colors.textTertiary,
      fontWeight: '500',
    },
  })

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      borderRadius: 24,
      overflow: 'hidden',
      marginVertical: 6,
    },
    containerFallback: {
      backgroundColor: isDark
        ? 'rgba(26,26,28,0.94)'
        : 'rgba(255,255,255,0.94)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.5 : 0.1,
      shadowRadius: 28,
      elevation: 10,
    },
    coachRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 18,
      gap: 7,
    },
    coachAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      opacity: 0.85,
    },
    coachLabel: {
      fontSize: 12,
      color: isDark ? 'rgba(255,255,255,0.38)' : colors.textTertiary,
      fontWeight: '400',
      letterSpacing: 0.1,
    },
    coachLabelName: {
      color: isDark ? 'rgba(255,255,255,0.65)' : colors.textSecondary,
      fontWeight: '600',
    },
    cardHeader: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 14,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#F5F5F5' : colors.textPrimary,
      lineHeight: 26,
      letterSpacing: -0.3,
      marginBottom: 8,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? 'rgba(255,255,255,0.45)' : colors.textTertiary,
      letterSpacing: 0.1,
    },
    statDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : colors.border,
    },
    descriptionWrapper: {
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    description: {
      fontSize: 14,
      color: isDark ? 'rgba(255,255,255,0.45)' : colors.textSecondary,
      lineHeight: 20,
      letterSpacing: 0.1,
    },
    descriptionMeasureContainer: {
      position: 'absolute',
      left: 20,
      right: 20,
      opacity: 0,
      zIndex: -1,
    },
    descriptionMoreText: {
      fontSize: 12,
      color: isDark ? 'rgba(255,255,255,0.3)' : colors.textTertiary,
      marginTop: 4,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      marginHorizontal: 20,
      marginBottom: 12,
    },
    carouselSection: {
      paddingBottom: 6,
    },
    paginationRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 4,
      gap: 6,
    },
    dot: {
      height: 5,
      borderRadius: 2.5,
    },
    dotActive: {
      width: 16,
      backgroundColor: colors.brandPrimary,
    },
    dotInactive: {
      width: 5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : colors.textTertiary,
      opacity: 0.4,
    },
    actionsContainer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      marginTop: 4,
    },
    primaryButton: {
      backgroundColor: colors.brandPrimary,
      height: 50,
      borderRadius: 25,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      shadowColor: colors.brandPrimary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
      elevation: 6,
    },
    primaryButtonSaved: {
      backgroundColor: isDark ? '#1E7A46' : '#17803D',
      shadowColor: isDark ? '#1E7A46' : '#17803D',
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
  })
