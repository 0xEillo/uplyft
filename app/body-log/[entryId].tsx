import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { BodyMetricInfoModal } from '@/components/BodyMetricInfoModal'
import { useAuth } from '@/contexts/auth-context'
import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  getBMIExplanation,
  getBMIStatus,
  getBodyFatExplanation,
  getBodyFatStatus,
  getOverallStatus,
  getStatusColor,
  getWeightExplanation,
  type BMIRange,
  type BodyFatRange,
  type Gender,
} from '@/lib/body-log/composition-analysis'
import {
  formatBMI,
  formatBodyFat,
  formatBodyLogDate,
  type BodyLogEntryWithImages,
} from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { getBodyLogImageUrls } from '@/lib/utils/body-log-storage'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_HEIGHT * 0.42

export default function BodyLogDetailScreen() {
  const { entryId, weightKg, bodyFatPercentage, bmi } = useLocalSearchParams<{
    entryId: string
    weightKg?: string
    bodyFatPercentage?: string
    bmi?: string
  }>()

  const colors = useThemedColors()
  const { formatWeight } = useUnit()
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [entry, setEntry] = useState<BodyLogEntryWithImages | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [userGender, setUserGender] = useState<Gender>('male')

  // Modal states
  const [infoModalVisible, setInfoModalVisible] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<{
    type: 'bodyFat' | 'bmi' | 'weight'
    value: string
    status: BodyFatRange | BMIRange | null
    explanation: string
  } | null>(null)

  // Parse numeric values from URL params (for initial display)
  const [metrics, setMetrics] = useState({
    weight_kg: weightKg ? parseFloat(weightKg) : null,
    body_fat_percentage: bodyFatPercentage
      ? parseFloat(bodyFatPercentage)
      : null,
    bmi: bmi ? parseFloat(bmi) : null,
  })

  // Image modal state and animations
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [fullscreenImageLoading, setFullscreenImageLoading] = useState(true)
  const fullscreenOpacity = useRef(new Animated.Value(0)).current
  const scrollX = useRef(new Animated.Value(0)).current

  // Fetch entry data
  useEffect(() => {
    if (!user || !entryId) return

    let cancelled = false

    const fetchEntry = async () => {
      try {
        setLoading(true)

        const { data: entryData, error: entryError } = await supabase
          .from('body_log_entries')
          .select(
            `
            id,
            user_id,
            created_at,
            weight_kg,
            body_fat_percentage,
            bmi,
            muscle_mass_kg,
            body_log_images!inner (
              id,
              entry_id,
              user_id,
              file_path,
              sequence,
              created_at
            )
          `,
          )
          .eq('id', entryId)
          .eq('user_id', user.id)
          .single()

        if (cancelled) return

        if (entryError || !entryData) {
          console.error('Error fetching entry:', entryError)
          Alert.alert(
            'Error',
            'Failed to load body log entry.',
            [{ text: 'OK', onPress: () => router.back() }],
          )
          return
        }

        // Transform the data to match our type
        const transformedEntry: BodyLogEntryWithImages = {
          id: entryData.id,
          user_id: entryData.user_id,
          created_at: entryData.created_at,
          weight_kg: entryData.weight_kg,
          body_fat_percentage: entryData.body_fat_percentage,
          bmi: entryData.bmi,
          muscle_mass_kg: entryData.muscle_mass_kg,
          images: (entryData.body_log_images || []).sort(
            (a: any, b: any) => a.sequence - b.sequence,
          ),
        }

        setEntry(transformedEntry)

        // Update metrics from entry data
        setMetrics({
          weight_kg: entryData.weight_kg,
          body_fat_percentage: entryData.body_fat_percentage,
          bmi: entryData.bmi,
        })

        // Fetch signed URLs for all images
        if (transformedEntry.images.length > 0) {
          const filePaths = transformedEntry.images.map((img) => img.file_path)
          const urls = await getBodyLogImageUrls(filePaths)
          if (!cancelled) {
            setImageUrls(urls)
          }
        }
      } catch (error) {
        console.error('Error fetching entry:', error)
        if (!cancelled) {
          Alert.alert(
            'Error',
            'Failed to load body log entry.',
            [{ text: 'OK', onPress: () => router.back() }],
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchEntry()

    return () => {
      cancelled = true
    }
  }, [user, entryId, router])

  // Fetch user profile for gender
  useEffect(() => {
    if (!user) return

    let cancelled = false

    const fetchUserProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single()

        if (!cancelled && profile?.gender) {
          if (profile.gender === 'male' || profile.gender === 'female') {
            setUserGender(profile.gender)
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
      }
    }

    fetchUserProfile()

    return () => {
      cancelled = true
    }
  }, [user])

  // Get status for metrics
  const bodyFatStatus = getBodyFatStatus(metrics.body_fat_percentage, userGender)
  const bmiStatus = getBMIStatus(metrics.bmi, userGender)
  const overallStatus = getOverallStatus(
    metrics.body_fat_percentage,
    metrics.bmi,
    userGender,
  )

  // Handle opening info modal
  const handleInfoPress = async (
    type: 'bodyFat' | 'bmi' | 'weight',
    value: string,
    status: BodyFatRange | BMIRange | null,
  ) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    let explanation = ''
    if (type === 'bodyFat') {
      explanation = getBodyFatExplanation(userGender)
    } else if (type === 'bmi') {
      explanation = getBMIExplanation(userGender)
    } else {
      explanation = getWeightExplanation(userGender)
    }

    setSelectedMetric({ type, value, status, explanation })
    setInfoModalVisible(true)
  }

  const handleDelete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const imageCount = entry?.images?.length || 0
    const message =
      imageCount > 1
        ? `This entry and all ${imageCount} photos will be permanently deleted.`
        : 'This entry and its photo will be permanently deleted.'

    Alert.alert('Delete Entry?', message, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!entryId) return

            // Delete from database (CASCADE will delete images too)
            await database.bodyLog.deleteEntry(entryId)

            // Haptic feedback for success
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            )

            // Navigate back to body log listing
            router.push('/body-log')
          } catch (error) {
            console.error('Error deleting body log entry:', error)
            Alert.alert(
              'Delete Failed',
              'Failed to delete entry. Please try again.',
              [{ text: 'OK' }],
            )
          }
        },
      },
    ])
  }

  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        setCurrentImageIndex(index)
        setImageModalVisible(true)
      }}
      style={styles.carouselImageContainer}
    >
      <Image
        source={{ uri: item }}
        style={styles.heroImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
        style={styles.heroGradient}
      />
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    )
  }

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Entry not found
          </Text>
        </View>
      </View>
    )
  }

  const imageCount = imageUrls.length

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image Section with Carousel */}
        <View style={styles.heroContainer}>
          {imageUrls.length > 0 ? (
            <>
              <FlatList
                data={imageUrls}
                renderItem={renderImageItem}
                keyExtractor={(item, index) => `image-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: false },
                )}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(
                    event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                  )
                  setCurrentImageIndex(index)
                }}
              />

              {/* Pagination dots */}
              {imageCount > 1 && (
                <View style={styles.paginationWrapper}>
                  <View style={styles.paginationContainer}>
                    {imageUrls.map((_, index) => {
                      const inputRange = [
                        (index - 1) * SCREEN_WIDTH,
                        index * SCREEN_WIDTH,
                        (index + 1) * SCREEN_WIDTH,
                      ]

                      const opacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.6, 1, 0.6],
                        extrapolate: 'clamp',
                      })

                      const scale = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.8, 1.2, 0.8],
                        extrapolate: 'clamp',
                      })

                      return (
                        <Animated.View
                          key={`dot-${index}`}
                          style={[
                            styles.paginationDot,
                            {
                              backgroundColor: '#FFFFFF',
                              opacity,
                              transform: [{ scale }],
                            },
                          ]}
                        />
                      )
                    })}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons
                name="images-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                No images available
              </Text>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* AI Badge */}
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <Text style={[styles.aiBadgeText, { color: colors.primary }]}>
              AI Analysis
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.mainTitle, { color: colors.text }]}>
            Body Composition
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {entry.created_at ? formatBodyLogDate(entry.created_at) : '--'}
          </Text>

          {/* Overall Status Card */}
          {overallStatus && (
            <View
              style={[
                styles.overallStatusCard,
                {
                  backgroundColor: getStatusColor(overallStatus.color).background,
                  borderColor: getStatusColor(overallStatus.color).primary + '30',
                },
              ]}
            >
              <Text
                style={[
                  styles.overallStatusTitle,
                  { color: getStatusColor(overallStatus.color).text },
                ]}
              >
                {overallStatus.title}
              </Text>
              <Text style={[styles.overallStatusSummary, { color: colors.text }]}>
                {overallStatus.summary}
              </Text>
            </View>
          )}

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Weight"
              value={formatWeight(metrics.weight_kg)}
              icon="barbell"
              colors={colors}
              isPlaceholder={metrics.weight_kg === null}
            />
            <MetricCard
              label="Body Fat"
              value={formatBodyFat(metrics.body_fat_percentage)}
              icon="aperture"
              colors={colors}
              isPlaceholder={metrics.body_fat_percentage === null}
              status={bodyFatStatus}
              onInfoPress={() =>
                handleInfoPress(
                  'bodyFat',
                  formatBodyFat(metrics.body_fat_percentage),
                  bodyFatStatus,
                )
              }
            />
            <MetricCard
              label="BMI"
              value={formatBMI(metrics.bmi)}
              icon="analytics"
              colors={colors}
              isPlaceholder={metrics.bmi === null}
              status={bmiStatus}
              onInfoPress={() =>
                handleInfoPress('bmi', formatBMI(metrics.bmi), bmiStatus)
              }
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Top Actions */}
      <SafeAreaView edges={['top']} style={styles.topActionsContainer}>
        <View style={styles.topActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.back()}
            style={[
              styles.topButton,
              { backgroundColor: colors.backgroundWhite + 'E6' },
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.topActionsSpacer} />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleDelete}
            style={[
              styles.topButton,
              { backgroundColor: colors.backgroundWhite + 'E6' },
            ]}
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Image Fullscreen Modal */}
      {imageUrls.length > 0 && (
        <Modal
          visible={imageModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <View style={styles.imageModalOverlay}>
            <View style={[styles.fullscreenSafeArea, { paddingTop: insets.top }]}>
              {/* Close button */}
              <TouchableOpacity
                style={styles.fullscreenCloseButton}
                onPress={() => setImageModalVisible(false)}
              >
                <Ionicons name="close" size={28} color={colors.white} />
              </TouchableOpacity>

              {/* Image counter */}
              {imageCount > 1 && (
                <View style={styles.fullscreenCounter}>
                  <Text style={styles.fullscreenCounterText}>
                    {currentImageIndex + 1} / {imageCount}
                  </Text>
                </View>
              )}
            </View>

            <FlatList
              data={imageUrls}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.fullscreenImageWrapper}
                  onPress={() => setImageModalVisible(false)}
                >
                  <Animated.Image
                    source={{ uri: item }}
                    style={[
                      styles.fullscreenImage,
                      { opacity: fullscreenOpacity },
                    ]}
                    resizeMode="contain"
                    onLoadStart={() => setFullscreenImageLoading(true)}
                    onLoad={() => {
                      setFullscreenImageLoading(false)
                      Animated.timing(fullscreenOpacity, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                      }).start()
                    }}
                    onError={(error) => {
                      console.error(
                        'Failed to load fullscreen image:',
                        error.nativeEvent.error,
                      )
                      setFullscreenImageLoading(false)
                    }}
                  />
                  {fullscreenImageLoading && (
                    <View style={styles.fullscreenLoadingOverlay}>
                      <ActivityIndicator size="large" color={colors.white} />
                    </View>
                  )}
                </Pressable>
              )}
              keyExtractor={(item, index) => `fullscreen-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={currentImageIndex}
              getItemLayout={(data, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(
                  event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                )
                setCurrentImageIndex(index)
              }}
            />
          </View>
        </Modal>
      )}

      {/* Info Modal */}
      {selectedMetric && (
        <BodyMetricInfoModal
          visible={infoModalVisible}
          onClose={() => setInfoModalVisible(false)}
          metricType={selectedMetric.type}
          currentValue={selectedMetric.value}
          status={selectedMetric.status}
          explanation={selectedMetric.explanation}
          gender={userGender}
        />
      )}
    </View>
  )
}

