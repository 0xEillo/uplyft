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
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useUnit } from '@/contexts/unit-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  formatBMI,
  formatBodyFat,
  formatBodyLogDate,
} from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import {
  deleteBodyLogImage,
  getBodyLogImageUrl,
} from '@/lib/utils/body-log-storage'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_WIDTH * 1.2

export default function BodyLogDetailScreen() {
  const {
    imageId,
    filePath,
    signedUrl,
    createdAt,
    weightKg,
    bodyFatPercentage,
    bmi,
  } = useLocalSearchParams<{
    imageId: string
    filePath?: string
    signedUrl?: string
    createdAt?: string
    weightKg?: string
    bodyFatPercentage?: string
    bmi?: string
  }>()

  const colors = useThemedColors()
  const { formatWeight } = useUnit()
  const router = useRouter()

  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Parse numeric values from URL params
  const [metrics, setMetrics] = useState({
    weight_kg: weightKg ? parseFloat(weightKg) : null,
    body_fat_percentage: bodyFatPercentage
      ? parseFloat(bodyFatPercentage)
      : null,
    bmi: bmi ? parseFloat(bmi) : null,
  })

  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    typeof signedUrl === 'string' ? signedUrl : undefined,
  )

  // Image modal state and animations
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [fullscreenImageLoading, setFullscreenImageLoading] = useState(true)
  const fullscreenOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    setMetrics({
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      body_fat_percentage: bodyFatPercentage
        ? parseFloat(bodyFatPercentage)
        : null,
      bmi: bmi ? parseFloat(bmi) : null,
    })
  }, [imageId, weightKg, bodyFatPercentage, bmi])

  useEffect(() => {
    let ignore = false
    const path = typeof filePath === 'string' ? filePath : undefined

    if (!resolvedUrl && path) {
      getBodyLogImageUrl(path).then((url) => {
        if (!ignore) {
          setResolvedUrl(url)
        }
      })
    }

    return () => {
      ignore = true
    }
  }, [filePath, resolvedUrl])

  useEffect(() => {
    let isMounted = true

    const syncAccessToken = async () => {
      const { data } = await supabase.auth.getSession()
      if (isMounted) {
        setAccessToken(data.session?.access_token || null)
      }
    }

    syncAccessToken()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setAccessToken(session?.access_token || null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const shouldFetchMetrics =
      metrics.weight_kg === null &&
      metrics.body_fat_percentage === null &&
      metrics.bmi === null &&
      imageId &&
      accessToken

    if (!shouldFetchMetrics) {
      return
    }

    ;(async () => {
      try {
        const { callSupabaseFunction } = await import(
          '@/lib/supabase-functions-client'
        )
        const response = await callSupabaseFunction(
          'body-log-analyze',
          'POST',
          { imageId },
          {},
          accessToken,
        )

        if (!response.ok) {
          return
        }

        const { metrics: fresh } = await response.json()
        if (!cancelled && fresh) {
          setMetrics({
            weight_kg: fresh.weight_kg ?? null,
            body_fat_percentage: fresh.body_fat_percentage ?? null,
            bmi: fresh.bmi ?? null,
          })
        }
      } catch (error) {
        console.error('Failed to refresh body log metrics:', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [accessToken, imageId, metrics])

  const handleDelete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    Alert.alert(
      'Delete Photo?',
      'This body log photo will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from database
              await database.bodyLog.delete(imageId)

              // Delete from storage (non-critical, don't throw on error)
              if (filePath) {
                await deleteBodyLogImage(filePath)
              }

              // Haptic feedback for success
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              )

              // Navigate back to body log listing
              router.push('/body-log')
            } catch (error) {
              console.error('Error deleting body log image:', error)
              Alert.alert(
                'Delete Failed',
                'Failed to delete photo. Please try again.',
                [{ text: 'OK' }],
              )
            }
          },
        },
      ],
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image Section */}
        <View style={styles.heroContainer}>
          {resolvedUrl ? (
            <TouchableOpacity
              style={styles.heroTouchable}
              onPress={() => setImageModalVisible(true)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: resolvedUrl }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
                style={styles.heroGradient}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.heroPlaceholder}>
              <ActivityIndicator color={colors.primary} size="large" />
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
            {createdAt ? formatBodyLogDate(createdAt) : '--'}
          </Text>

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
            />
            <MetricCard
              label="BMI"
              value={formatBMI(metrics.bmi)}
              icon="analytics"
              colors={colors}
              isPlaceholder={metrics.bmi === null}
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
      {resolvedUrl && (
        <Modal
          visible={imageModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <Pressable
            style={styles.imageModalOverlay}
            onPress={() => setImageModalVisible(false)}
          >
            <View style={styles.imageModalContent}>
              <Animated.Image
                source={{ uri: resolvedUrl }}
                style={[styles.fullscreenImage, { opacity: fullscreenOpacity }]}
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
            </View>
          </Pressable>
        </Modal>
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
}

function MetricCard({
  label,
  value,
  icon,
  colors,
  isPlaceholder,
}: MetricCardProps) {
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
      <View
        style={[
          styles.metricIconContainer,
          { backgroundColor: colors.primary + '15' },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
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

  // Hero Section
  heroContainer: {
    height: HERO_HEIGHT,
    position: 'relative',
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
    marginBottom: 36,
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
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricTextContainer: {
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

  // Hero Image Touchable
  heroTouchable: {
    width: '100%',
    height: '100%',
  },

  // Image Modal
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
