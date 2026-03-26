import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useRoutineSelection } from '@/hooks/useRoutineSelection'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { UserProgram, WorkoutRoutineWithDetails } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function RoutinesScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { trackEvent } = useAnalytics()
  const { callCallback } = useRoutineSelection()

  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [programs, setPrograms] = useState<UserProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shouldExit, setShouldExit] = useState(false)

  const [activeTab, setActiveTab] = useState<'Routines' | 'Programs'>(
    'Programs',
  )

  const { isDark } = useTheme()
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

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

  useEffect(() => {
    loadRoutines()
  }, [loadRoutines])

  useEffect(() => {
    trackEvent(AnalyticsEvents.ROUTINES_VIEWED)
  }, [trackEvent])

  useFocusEffect(
    useCallback(() => {
      loadRoutines()
    }, [loadRoutines]),
  )

  const handleBack = useCallback(() => {
    haptic('light')
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const renderTabHeader = () => {
    const tabs = ['Programs', 'Routines'] as const
    return (
      <View style={styles.tabHeaderContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabButton,
              activeTab === tab && styles.tabButtonActive,
            ]}
            onPress={() => {
              haptic('light')
              setActiveTab(tab)
            }}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab && styles.tabButtonTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  const renderSearchBar = () => (
    <View style={styles.searchBarContainer}>
      <View
        style={[
          styles.searchBarBg,
          { backgroundColor: colors.surfaceSubtle || 'rgba(150,150,150,0.1)' },
        ]}
      >
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search"
          placeholderTextColor={colors.textSecondary}
        />
      </View>
    </View>
  )

  const renderProgramsContent = () => {
    const programGroups = programs.map((program) => ({
      program,
      routinesCount: routines.filter((r) => r.program_id === program.id).length,
    }))

    return (
      <View style={styles.listContainer}>
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => {
            haptic('light')
            router.push('/explore')
          }}
        >
          <View style={[styles.listIconContainer, { borderRadius: 32 }]}>
            <Ionicons name="add" size={28} color={colors.textPrimary} />
          </View>
          <Text style={styles.listTitle}>Add new program</Text>
        </TouchableOpacity>

        {/* User Programs */}
        {programGroups.map(({ program, routinesCount }) => {
          const imageSource = program.image_path
            ? getRoutineImageUrl(program.image_path)
            : null

          return (
            <TouchableOpacity
              key={program.id}
              style={styles.listItem}
              onPress={() => {
                haptic('light')
                router.push({
                  pathname: '/explore/program/[programId]',
                  params: { programId: program.id },
                })
              }}
            >
              <View style={[styles.listIconContainer, { borderRadius: 8 }]}>
                {imageSource ? (
                  <Image
                    source={{ uri: imageSource as string }}
                    style={styles.programImage}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons
                    name="albums-outline"
                    size={24}
                    color={colors.textPrimary}
                  />
                )}
              </View>
              <View style={styles.listTextContainer}>
                <Text style={styles.listTitle}>{program.name}</Text>
                <Text style={styles.listSubtitle}>
                  {routinesCount} Workouts
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textTertiary}
                opacity={0.5}
              />
            </TouchableOpacity>
          )
        })}
      </View>
    )
  }

  const renderRoutinesContent = () => {
    const standaloneRoutines = routines.filter((r) => !r.program_id)
    return (
      <View style={styles.listContainer}>
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => router.push('/explore')}
        >
          <View style={[styles.listIconContainer, { borderRadius: 32 }]}>
            <Ionicons name="add" size={28} color={colors.textPrimary} />
          </View>
          <Text style={styles.listTitle}>Add new routine</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.listItem}
          onPress={() => router.push('/create-routine')}
        >
          <View style={[styles.listIconContainer, { borderRadius: 32 }]}>
            <Ionicons name="add" size={28} color={colors.textPrimary} />
          </View>
          <Text style={styles.listTitle}>Create new routine</Text>
        </TouchableOpacity>

        {standaloneRoutines.map((routine) => {
          const imageSource = routine.image_path
            ? getRoutineImageUrl(routine.image_path)
            : null
          return (
            <TouchableOpacity
              key={routine.id}
              style={styles.listItem}
              onPress={() => {
                haptic('light')
                router.push({
                  pathname: '/routine/[routineId]',
                  params: { routineId: routine.id },
                })
              }}
            >
              <View style={[styles.listIconContainer, { borderRadius: 8 }]}>
                {imageSource ? (
                  <Image
                    source={{ uri: imageSource as string }}
                    style={styles.programImage}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons
                    name="barbell-outline"
                    size={24}
                    color={colors.textPrimary}
                  />
                )}
              </View>
              <View style={styles.listTextContainer}>
                <Text style={styles.listTitle}>{routine.name}</Text>
                <Text style={styles.listSubtitle}>Routine</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textTertiary}
                opacity={0.5}
              />
            </TouchableOpacity>
          )
        })}
      </View>
    )
  }

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <BlurredHeader>
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity
                  onPress={() => setShouldExit(true)}
                  style={styles.navButton}
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerGlass={false}
            centerContent={<Text style={styles.headerTitle}>My Library</Text>}
          />
        </BlurredHeader>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 100,
            paddingTop: insets.top + 76,
          }}
          showsVerticalScrollIndicator={false}
        >
          {renderSearchBar()}

          {renderTabHeader()}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : (
            <>
              {activeTab === 'Programs' && renderProgramsContent()}
              {activeTab === 'Routines' && renderRoutinesContent()}
            </>
          )}
        </ScrollView>
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    headerBack: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    navButton: {
      padding: 8,
      borderRadius: 20,
    },
    headerAdd: {
      padding: 4,
    },
    tabHeaderContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 24,
      marginBottom: 24,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tabButton: {
      paddingBottom: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabButtonActive: {
      borderBottomColor: colors.textPrimary,
    },
    tabButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    tabButtonTextActive: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    listContainer: {
      paddingHorizontal: 16,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 16,
    },
    listIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 8,
      backgroundColor: colors.surfaceSubtle || 'rgba(150,150,150,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    programImage: {
      width: '100%',
      height: '100%',
    },
    listTextContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    listTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    listSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '400',
    },
    searchBarContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    searchBarBg: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
    },
  })