type Colors = ReturnType<typeof useThemedColors>

// MetricCard Component
interface MetricCardProps {
  label: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
  colors: Colors
  isPlaceholder?: boolean
  status?: BodyFatRange | BMIRange | null
  onInfoPress?: () => void
}

function MetricCard({
  label,
  value,
  icon,
  colors,
  isPlaceholder,
  status,
  onInfoPress,
}: MetricCardProps) {
  const statusColors = status ? getStatusColor(status.color) : null

  const CardContent = (
    <>
      <View
        style={[
          styles.metricIconContainer,
          {
            backgroundColor: statusColors
              ? statusColors.background
              : colors.primary + '15',
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={statusColors ? statusColors.primary : colors.primary}
        />
      </View>
      <View style={styles.metricTextContainer}>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text
          style={[
            styles.metricValue,
            { color: isPlaceholder ? colors.textSecondary : colors.text },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      </View>
    </>
  )

  // If there's an info press handler, make the whole card tappable
  if (onInfoPress) {
    return (
      <TouchableOpacity
        style={[
          styles.metricCard,
          {
            backgroundColor: colors.backgroundWhite,
            borderColor: statusColors
              ? statusColors.primary + '30'
              : colors.border,
          },
        ]}
        onPress={onInfoPress}
        activeOpacity={0.7}
      >
        {CardContent}
      </TouchableOpacity>
    )
  }

  // Otherwise, just a regular view
  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: colors.backgroundWhite,
          borderColor: colors.border,
        },
      ]}
    >
      {CardContent}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Hero Section
  heroContainer: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  carouselImageContainer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.65,
  },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Pagination
  paginationWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backdropFilter: 'blur(10px)',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  },

  // Content Section
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },

  // AI Badge
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(138, 180, 248, 0.12)',
    gap: 7,
    marginBottom: 18,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Title Section
  mainTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 24,
  },

  // Overall Status Card
  overallStatusCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 28,
  },
  overallStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  overallStatusSummary: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginHorizontal: -5,
  },
  metricCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  metricIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricTextContainer: {
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Top Actions
  topActionsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  topActionsSpacer: {
    flex: 1,
  },
  topButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },

  // Image Modal
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fullscreenSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  fullscreenCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCounter: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullscreenCounterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imageModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullscreenLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
