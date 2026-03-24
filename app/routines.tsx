import { EmptyState } from '@/components/EmptyState'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useRoutineSelection } from '@/hooks/useRoutineSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { WorkoutRoutineWithDetails, UserProgram } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SCREEN_WIDTH = Dimensions.get('window').width
const GAP = 12
const COLUMN_COUNT = 2
const CARD_WIDTH = (SCREEN_WIDTH - 32 - GAP) / COLUMN_COUNT

export default function RoutinesScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { callCallback } = useRoutineSelection()

  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [programs, setPrograms] = useState<UserProgram[]>([])
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [shouldExit, setShouldExit] = useState(false)

  const styles = useMemo(() => createStyles(colors), [colors])

  const loadRoutines = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [routinesData, programsData] = await Promise.all([
        database.workoutRoutines.getAll(user.id),
        database.userPrograms.getAll(user.id),
      ])
      setRoutines(routinesData)
      setPrograms(programsData)
    } catch (error) {
      console.error('Error loading routines:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Load routines
  useEffect(() => {
    loadRoutines()
  }, [loadRoutines])

  useEffect(() => {
    trackEvent(AnalyticsEvents.ROUTINES_VIEWED)
  }, [trackEvent])

  // Refresh routines when returning to this screen
  useFocusEffect(
    useCallback(() => {
      loadRoutines()
    }, [loadRoutines]),
  )

  const handleSelectRoutine = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      haptic('light')
      callCallback(routine)
      router.back()
    },
    [callCallback, router],
  )

  const handleViewRoutine = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      haptic('light')
      router.push({
        pathname: '/routine/[routineId]',
        params: { routineId: routine.id },
      })
    },
    [router],
  )

  const handleCreateRoutine = useCallback(() => {
    haptic('light')
    router.push('/create-routine')
  }, [router])

  const handleBack = useCallback(() => {
    haptic('light')
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const handleToggleProgram = useCallback((programId: string) => {
    haptic('light')
    setExpandedProgramId(prev => prev === programId ? null : programId)
  }, [])

  const renderRoutineCard = (
    routine: WorkoutRoutineWithDetails,
    index: number,
    customWidth?: number,
  ) => {
    const tintColors = ['#A3E635', '#22D3EE', '#94A3B8', '#F0ABFC', '#FB923C']
    const tintColor =
      routine.tint_color || tintColors[index % tintColors.length]

    const getRoutineImage = () => {
      const imagePath = routine.image_path || `${routine.name}.png`
      return getRoutineImageUrl(imagePath)
    }

    const imageSource = getRoutineImage()

    return (
      <View key={routine.id} style={[styles.routineCardWrapper, customWidth ? { width: customWidth } : undefined]}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.routineCard}
          onPress={() => handleViewRoutine(routine)}
        >
          {imageSource ? (
            <>
              <Image
                source={
                  typeof imageSource === 'string'
                    ? { uri: imageSource }
                    : imageSource
                }
                style={styles.routineImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="normal"
                transition={200}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
                style={styles.routineOverlay}
              />
              <View
                style={[
                  styles.colorTint,
                  { backgroundColor: tintColor, opacity: 0.2 },
                ]}
              />
            </>
          ) : (
            <LinearGradient
              colors={[tintColor + '40', tintColor + '20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.routineGradientBg}
            />
          )}

          {/* Card Content */}
          <View style={styles.routineContent}>
            <Text
              style={[
                styles.routineTitle,
                !imageSource && { color: colors.textPrimary },
              ]}
              numberOfLines={2}
            >
              {routine.name}
            </Text>
          </View>

          {/* Start Button - Overlay on card */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={(e) => {
              e.stopPropagation?.()
              handleSelectRoutine(routine)
            }}
            activeOpacity={0.9}
          >
            <LiquidGlassSurface style={styles.startButtonGlass}>
              <Ionicons
                name="play"
                size={18}
                color={colors.textPrimary}
                style={{ marginLeft: 2 }}
              />
            </LiquidGlassSurface>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    )
  }

  const renderProgramCard = (
    program: UserProgram,
    programRoutines: WorkoutRoutineWithDetails[],
    index: number,
  ) => {
    const isExpanded = expandedProgramId === program.id
    const tintColors = ['#A3E635', '#22D3EE', '#94A3B8', '#F0ABFC', '#FB923C']
    const tintColor = program.tint_color || tintColors[index % tintColors.length]

    const getProgramImage = () => {
      if (!program.image_path) return null
      return getRoutineImageUrl(program.image_path)
    }

    const imageSource = getProgramImage()
    const programTitleColor = imageSource ? '#FFF' : colors.textPrimary
    const programSubtitleColor = imageSource
      ? 'rgba(255,255,255,0.8)'
      : colors.textSecondary
    const programChevronColor = imageSource ? '#FFF' : colors.textPrimary

    return (
      <View key={`program-${program.id}`} style={{ width: '100%', marginBottom: GAP }}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.programCard, isExpanded && styles.programCardExpanded]}
          onPress={() => handleToggleProgram(program.id)}
        >
          {imageSource ? (
            <>
              <Image
                source={typeof imageSource === 'string' ? { uri: imageSource } : imageSource}
                style={styles.routineImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                style={styles.routineOverlay}
              />
            </>
          ) : (
            <LinearGradient
              colors={[tintColor + '50', tintColor + '20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.routineGradientBg}
            />
          )}

          <LiquidGlassSurface style={styles.programGlassOverlay}>
            <View style={styles.programHeader}>
              <View style={styles.programInfo}>
                <Text
                  style={[styles.programTitle, { color: programTitleColor }]}
                  numberOfLines={1}
                >
                  {program.name}
                </Text>
                <Text style={[styles.programSubtitle, { color: programSubtitleColor }]}>
                  {programRoutines.length} Routines
                </Text>
              </View>
              <View style={styles.expandIconContainer}>
                <Ionicons 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color={programChevronColor} 
                />
              </View>
            </View>
          </LiquidGlassSurface>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedRoutinesContainer}>
            <View style={styles.routinesGrid}>
              {programRoutines.map((routine, idx) => renderRoutineCard(routine, idx, (SCREEN_WIDTH - 32 - 24 - GAP) / COLUMN_COUNT))}
            </View>
          </View>
        )}
      </View>
    )
  }

  const renderContent = () => {
    // Group routines by program
    const standaloneRoutines = routines.filter(r => !r.program_id)
    const programGroups = programs.map(program => ({
      program,
      routines: routines.filter(r => r.program_id === program.id).sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })).filter(group => group.routines.length > 0 || true) // Keep empty programs too

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {programGroups.map((group, index) => 
          renderProgramCard(group.program, group.routines, index)
        )}
        <View style={styles.routinesGrid}>
          {standaloneRoutines.map((routine, index) => renderRoutineCard(routine, index))}
        </View>
      </ScrollView>
    )
  }

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.bg, paddingTop: insets.top },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <LiquidGlassSurface style={styles.headerButtonGlass}>
            <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </LiquidGlassSurface>

          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            My Routines
          </Text>

          <LiquidGlassSurface style={styles.headerButtonGlass}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleCreateRoutine}
            >
              <Ionicons name="add" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </LiquidGlassSurface>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
          </View>
        ) : routines.length === 0 && programs.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="No Routines Yet"
            description="Create your first routine to quickly start structured workouts"
            buttonText="Create New Routine"
            onPress={handleCreateRoutine}
          />
        ) : (
          renderContent()
        )}
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerButtonGlass: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: 15,
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
    },
    routinesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
    },
    routineCardWrapper: {
      width: CARD_WIDTH,
    },
    routineCard: {
      height: 160,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surfaceCard,
    },
    routineImage: {
      width: '100%',
      height: '100%',
      position: 'absolute',
    },
    routineGradientBg: {
      ...StyleSheet.absoluteFillObject,
    },
    colorTint: {
      ...StyleSheet.absoluteFillObject,
    },
    routineOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    routineContent: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 12,
      paddingBottom: 16,
    },
    routineTitle: {
      color: '#FFF',
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    routineStats: {
      flexDirection: 'row',
      gap: 10,
    },
    routineStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    routineStatText: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 11,
      fontWeight: '600',
    },
    startButton: {
      position: 'absolute',
      top: 12,
      right: 12,
    },
    startButtonGlass: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    programCard: {
      height: 100,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: colors.surfaceCard,
    },
    programCardExpanded: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    programGlassOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    programHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    programInfo: {
      flex: 1,
    },
    programTitle: {
      color: '#FFF',
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    programSubtitle: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 14,
      fontWeight: '600',
    },
    expandIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    expandedRoutinesContainer: {
      backgroundColor: colors.surfaceCard,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      paddingTop: 26,
      paddingBottom: 16,
      paddingHorizontal: 12,
      marginTop: -10,
      zIndex: -1,
    },
  })
