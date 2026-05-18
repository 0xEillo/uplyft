import { BaseNavbar } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { SlideInView } from '@/components/slide-in-view'
import { Layout } from '@/constants/theme'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { hapticSuccess } from '@/lib/haptics'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function CreateProgramScreen() {
  const router = useRouter()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [programName, setProgramName] = useState('')
  const [programDescription, setProgramDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)

  const [availableRoutines, setAvailableRoutines] = useState<
    WorkoutRoutineWithDetails[]
  >([])
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(true)
  const [selectedRoutineIds, setSelectedRoutineIds] = useState<Set<string>>(
    () => new Set(),
  )

  const styles = useMemo(() => createStyles(colors), [colors])
  const NAVBAR_HEIGHT = Layout.navbarHeight

  useEffect(() => {
    if (!user) {
      setIsLoadingRoutines(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const all = await database.workoutRoutines.getAll(user.id)
        if (cancelled) return
        // Only routines that aren't already in a program can be added here.
        // Re-assigning routines from one program to another is handled elsewhere.
        setAvailableRoutines(all.filter((r) => !r.program_id))
      } catch (error) {
        console.error('Error loading routines for program selection:', error)
      } finally {
        if (!cancelled) setIsLoadingRoutines(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleCancel = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const toggleRoutine = useCallback((routineId: string) => {
    setSelectedRoutineIds((prev) => {
      const next = new Set(prev)
      if (next.has(routineId)) next.delete(routineId)
      else next.add(routineId)
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!user) {
      Alert.alert('Error', 'You need to be signed in to create a program.')
      return
    }

    const trimmedName = programName.trim()
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please give your program a name.')
      return
    }

    try {
      setIsSaving(true)
      const created = await database.userPrograms.create(user.id, trimmedName, {
        description: programDescription.trim() || undefined,
      })

      // Assign every selected routine to the new program. Run in parallel —
      // failures shouldn't block the create (the program already exists).
      if (selectedRoutineIds.size > 0) {
        const assignments = Array.from(selectedRoutineIds).map((id) =>
          database.workoutRoutines
            .update(id, { program_id: created.id })
            .catch((e) => {
              console.error('Failed to assign routine to program', id, e)
            }),
        )
        await Promise.all(assignments)
      }

      hapticSuccess()
      router.replace({
        pathname: '/explore/program/[programId]',
        params: { programId: created.id },
      })
    } catch (error) {
      console.error('Error creating program:', error)
      Alert.alert('Error', 'Failed to create program. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [
    programDescription,
    programName,
    router,
    selectedRoutineIds,
    user,
  ])

  const renderRoutineRow = (routine: WorkoutRoutineWithDetails) => {
    const isSelected = selectedRoutineIds.has(routine.id)
    const imageSource = routine.image_path
      ? getRoutineImageUrl(routine.image_path)
      : null
    const exerciseCount = routine.workout_routine_exercises?.length ?? 0

    return (
      <TouchableOpacity
        key={routine.id}
        style={[
          styles.routineRow,
          isSelected && {
            borderColor: colors.brandPrimary,
            backgroundColor: colors.brandPrimarySoft,
          },
        ]}
        activeOpacity={0.85}
        onPress={() => toggleRoutine(routine.id)}
      >
        <View style={styles.routineIconContainer}>
          {imageSource ? (
            <Image
              source={{ uri: imageSource as string }}
              style={styles.routineImage}
              contentFit="cover"
            />
          ) : (
            <Ionicons
              name="barbell-outline"
              size={22}
              color={colors.textPrimary}
            />
          )}
        </View>
        <View style={styles.routineTextContainer}>
          <Text style={styles.routineTitle} numberOfLines={1}>
            {routine.name}
          </Text>
          <Text style={styles.routineSubtitle} numberOfLines={1}>
            {exerciseCount === 1
              ? '1 exercise'
              : `${exerciseCount} exercises`}
          </Text>
        </View>
        <View
          style={[
            styles.checkCircle,
            isSelected
              ? {
                  backgroundColor: colors.brandPrimary,
                  borderColor: colors.brandPrimary,
                }
              : { borderColor: colors.border },
          ]}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SlideInView
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
      style={styles.container}
    >
      <View style={styles.container}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <TouchableOpacity onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            }
            centerGlass={false}
            centerContent={
              <Text style={styles.headerTitle}>Create Program</Text>
            }
            rightContent={
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving || !programName.trim()}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                ) : (
                  <Text
                    style={[
                      styles.saveText,
                      !programName.trim() && styles.saveTextDisabled,
                    ]}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            }
          />
        </BlurredHeader>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={{
              paddingTop: insets.top + NAVBAR_HEIGHT,
              paddingBottom: insets.bottom + 40,
            }}
            scrollIndicatorInsets={{ top: insets.top + NAVBAR_HEIGHT }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Program Name</Text>
              <TextInput
                style={styles.input}
                value={programName}
                onChangeText={setProgramName}
                placeholder="e.g., Push Pull Legs, 4-Day Split"
                placeholderTextColor={colors.textPlaceholder}
                autoCapitalize="words"
                autoFocus
                returnKeyType="next"
                maxLength={80}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={programDescription}
                onChangeText={setProgramDescription}
                placeholder="What's this program about? Goals, weekly structure, anything worth remembering…"
                placeholderTextColor={colors.textPlaceholder}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Routines</Text>
                {selectedRoutineIds.size > 0 && (
                  <Text style={styles.selectionCount}>
                    {selectedRoutineIds.size} selected
                  </Text>
                )}
              </View>

              {isLoadingRoutines ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                </View>
              ) : availableRoutines.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="barbell-outline"
                    size={28}
                    color={colors.textTertiary}
                  />
                  <Text style={styles.emptyStateTitle}>
                    No routines available
                  </Text>
                  <Text style={styles.emptyStateBody}>
                    Create a routine first, then come back to group it into a
                    program.
                  </Text>
                </View>
              ) : (
                <View style={styles.routineList}>
                  {availableRoutines.map(renderRoutineRow)}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    flex: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.textPrimary,
    },
    cancelText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    saveText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.brandPrimary,
      textAlign: 'right',
    },
    saveTextDisabled: {
      opacity: 0.4,
    },
    content: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    section: {
      padding: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    selectionCount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.brandPrimary,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 16,
      lineHeight: 20,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    routineList: {
      gap: 10,
    },
    routineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    routineIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: colors.surfaceSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    routineImage: {
      width: '100%',
      height: '100%',
    },
    routineTextContainer: {
      flex: 1,
      minWidth: 0,
    },
    routineTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    routineSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    checkCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingRow: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyState: {
      paddingVertical: 24,
      paddingHorizontal: 16,
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    emptyStateTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    emptyStateBody: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  })
