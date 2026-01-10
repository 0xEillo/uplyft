import { EmptyState } from '@/components/EmptyState'
import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useRoutineSelection } from '@/hooks/useRoutineSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    ActivityIndicator,
    Dimensions,
    Platform,
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

export default function SelectRoutineScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { callCallback } = useRoutineSelection()
  
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shouldExit, setShouldExit] = useState(false)
  
  const styles = useMemo(() => createStyles(colors), [colors])

  // Load routines
  useEffect(() => {
    const loadRoutines = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }
      
      try {
        const data = await database.workoutRoutines.getAll(user.id)
        setRoutines(data)
      } catch (error) {
        console.error('Error loading routines:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadRoutines()
  }, [user])

  const handleSelectRoutine = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      callCallback(routine)
      router.back()
    },
    [callCallback, router],
  )

  const handleViewRoutine = useCallback(
    (routine: WorkoutRoutineWithDetails) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      router.push({
        pathname: '/routine/[routineId]',
        params: { routineId: routine.id },
      })
    },
    [router],
  )

  const handleCreateRoutine = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push('/create-routine')
  }, [router])

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const renderRoutineCard = (routine: WorkoutRoutineWithDetails, index: number) => {
    const tintColors = ['#A3E635', '#22D3EE', '#94A3B8', '#F0ABFC', '#FB923C']
    const tintColor = routine.tint_color || tintColors[index % tintColors.length]

    const getRoutineImage = () => {
      const imagePath = routine.image_path || `${routine.name}.png`
      return getRoutineImageUrl(imagePath)
    }

    const imageSource = getRoutineImage()

    return (
      <View key={routine.id} style={styles.routineCardWrapper}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.routineCard}
          onPress={() => handleViewRoutine(routine)}
        >
          {imageSource ? (
            <>
              <Image
                source={typeof imageSource === 'string' ? { uri: imageSource } : imageSource}
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
                !imageSource && { color: colors.text },
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
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 100}
              tint="dark"
              style={styles.startButtonBlur}
            >
              <Ionicons
                name="play"
                size={16}
                color="#FFF"
                style={{ marginLeft: 2 }}
              />
            </BlurView>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
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
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Select Routine
          </Text>
          
          <TouchableOpacity style={styles.headerButton} onPress={handleCreateRoutine}>
            <Ionicons name="add" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : routines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="albums-outline"
              title="No Routines Yet"
              description="Create your first routine to quickly start structured workouts"
            />
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={handleCreateRoutine}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={22} color="#FFF" />
              <Text style={styles.createButtonText}>Create New Routine</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.routinesGrid}>
              {routines.map((routine, index) => renderRoutineCard(routine, index))}
            </View>
          </ScrollView>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerButton: {
      width: 40,
      height: 40,
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 16,
      gap: 10,
      marginTop: 24,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFF',
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
      backgroundColor: colors.feedCardBackground,
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
      top: 10,
      right: 10,
      // Use shadow on the container, but move clipping to the BlurView for smoother edges
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    },
    startButtonBlur: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 1, // Slightly thicker but more predictable than hairlineWidth
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
  })
