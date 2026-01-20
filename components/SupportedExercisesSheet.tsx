import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import {
  EXERCISES_WITH_STANDARDS,
  ExerciseGroup,
  getExerciseGroup,
} from '@/lib/exercise-standards-config'
import { Exercise } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface SupportedExercisesSheetProps {
  isVisible: boolean
  onClose: () => void
}

export function SupportedExercisesSheet({
  isVisible,
  onClose,
}: SupportedExercisesSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const styles = createStyles(colors, insets)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isVisible) {
      const loadExercises = async () => {
        setIsLoading(true)
        try {
          const allExercises = await database.exercises.getAll()
          setExercises(allExercises)
        } catch (error) {
          console.error('Error loading exercises:', error)
        } finally {
          setIsLoading(false)
        }
      }
      loadExercises()
    }
  }, [isVisible])

  const exerciseMap = React.useMemo(() => {
    const map = new Map<string, string>()
    exercises.forEach((ex) => {
      map.set(ex.name, ex.id)
    })
    return map
  }, [exercises])

  const groupedExercises = React.useMemo(() => {
    const groups: Record<ExerciseGroup, { name: string; id?: string }[]> = {
      Push: [],
      Pull: [],
      Lower: [],
      Other: [],
    }

    EXERCISES_WITH_STANDARDS.forEach((ex) => {
      const group = getExerciseGroup(ex.name)
      groups[group].push({
        name: ex.name,
        id: exerciseMap.get(ex.name),
      })
    })

    return Object.entries(groups).filter(
      ([_, exList]) => exList.length > 0,
    ) as [ExerciseGroup, { name: string; id?: string }[]][]
  }, [exerciseMap])

  const handleExercisePress = (id?: string) => {
    if (id) {
      onClose()
      router.push({
        pathname: '/exercise/[exerciseId]',
        params: { exerciseId: id },
      })
    }
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Supported Exercises</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Track these exercises to calculate your strength standards and
            lifter level.
          </Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              </View>
            ) : (
              groupedExercises.map(([group, exList]) => (
                <View key={group} style={styles.groupSection}>
                  <View style={styles.groupHeader}>
                    <Ionicons
                      name={
                        group === 'Lower'
                          ? 'arrow-down-outline'
                          : group === 'Push'
                          ? 'arrow-forward-outline'
                          : 'arrow-back-outline'
                      }
                      size={18}
                      color={colors.brandPrimary}
                    />
                    <Text style={styles.groupTitle}>{group}</Text>
                  </View>
                  <View style={styles.exerciseList}>
                    {exList.map((ex, index) => (
                      <TouchableOpacity
                        key={ex.name}
                        style={[
                          styles.exerciseRow,
                          index === exList.length - 1 && styles.lastExerciseRow,
                        ]}
                        onPress={() => handleExercisePress(ex.id)}
                        disabled={!ex.id}
                      >
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={colors.textPlaceholder}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetContent: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
      paddingBottom: insets.bottom + 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      paddingHorizontal: 20,
      paddingVertical: 16,
      lineHeight: 20,
    },
    scrollView: {
      paddingHorizontal: 20,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    groupSection: {
      marginBottom: 24,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    groupTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    exerciseList: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    exerciseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lastExerciseRow: {
      borderBottomWidth: 0,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  })
