import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
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
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [programs, setPrograms] = useState<any[]>([])
  const [routines, setRoutines] = useState<any[]>([])
  const [savingRoutineId, setSavingRoutineId] = useState<string | null>(null)

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
    loadData()
  }, [loadData])

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
    ({ item }: { item: any }) => {
      // Determine gradient based on generic logic or hardcoded for now since DB doesn't store colors yet
      // Using display_order to rotate colors for variety
      const GRADIENTS = [
        ['#2563EB', '#3B82F6'], // Blue
        ['#7C3AED', '#8B5CF6'], // Purple
        ['#EA580C', '#F97316'], // Orange
        ['#059669', '#10B981'], // Emerald
      ]
      const gradient = (GRADIENTS[
        (item.display_order - 1) % GRADIENTS.length
      ] || GRADIENTS[0]) as [string, string, ...string[]]

      // Choose icon based on name keywords
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
          onPress={() => router.push({
            pathname: '/explore/program/[programId]',
            params: { programId: item.id }
          })}
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
    [styles],
  )

  const renderRoutineItem = useCallback(
    ({ item }: { item: any }) => {
      const isSaving = savingRoutineId === item.id

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.routineCard}
          onPress={() => router.push({
            pathname: '/explore/routine/[routineId]',
            params: { routineId: item.id }
          })}
        >
          <Image
            source={{
              uri:
                item.image_url ||
                'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2940&auto=format&fit=crop',
            }}
            style={styles.routineImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)'] as const}
            style={styles.routineOverlay}
          />
          <View style={styles.routineContent}>
            <Text style={styles.routineTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.routineMeta}>

              {item.duration_minutes && (
                <View style={styles.routineTag}>
                  <Ionicons name="time-outline" size={12} color="#FFF" />
                  <Text style={styles.routineTagText}>
                    {item.duration_minutes}m
                  </Text>
                </View>
              )}
              {/* Quick Save Button on Card */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isSaving && styles.saveButtonLoading,
                ]}
                onPress={() => handleSaveRoutine(item.id)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="add" size={16} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )
    },
    [styles, handleSaveRoutine, savingRoutineId],
  )

  return (
    <View style={styles.container}>
      <View style={[styles.navbarContainer, { paddingTop: insets.top }]}>
        <BaseNavbar
          leftContent={
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          }
          centerContent={
            <NavbarIsland>
              <Text style={styles.headerTitle}>Explore</Text>
            </NavbarIsland>
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 60,
            minHeight: Dimensions.get('window').height,
          },
        ]}
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
              <Text style={styles.sectionTitle}>Featured Routines</Text>
            </View>

            <View style={styles.routinesGrid}>
              {routines.map((routine) => (
                <View key={routine.id} style={styles.routineWrapper}>
                  {renderRoutineItem({ item: routine })}
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
    navbarContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    scrollContent: {
      paddingBottom: 40,
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
      paddingHorizontal: 16,
      marginBottom: 16,
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    programsList: {
      paddingHorizontal: 16,
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
      paddingHorizontal: 16,
      gap: 16,
    },
    routineWrapper: {
      width: (width - 48) / 2, // 2 columns with 16px gap and 16px outer padding
      marginBottom: 8,
    },
    routineCard: {
      height: 200,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.feedCardBackground,
    },
    routineImage: {
      width: '100%',
      height: '100%',
    },
    routineOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '100%',
      justifyContent: 'flex-end',
      padding: 12,
    },
    routineContent: {
      zIndex: 1,
    },
    routineTitle: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 8,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    routineMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      alignItems: 'center',
    },
    routineTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    routineTagText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '600',
    },
    saveButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 'auto',
    },
    saveButtonLoading: {
      opacity: 0.8,
    },
    emptyState: {
      width: '100%',
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
