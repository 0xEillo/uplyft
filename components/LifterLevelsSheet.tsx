import { useThemedColors } from '@/hooks/useThemedColors'
import { StrengthLevel } from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface LifterLevelsSheetProps {
  isVisible: boolean
  onClose: () => void
  currentLevel: StrengthLevel
  progressToNext: number
  gender?: string | null
}

const LEVEL_ORDER: StrengthLevel[] = [
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
  'World Class',
]

const LEVEL_IMAGES = {
  male: {
    Beginner: require('../assets/images/lifter-levels/male_images/1.png'),
    Novice: require('../assets/images/lifter-levels/male_images/2.png'),
    Intermediate: require('../assets/images/lifter-levels/male_images/3.png'),
    Advanced: require('../assets/images/lifter-levels/male_images/4.png'),
    Elite: require('../assets/images/lifter-levels/male_images/5.png'),
    'World Class': require('../assets/images/lifter-levels/male_images/6.png'),
  },
  female: {
    Beginner: require('../assets/images/lifter-levels/female_images/1.png'),
    Novice: require('../assets/images/lifter-levels/female_images/2.png'),
    Intermediate: require('../assets/images/lifter-levels/female_images/3.png'),
    Advanced: require('../assets/images/lifter-levels/female_images/4.png'),
    Elite: require('../assets/images/lifter-levels/female_images/5.png'),
    'World Class': require('../assets/images/lifter-levels/female_images/6.png'),
  },
}

const getLevelImage = (level: StrengthLevel, gender?: string | null) => {
  const g = gender === 'female' ? 'female' : 'male'
  return LEVEL_IMAGES[g][level]
}

const LEVEL_COLORS: Record<StrengthLevel, string> = {
  Beginner: '#9CA3AF',
  Novice: '#3B82F6',
  Intermediate: '#10B981',
  Advanced: '#8B5CF6',
  Elite: '#F59E0B',
  'World Class': '#EF4444',
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const CARD_WIDTH = SCREEN_WIDTH * 0.85
const SPACING = (SCREEN_WIDTH - CARD_WIDTH) / 2

export function LifterLevelsSheet({
  isVisible,
  onClose,
  currentLevel,
  progressToNext,
  gender,
}: LifterLevelsSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)

  // Animation for entrance
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 100,
          useNativeDriver: true,
        }),
      ]).start()

      // Scroll to current level after a short delay to allow layout
      setTimeout(() => {
        const index = LEVEL_ORDER.indexOf(currentLevel)
        if (index !== -1 && scrollRef.current) {
          scrollRef.current.scrollTo({
            x: index * SCREEN_WIDTH,
            animated: false, // Instant scroll initially
          })
        }
      }, 100)
    } else {
      fadeAnim.setValue(0)
      slideAnim.setValue(50)
    }
  }, [isVisible, currentLevel])

  const getCurrentLevelIndex = () => LEVEL_ORDER.indexOf(currentLevel)

  const isLocked = (level: StrengthLevel) => {
    const levelIndex = LEVEL_ORDER.indexOf(level)
    const currentIndex = getCurrentLevelIndex()
    return levelIndex > currentIndex
  }

  const styles = createStyles(colors, insets)

  if (!isVisible) return null

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' }} />
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.title}>LIFTER LEVEL</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Carousel */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH}
          >
            {LEVEL_ORDER.map((level, index) => {
              const locked = isLocked(level)
              const isCurrent = level === currentLevel
              const color = LEVEL_COLORS[level]

              return (
                <View key={level} style={styles.cardContainer}>
                  <View style={[styles.card, locked && styles.cardLocked]}>
                    {/* Level Badge */}
                    <View
                      style={[
                        styles.levelBadge,
                        { backgroundColor: locked ? '#333' : color },
                      ]}
                    >
                      <Text style={styles.levelNumber}>LEVEL {index + 1}</Text>
                    </View>

                    {/* Character Image */}
                    <View style={styles.imageContainer}>
                      <Image
                        source={getLevelImage(level, gender)}
                        style={[
                          styles.characterImage,
                          locked && styles.characterImageLocked,
                        ]}
                        contentFit="contain"
                      />
                      {locked && (
                        <View style={styles.lockOverlay}>
                          <Ionicons
                            name="lock-closed"
                            size={48}
                            color="rgba(255,255,255,0.5)"
                          />
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={styles.cardFooter}>
                      <Text
                        style={[styles.levelName, locked && styles.textLocked]}
                      >
                        {level.toUpperCase()}
                      </Text>

                      {isCurrent ? (
                        <View style={styles.statusContainer}>
                          {level !== 'World Class' && (
                            <Text style={styles.progressText}>
                              {Math.round(progressToNext)}% to next level
                            </Text>
                          )}
                        </View>
                      ) : locked ? (
                        <Text style={styles.lockedText}>LOCKED</Text>
                      ) : (
                        <View style={styles.statusContainer}>
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            color={colors.success}
                          />
                          <Text style={styles.completedText}>ACHIEVED</Text>
                        </View>
                      )}
                    </View>

                    {/* Glowing effect for current unlocked level */}
                    {isCurrent && (
                      <LinearGradient
                        colors={[color + '00', color + '40']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        pointerEvents="none"
                      />
                    )}
                  </View>
                </View>
              )
            })}
          </ScrollView>

          {/* Indicators */}
          <View style={styles.indicators}>
            {LEVEL_ORDER.map((level, index) => {
              const isActive = false // We'd need state to track scroll position for this, keep simple for now
              const isPassed = !isLocked(level)

              return (
                <View
                  key={level}
                  style={[
                    styles.indicatorDot,
                    {
                      backgroundColor: isPassed ? LEVEL_COLORS[level] : '#444',
                      opacity: isPassed ? 1 : 0.5,
                    },
                  ]}
                />
              )
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    content: {
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    closeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFF',
      letterSpacing: 2,
    },
    scrollContent: {
      alignItems: 'center',
    },
    cardContainer: {
      width: SCREEN_WIDTH,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    card: {
      width: '100%',
      height: SCREEN_HEIGHT * 0.65,
      backgroundColor: '#1A1A1A',
      borderRadius: 32,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#333',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
    },
    cardLocked: {
      backgroundColor: '#111',
      borderColor: '#222',
    },
    levelBadge: {
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginTop: 24,
      zIndex: 10,
      display: 'none',
    },
    levelNumber: {
      color: '#FFF',
      fontWeight: '800',
      fontSize: 14,
      letterSpacing: 1,
    },
    imageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 0,
      marginTop: 40,
    },
    characterImage: {
      width: '100%',
      height: '100%',
    },
    characterImageLocked: {
      opacity: 0.3,
      tintColor: 'black', // Silhouette effect
    },
    lockOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardFooter: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
      gap: 12,
    },
    levelName: {
      fontSize: 32,
      fontWeight: '900',
      color: '#FFF',
      letterSpacing: -1,
      textAlign: 'center',
    },
    textLocked: {
      color: '#666',
    },
    statusContainer: {
      alignItems: 'center',
      gap: 8,
    },
    statusBadge: {
      backgroundColor: '#FFF',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusText: {
      color: '#000',
      fontSize: 12,
      fontWeight: '800',
    },
    progressText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 14,
    },
    lockedText: {
      color: '#666',
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 1,
    },
    completedText: {
      color: colors.success,
      fontSize: 14,
      fontWeight: '700',
    },
    indicators: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
    },
    indicatorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  })
