import { BlurredHeader } from '@/components/blurred-header'
import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { EQUIPMENT_PREF_KEY } from '@/components/workout-planning-wizard'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useProfile } from '@/contexts/profile-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import {
  parseStoredEquipmentPreference,
  sortProgramsByPopularity,
  sortProgramsForUser,
} from '@/lib/utils/explore-recommendations'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import type { ExploreProgramWithRoutines, ExploreRoutine } from '@/types/database.types'
import { fuzzySearchPrograms, fuzzySearchExploreRoutines } from '@/lib/utils/fuzzy-search'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  useDeferredValue,
} from 'react'
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MUSCLE_CHIP_RENDER_DATA } from '@/lib/muscle-mapping'
import Body from '@/components/PatchedBodyHighlighter'

const { width } = Dimensions.get('window')
type ExploreTab = 'Programs' | 'Routines' | 'Exercises'

const PROGRAM_GRADIENTS = [
  ['#2563EB', '#3B82F6'],
  ['#7C3AED', '#8B5CF6'],
  ['#EA580C', '#F97316'],
  ['#059669', '#10B981'],
] as const

const TAB_CONFIG: {
  key: ExploreTab
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { key: 'Programs', icon: 'calendar-outline' },
  { key: 'Routines', icon: 'albums-outline' },
  { key: 'Exercises', icon: 'barbell-outline' },
]

const ExploreTabButton = memo(function ExploreTabButton({
  tab,
  icon,
  isActive,
  onPress,
  colors,
  styles,
}: {
  tab: ExploreTab
  icon: keyof typeof Ionicons.glyphMap
  isActive: boolean
  onPress: () => void
  colors: ReturnType<typeof useThemedColors>
  styles: any
}) {
  return (
    <Pressable
      style={[
        styles.tabButton,
        isActive && { borderBottomColor: colors.textPrimary },
      ]}
      onPress={onPress}
      hitSlop={8}
    >
      <Ionicons
        name={icon}
        size={24}
        color={isActive ? colors.textPrimary : colors.textSecondary}
      />
      <Text
        style={[
          styles.tabButtonText,
          isActive
            ? { color: colors.textPrimary, fontWeight: '700' }
            : { color: colors.textSecondary },
        ]}
      >
        {tab}
      </Text>
    </Pressable>
  )
})

