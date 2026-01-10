import { ScreenHeader } from '@/components/screen-header'
import { SlideInView } from '@/components/slide-in-view'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import type { ExploreRoutine, ExploreProgramWithRoutines } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

export default function ExploreScreen() {
  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const { trackEvent } = useAnalytics()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [programs, setPrograms] = useState<(ExploreProgramWithRoutines & { routine_count: number })[]>([])
  const [routines, setRoutines] = useState<ExploreRoutine[]>([])
  const [savingRoutineId, setSavingRoutineId] = useState<string | null>(null)
  const [shouldExit, setShouldExit] = useState(false)

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark])

  const loadData = useCallback(async () => {
    try {
      const [programsData, routinesData] = await Promise.all([
        database.explore.getPrograms(),
        database.explore.getRoutines(),
      ])
      setPrograms(programsData)
      setRoutines(routinesData)
    } catch (error) {
      console.error('Error loading explore content:', error)
      Alert.alert('Error', 'Failed to load explore content')
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    trackEvent(AnalyticsEvents.EXPLORE_VIEWED)
    loadData()
  }, [loadData, trackEvent])

  const handleBack = useCallback(() => {
    setShouldExit(true)
  }, [])

  const handleExitComplete = useCallback(() => {
    router.back()
  }, [router])

  const handleSaveRoutine = useCallback(
    async (routineId: string) => {
      if (!user) {
        Alert.alert(
          'Sign In Required',
          'Please create an account to save routines.',
        )
        return
      }

      try {
        setSavingRoutineId(routineId)
        await database.explore.saveRoutineToUser(routineId, user.id)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert('Success', 'Routine saved to your workouts!')
      } catch (error) {
        console.error('Error saving routine:', error)
        Alert.alert('Error', 'Failed to save routine. Please try again.')
      } finally {
        setSavingRoutineId(null)
      }
    },
    [user],
  )

  const renderProgramCard = useCallback(
    ({ item }: { item: ExploreProgramWithRoutines & { routine_count: number } }) => {
      const GRADIENTS = [
        ['#2563EB', '#3B82F6'], // Blue
        ['#7C3AED', '#8B5CF6'], // Purple
        ['#EA580C', '#F97316'], // Orange
        ['#059669', '#10B981'], // Emerald
      ]
      const gradient = (GRADIENTS[
        (item.display_order - 1) % GRADIENTS.length
      ] || GRADIENTS[0]) as [string, string, ...string[]]

      let iconName = 'barbell-outline'
      if (item.name.toLowerCase().includes('body')) iconName = 'body-outline'
      if (item.name.toLowerCase().includes('cardio'))
        iconName = 'fitness-outline'
      if (item.name.toLowerCase().includes('strength'))
        iconName = 'flash-outline'

      return (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.programCard}
          onPress={() => {
            trackEvent(AnalyticsEvents.EXPLORE_CARD_TAPPED, {
              card_type: 'program',
              destination: item.id,
            })
            router.push({
              pathname: '/explore/program/[programId]',
              params: { programId: item.id },
            })
          }}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.programGradient}
          >
            <View style={styles.programIconContainer}>
              <Ionicons name={iconName as any} size={28} color="#FFF" />
            </View>
            <View style={styles.programContent}>
              <Text style={styles.programTitle} numberOfLines={2}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={styles.programSubtitle} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
              <View style={styles.programFooter}>
                <Text style={styles.programCount}>
                  {item.routine_count} routines
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color="rgba(255,255,255,0.8)"
                />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )
    },
    [styles, router, trackEvent],
  )

  const renderRoutineItem = useCallback(
    ({ item, index }: { item: ExploreRoutine; index: number }) => {
      const isSaving = savingRoutineId === item.id
      const tintColors = ['#A3E635', '#22D3EE', '#94A3B8', '#F0ABFC', '#FB923C']
      const tintColor = tintColors[index % tintColors.length]

      const getRoutineImage = (routine: ExploreRoutine) => {
        // If the database already has a full URL, use it
        if (routine.image_url && routine.image_url.startsWith('http')) {
          return routine.image_url
        }
        
        // Otherwise, construct a URL from the storage bucket based on the image_url (path) or name
        const imagePath = routine.image_url || `${routine.name}.png`
        return getRoutineImageUrl(imagePath)
      }

      return (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.routineCard}
          onPress={() => {
            trackEvent(AnalyticsEvents.EXPLORE_CARD_TAPPED, {
              card_type: 'routine',
              destination: item.id,
            })
            router.push({
              pathname: '/routine/[routineId]',
              params: { routineId: item.id },
            })
          }}
        >
          <Image
            source={getRoutineImage(item)}
            style={styles.routineImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="normal"
            transition={200}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
            style={styles.routineOverlay}
          />
          <View
            style={[
              styles.colorTint,
              { backgroundColor: tintColor, opacity: 0.25 },
            ]}
          />
          <View style={styles.routineContent}>
            <Text style={styles.routineTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.premiumContainer}>
              <Text style={[styles.premiumText, { color: tintColor }]}>
                Pro
              </Text>
              <Ionicons name="star" size={12} color={tintColor} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonLoading]}
            onPress={() => handleSaveRoutine(item.id)}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="add" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      )
    },
    [styles, handleSaveRoutine, savingRoutineId, router, trackEvent],
  )

  return (
    <SlideInView
      style={{ flex: 1 }}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Explore"
          onLeftPress={handleBack}
          leftIcon="arrow-back"
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadData()
              }}
              tintColor={colors.primary}
            />
          }
        >


          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Programs Section */}
              {programs.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Programs</Text>
                  </View>

                  <FlatList
                    horizontal
                    data={programs}
                    renderItem={renderProgramCard}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.programsList}
                    snapToInterval={width * 0.8 + 16}
                    decelerationRate="fast"
                  />
                </>
              )}

              {/* Routines Grid */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Routines</Text>
              </View>

              <View style={styles.routinesGrid}>
                {routines.map((routine, index) => (
                  <View key={routine.id} style={styles.routineWrapper}>
                    {renderRoutineItem({ item: routine, index })}
                  </View>
                ))}
                {routines.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={{ color: colors.textSecondary }}>
                      No routines found
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SlideInView>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 100,
    },


    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 200,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 16,
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    programsList: {
      paddingHorizontal: 20,
      gap: 16,
    },
    programCard: {
      width: width * 0.8,
      height: 160,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    programGradient: {
      flex: 1,
      padding: 20,
      justifyContent: 'space-between',
    },
    programIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    programContent: {
      gap: 4,
    },
    programTitle: {
      color: '#FFF',
      fontSize: 24,
      fontWeight: '800',
      fontStyle: 'italic',
    },
    programSubtitle: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      fontWeight: '500',
    },
    programFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    programCount: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      fontWeight: '600',
    },
    routinesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      gap: 16,
      paddingTop: 12,
    },
    routineWrapper: {
      width: (width - 56) / 2,
      marginBottom: 8,
    },
    routineCard: {
      height: 240,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.feedCardBackground,
    },
    routineImage: {
      width: '100%',
      height: '100%',
      position: 'absolute',
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
      padding: 16,
      paddingBottom: 20,
    },
    routineTitle: {
      color: '#FFF',
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    premiumContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    premiumText: {
      fontSize: 12,
      fontWeight: '700',
    },
    saveButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveButtonLoading: {
      backgroundColor: 'rgba(255,255,255,0.4)',
    },
    emptyState: {
      width: '100%',
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
