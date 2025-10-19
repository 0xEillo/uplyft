import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useThemedColors } from '@/hooks/useThemedColors'
import { getPlaceholderBodyLogAnalysis } from '@/lib/body-log/metadata'
import { database } from '@/lib/database'
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
    analysisDate,
    analysisWeight,
    analysisBodyfat,
    analysisBmi,
  } = useLocalSearchParams<{
    imageId: string
    filePath?: string
    signedUrl?: string
    analysisDate?: string
    analysisWeight?: string
    analysisBodyfat?: string
    analysisBmi?: string
  }>()

  const colors = useThemedColors()
  const analysis = useMemo(() => {
    return {
      ...getPlaceholderBodyLogAnalysis(),
      ...(analysisDate ? { date: analysisDate } : {}),
      ...(analysisWeight ? { weight: analysisWeight } : {}),
      ...(analysisBodyfat ? { bodyfat: analysisBodyfat } : {}),
      ...(analysisBmi ? { bmi: analysisBmi } : {}),
    }
  }, [analysisBodyfat, analysisBmi, analysisDate, analysisWeight])
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    typeof signedUrl === 'string' ? signedUrl : undefined,
  )
  const router = useRouter()

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
              router.push('/(tabs)/body-log')
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
            <>
              <Image
                source={{ uri: resolvedUrl }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
                style={styles.heroGradient}
              />
            </>
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
            {analysis.date}
          </Text>

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Weight"
              value={analysis.weight}
              icon="barbell"
              colors={colors}
            />
            <MetricCard
              label="Body Fat"
              value={analysis.bodyfat}
              icon="aperture"
              colors={colors}
            />
            <MetricCard
              label="BMI"
              value={analysis.bmi}
              icon="analytics"
              colors={colors}
            />
            <MetricCard
              label="Muscle Mass"
              value="Coming soon"
              icon="fitness"
              colors={colors}
              isPlaceholder
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Top Actions */}
      <SafeAreaView edges={['top']} style={styles.topActionsContainer}>
        <View style={styles.topActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/body-log')}
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
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text
        style={[
          styles.metricValue,
          { color: isPlaceholder ? colors.textSecondary : colors.text },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
    height: HERO_HEIGHT * 0.6,
  },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content Section
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // AI Badge
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(138, 180, 248, 0.12)',
    gap: 6,
    marginBottom: 16,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Title Section
  mainTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 32,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 40 - 12) / 2,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },
  metricIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontSize: 13,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
})
