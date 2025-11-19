import { useThemedColors } from '@/hooks/useThemedColors'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
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

const SCREEN_HEIGHT = Dimensions.get('window').height

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
  const styles = createStyles(colors)
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
          {...panResponder.panHandlers}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View
              style={[styles.handle, { backgroundColor: colors.textSecondary }]}
            />
          </View>

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Routine</Text>
          </View>

          {/* Routines List */}
          <ScrollView
            style={styles.routineList}
            showsVerticalScrollIndicator={false}
          >
            {routines.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="albums-outline"
                  size={48}
                  color={colors.textPlaceholder}
                />
                <Text style={styles.emptyTitle}>No Routines Yet</Text>
              </View>
            ) : (
              routines.map((routine) => {
                const exerciseCount =
                  routine.workout_routine_exercises?.length || 0
                const setCount =
                  routine.workout_routine_exercises?.reduce(
                    (sum, ex) => sum + (ex.sets?.length || 0),
                    0,
                  ) || 0

                return (
                  <View key={routine.id} style={styles.routineItem}>
                    <TouchableOpacity
                      style={styles.routineMainContent}
                      onPress={() => {
                        // Navigate to routine detail
                        router.push({
                          pathname: '/routine-detail',
                          params: { routineId: routine.id }
                        })
                        onClose()
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.routineInfo}>
                        <Text style={styles.routineName}>{routine.name}</Text>
                        <Text style={styles.routineStats}>
                          {exerciseCount}{' '}
                          {exerciseCount === 1 ? 'exercise' : 'exercises'} ·{' '}
                          {setCount} sets
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity
                        onPress={() => handleSelect(routine)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.actionButton}
                      >
                        <Ionicons
                          name="play-outline"
                          size={20}
                          color={colors.success}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => onEditRoutine(routine)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.actionButton}
                      >
                        <Ionicons
                          name="create-outline"
                          size={20}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => onDeleteRoutine(routine)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.actionButton}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })
            )}

            {/* Create Routine Button - Always shown at bottom */}
            <View style={styles.createRoutineContainer}>
              <TouchableOpacity
                style={styles.createRoutineButton}
                onPress={handleCreateRoutine}
                activeOpacity={0.6}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color={colors.primary}
                />
                <Text style={styles.createRoutineText}>Create Routine</Text>
              </TouchableOpacity>
            </View>
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SCREEN_HEIGHT * 0.75,
      paddingBottom: 34,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 20,
      flex: 1,
      flexDirection: 'column',
    },
    handleContainer: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      opacity: 0.3,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    routineList: {
      paddingHorizontal: 16,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    routineItem: {
      flexDirection: 'row',
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
      gap: 12,
    },
    routineMainContent: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionButtonsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    actionButton: {
      padding: 4,
    },
    routineInfo: {
      flex: 1,
    },
    routineName: {
      fontSize: 17,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    routineStats: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    createRoutineContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    createRoutineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    createRoutineText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
  })
