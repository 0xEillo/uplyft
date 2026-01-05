import { useThemedColors } from '@/hooks/useThemedColors'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'
import {
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - 52) / 2 // 20px padding each side + 12px gap

interface RoutineSelectorSheetProps {
  visible: boolean
  routines: WorkoutRoutineWithDetails[]
  onClose: () => void
  onSelectRoutine: (routine: WorkoutRoutineWithDetails) => void
  onCreateRoutine: () => void
  onEditRoutine: (routine: WorkoutRoutineWithDetails) => void
  onDeleteRoutine: (routine: WorkoutRoutineWithDetails) => void
}

export function RoutineSelectorSheet({
  visible,
  routines,
  onClose,
  onSelectRoutine,
  onCreateRoutine,
  onEditRoutine,
  onDeleteRoutine,
}: RoutineSelectorSheetProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const router = useRouter()

  // Animation refs
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const backdropAnim = useRef(new Animated.Value(0)).current

  // Handle modal animations
  useEffect(() => {
    if (visible) {
      // Slide up
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      // Slide down
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, slideAnim, backdropAnim])

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          onClose()
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 25,
            stiffness: 200,
          }).start()
        }
      },
    }),
  ).current

  const handleSelect = (routine: WorkoutRoutineWithDetails) => {
    onSelectRoutine(routine)
    onClose()
  }

  const handleCreateRoutine = () => {
    onCreateRoutine()
    onClose()
  }

  const handleRoutinePress = (routine: WorkoutRoutineWithDetails) => {
    // Navigate to routine detail for viewing/editing
    router.push({
      pathname: '/routine/[routineId]',
      params: { routineId: routine.id },
    })
    onClose()
  }

  const renderRoutineCard = (routine: WorkoutRoutineWithDetails, index: number) => {
    const tintColors = ['#A3E635', '#22D3EE', '#94A3B8', '#F0ABFC', '#FB923C']
    const tintColor = routine.tint_color || tintColors[index % tintColors.length]

    const exerciseCount = routine.workout_routine_exercises?.length || 0
    const setCount =
      routine.workout_routine_exercises?.reduce(
        (sum, ex) => sum + (ex.sets?.length || 0),
        0,
      ) || 0

    // Get image source from storage bucket
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
          onPress={() => handleRoutinePress(routine)}
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
            <View style={styles.routineStats}>
              <View style={styles.routineStatItem}>
                <Ionicons
                  name="barbell-outline"
                  size={11}
                  color={imageSource ? 'rgba(255,255,255,0.8)' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.routineStatText,
                    !imageSource && { color: colors.textSecondary },
                  ]}
                >
                  {exerciseCount}
                </Text>
              </View>
              <View style={styles.routineStatItem}>
                <Ionicons
                  name="layers-outline"
                  size={11}
                  color={imageSource ? 'rgba(255,255,255,0.8)' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.routineStatText,
                    !imageSource && { color: colors.textSecondary },
                  ]}
                >
                  {setCount}
                </Text>
              </View>
            </View>
          </View>

          {/* Start Button - Overlay on card */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={(e) => {
              e.stopPropagation?.()
              handleSelect(routine)
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={14} color="#FFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View
              style={[styles.handle, { backgroundColor: colors.textSecondary }]}
            />
          </View>

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Routine</Text>
            <Text style={styles.modalSubtitle}>
              Choose a routine to start your workout
            </Text>
          </View>

          {/* Routines Grid */}
          <ScrollView
            style={styles.routineList}
            contentContainerStyle={styles.routineListContent}
            showsVerticalScrollIndicator={false}
          >
            {routines.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons
                    name="albums-outline"
                    size={40}
                    color={colors.textPlaceholder}
                  />
                </View>
                <Text style={styles.emptyTitle}>No Routines Yet</Text>
                <Text style={styles.emptyMessage}>
                  Create your first routine to quickly{'\n'}start structured workouts
                </Text>
              </View>
            ) : (
              <View style={styles.routinesGrid}>
                {routines.map((routine, index) =>
                  renderRoutineCard(routine, index)
                )}
              </View>
            )}

            {/* Create Routine Button */}
            <TouchableOpacity
              style={styles.createRoutineButton}
              onPress={handleCreateRoutine}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + 'DD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createRoutineGradient}
              >
                <Ionicons name="add-circle" size={22} color="#FFF" />
                <Text style={styles.createRoutineText}>Create New Routine</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContent: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      minHeight: SCREEN_HEIGHT * 0.92,
      paddingBottom: 40,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 24,
    },
    handleContainer: {
      alignItems: 'center',
      paddingTop: 14,
      paddingBottom: 6,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      opacity: 0.25,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 20,
    },
    modalTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    modalSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 4,
    },
    routineList: {
      flex: 1,
    },
    routineListContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    routinesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
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
      paddingBottom: 14,
    },
    routineTitle: {
      color: '#FFF',
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 4,
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
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.backgroundLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    emptyMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    createRoutineButton: {
      marginTop: 20,
      borderRadius: 16,
      overflow: 'hidden',
    },
    createRoutineGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 10,
    },
    createRoutineText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFF',
    },
  })