const ExploreProgramCard = memo(function ExploreProgramCard({
  item,
  colors,
  onPress,
  styles,
}: {
  item: ExploreProgramWithRoutines & { routine_count: number }
  colors: ReturnType<typeof useThemedColors>
  onPress: () => void
  styles: any
}) {
  const gradient =
    PROGRAM_GRADIENTS[(item.display_order - 1) % PROGRAM_GRADIENTS.length] ??
    PROGRAM_GRADIENTS[0]

  return (
    <Pressable
      style={styles.programCardWrapper}
      onPress={onPress}
    >
      <View style={styles.programCardImageContainer}>
        <LinearGradient colors={[...gradient]} style={styles.programGradient}>
          <Text style={styles.programIconText}>{item.name}</Text>
        </LinearGradient>
      </View>

      <View style={styles.programContent}>
        <Text
          style={[styles.programTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </View>
    </Pressable>
  )
})

const ExploreRoutineCard = memo(function ExploreRoutineCard({
  item,
  colors,
  onPress,
  styles,
}: {
  item: ExploreRoutine
  colors: ReturnType<typeof useThemedColors>
  onPress: () => void
  styles: any
}) {
  const imagePath = item.image_url ? getRoutineImageUrl(item.image_url) : null

  return (
    <Pressable style={styles.routineCardWrapper} onPress={onPress}>
      <View style={styles.routineCardImageContainer}>
        {imagePath ? (
          <Image
            source={{ uri: imagePath as string }}
            style={styles.programImage}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.programImage,
              styles.routineFallback,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <Ionicons
              name="albums-outline"
              size={32}
              color={colors.textTertiary}
            />
          </View>
        )}
      </View>
      <View style={styles.programContent}>
        <Text
          style={[styles.programTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={styles.programSubtitle} numberOfLines={1}>
          {item.level || 'All Levels'} • {item.duration_minutes || 45}m
        </Text>
      </View>
    </Pressable>
  )
})

const ExploreMuscleCard = memo(function ExploreMuscleCard({
  chipData,
  colors,
  isDark,
  onPress,
  styles,
}: {
  chipData: (typeof MUSCLE_CHIP_RENDER_DATA)[number]
  colors: ReturnType<typeof useThemedColors>
  isDark: boolean
  onPress: () => void
  styles: any
}) {
  return (
    <Pressable
      style={styles.muscleGridItem}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={`${chipData.group} exercises`}
      onPress={onPress}
    >
      <View
        pointerEvents="none"
        style={[styles.muscleBodyContainer, { backgroundColor: colors.bg }]}
      >
        <View
          style={[
            styles.muscleBodyWrapper,
            { transform: [{ scale: 1.8 }, { translateY: chipData.offsetY }] },
          ]}
        >
          <Body
            data={chipData.bodyData}
            gender="male"
            side={chipData.side}
            scale={chipData.scale}
            colors={['#EF4444']}
            border={isDark ? '#333' : '#E5E5EA'}
          />
        </View>
      </View>
      <Text
        pointerEvents="none"
        style={[styles.muscleGridItemText, { color: colors.textPrimary }]}
      >
        {chipData.group}
      </Text>
    </Pressable>
  )
})

export default function ExploreScreen() {
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const insets = useSafeAreaInsets()
  const { profile } = useProfile()

  const [isLoading, setIsLoading] = useState(true)
  const [programs, setPrograms] = useState<(ExploreProgramWithRoutines & { routine_count: number })[]>([])
  const [routines, setRoutines] = useState<ExploreRoutine[]>([])
  const [shouldExit, setShouldExit] = useState(false)
  const [equipmentPreference, setEquipmentPreference] = useState<ReturnType<typeof parseStoredEquipmentPreference>>(null)
  
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])
  const [activeTab, setActiveTab] = useState<ExploreTab>('Programs')
  const [contentTab, setContentTab] = useState<ExploreTab>('Programs')
  const [isTabPending, startTabTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const searchQueryRef = useRef(searchQuery)

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  const loadData = useCallback(async () => {
    try {
      const [programsData, routinesData] = await Promise.all([
        database.explore.getPrograms(),
        database.explore.getRoutines()
      ])
      setPrograms(programsData)
      setRoutines(routinesData)
    } catch (error) {
      console.error('Error loading explore content:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    trackEvent(AnalyticsEvents.EXPLORE_VIEWED)
    loadData()
  }, [loadData, trackEvent])

  useEffect(() => {
    let isMounted = true

    AsyncStorage.getItem(EQUIPMENT_PREF_KEY)
      .then((storedPreference) => {
        if (!isMounted) return
        setEquipmentPreference(parseStoredEquipmentPreference(storedPreference))
      })
      .catch((error) => {
        console.warn('[Explore] Failed to load equipment preference', error)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const handleTabPress = useCallback(
    (tab: ExploreTab) => {
      if (tab === activeTab && tab === contentTab) return
      haptic('light')
      setActiveTab(tab)
      startTabTransition(() => {
        setContentTab(tab)
      })
    },
    [activeTab, contentTab],
  )

  const handleOpenProgram = useCallback(
    (programId: string) => {
      trackEvent(AnalyticsEvents.EXPLORE_CARD_TAPPED, {
        card_type: 'program',
        destination: programId,
      })
      router.push({
        pathname: '/explore/program/[programId]',
        params: { programId },
      })
    },
    [router, trackEvent],
  )

  const handleOpenRoutine = useCallback(
    (routineId: string) => {
      router.push({
        pathname: '/routine/[routineId]',
        params: { routineId },
      })
    },
    [router],
  )

  const handleOpenExerciseGroup = useCallback(
    (group: string) => {
      router.push({
        pathname: '/select-exercise',
        params: {
          exploreMode: 'true',
          initialMuscleGroup: group,
          initialSearchQuery: searchQueryRef.current,
        },
      })
    },
    [router],
  )

  const handleExerciseSearchSubmit = useCallback(() => {
    const trimmedQuery = searchQueryRef.current.trim()
    if (activeTab !== 'Exercises' || !trimmedQuery) return

    router.push({
      pathname: '/select-exercise',
      params: {
        exploreMode: 'true',
        initialSearchQuery: trimmedQuery,
      },
    })
  }, [activeTab, router])

  const renderProgramCard = useCallback(
    ({ item }: { item: ExploreProgramWithRoutines & { routine_count: number } }) => (
      <ExploreProgramCard
        item={item}
        colors={colors}
        styles={styles}
        onPress={() => handleOpenProgram(item.id)}
      />
    ),
    [colors, handleOpenProgram],
  )

  const renderRoutineCard = useCallback(
    ({ item }: { item: ExploreRoutine }) => (
      <ExploreRoutineCard
        item={item}
        colors={colors}
        styles={styles}
        onPress={() => handleOpenRoutine(item.id)}
      />
    ),
    [colors, handleOpenRoutine],
  )

  const filteredPrograms = useMemo(() => {
    return fuzzySearchPrograms(programs, deferredSearchQuery)
  }, [programs, deferredSearchQuery])

  const popularPrograms = useMemo(() => {
    return sortProgramsByPopularity(filteredPrograms)
  }, [filteredPrograms])

  const recommendedPrograms = useMemo(() => {
    const sorted = sortProgramsForUser(filteredPrograms, {
      profile,
      equipmentPreference,
    })
    const topPopularIds = new Set(
      popularPrograms
        .slice(0, Math.min(2, Math.max(0, popularPrograms.length - 1)))
        .map((program) => program.id),
    )
    const deduped = sorted.filter((program) => !topPopularIds.has(program.id))

    return deduped.length > 0 ? deduped : sorted
  }, [equipmentPreference, filteredPrograms, popularPrograms, profile])

  const filteredRoutines = useMemo(() => {
    return fuzzySearchExploreRoutines(routines, deferredSearchQuery)
  }, [routines, deferredSearchQuery])

  const renderContent = useCallback(() => {

    if (contentTab === 'Exercises') {
      return (
        <View>
           <View style={[styles.sectionHeader, { paddingHorizontal: 16 }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Muscle Groups</Text>
           </View>
           <View style={styles.muscleGrid}>
             {MUSCLE_CHIP_RENDER_DATA.map((chipData) => (
               <ExploreMuscleCard
                 key={chipData.group}
                 chipData={chipData}
                 colors={colors}
                 isDark={isDark}
                 styles={styles}
                 onPress={() => handleOpenExerciseGroup(chipData.group)}
               />
             ))}
           </View>
        </View>
      )
    }

    if (contentTab === 'Routines') {
      return (
        <View style={{ paddingHorizontal: 16 }}>
           <View style={[styles.sectionHeader, { paddingHorizontal: 0 }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>All Routines</Text>
           </View>
           <FlatList
             key="routines_grid"
             data={filteredRoutines}
             renderItem={renderRoutineCard}
             keyExtractor={(item) => item.id}
             numColumns={2}
             columnWrapperStyle={{ gap: 16 }}
             scrollEnabled={false}
             contentContainerStyle={{ paddingBottom: 20 }}
           />
        </View>
      )
    }

    return (
      <View>
         <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Popular Programs</Text>
         </View>
         <FlatList
           key="popular_programs_horizontal"
           horizontal
           data={popularPrograms.length > 0 ? popularPrograms : filteredPrograms}
           renderItem={renderProgramCard}
           keyExtractor={(item) => item.id}
           showsHorizontalScrollIndicator={false}
           contentContainerStyle={styles.programsList}
           snapToInterval={width * 0.45 + 16}
           decelerationRate="fast"
         />

         <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recommended For You</Text>
         </View>
         <FlatList
           key="recommended_programs_horizontal"
           horizontal
           data={recommendedPrograms.length > 0 ? recommendedPrograms : filteredPrograms}
           renderItem={renderProgramCard}
           keyExtractor={(item) => item.id}
           showsHorizontalScrollIndicator={false}
           contentContainerStyle={styles.programsList}
           snapToInterval={width * 0.45 + 16}
           decelerationRate="fast"
         />
      </View>
    )
  }, [
    colors,
    contentTab,
    filteredPrograms,
    filteredRoutines,
    handleOpenExerciseGroup,
    isDark,
    popularPrograms,
    recommendedPrograms,
    renderProgramCard,
    renderRoutineCard,
  ])

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
                <Pressable onPress={() => setShouldExit(true)} style={styles.navButton}>
                  <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </Pressable>
              </NavbarIsland>
            }
            centerGlass={false}
            centerContent={
              <Text style={styles.headerTitle}>Explore</Text>
            }
          />
        </BlurredHeader>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingBottom: insets.bottom + 100,
            paddingTop: insets.top + 76
          }}
        >
          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
             <View style={[styles.searchBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f3f3' }]}>
                <Ionicons name="search" size={20} color={colors.textSecondary} />
                <TextInput 
                   style={[styles.searchInput, { color: colors.textPrimary }]}
                   placeholder={`Search for ${activeTab.toLowerCase()}`}
                   placeholderTextColor={colors.textSecondary} 
                   value={searchQuery}
                   onChangeText={setSearchQuery}
                   onSubmitEditing={handleExerciseSearchSubmit}
                   autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
             </View>
          </View>

          <View style={styles.tabHeaderContainer}>
            {TAB_CONFIG.map(({ key, icon }) => (
              <ExploreTabButton
                key={key}
                tab={key}
                icon={icon}
                isActive={activeTab === key}
                onPress={() => handleTabPress(key)}
                colors={colors}
                styles={styles}
              />
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : (
            <View style={[styles.contentContainer, isTabPending && styles.contentPending]}>
              {renderContent()}
            </View>
          )}
        </ScrollView>
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  exploreHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  searchBarBg: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
  },
  tabHeaderContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.18)',
  },
  tabButton: {
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    gap: 4,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    opacity: 1,
  },
  contentPending: {
    opacity: 0.88,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  programsList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  programCardWrapper: {
    width: width * 0.45,
    marginBottom: 8,
  },
  routineCardWrapper: {
    flex: 1,
    marginBottom: 16,
  },
  routineCardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  programCardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  programImage: {
    width: '100%',
    height: '100%',
  },
  routineFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  programGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  programIconText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  programContent: {
    paddingHorizontal: 4,
  },
  programTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  programSubtitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 16,
  },
  muscleGridItem: {
    width: Math.floor((width - 32 - 32) / 3), // 3 columns, 32px total horizontal padding, 32px total gap (16px * 2)
    alignItems: 'center',
    marginBottom: 24,
  },
  muscleBodyContainer: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 8,
    borderRadius: 60, // Large enough to make it circular
  },
  muscleBodyWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 240,
    marginTop: -120,
    marginLeft: -60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleGridItemText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
})
