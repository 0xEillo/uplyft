import { LevelBadge } from '@/components/LevelBadge'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { LEVEL_COLORS } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { StrengthLevel } from '@/lib/strength-standards'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useMemo, useRef } from 'react'
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
}

const LEVEL_ORDER: StrengthLevel[] = [
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
  'World Class',
]

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SHEET_HORIZONTAL_PADDING = 20
const BADGE_GRID_GAP = 12
const BADGE_TILE_SIZE = Math.floor(
  (SCREEN_WIDTH - SHEET_HORIZONTAL_PADDING * 2 - BADGE_GRID_GAP * 2) / 3,
)

export function LifterLevelsSheet({
  isVisible,
  onClose,
  currentLevel,
  progressToNext,
}: LifterLevelsSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(24)).current

  const currentLevelIndex = useMemo(() => {
    const levelIndex = LEVEL_ORDER.indexOf(currentLevel)
    return levelIndex >= 0 ? levelIndex : 0
  }, [currentLevel])

  const nextLevel =
    currentLevelIndex < LEVEL_ORDER.length - 1
      ? LEVEL_ORDER[currentLevelIndex + 1]
      : null
  const unlockedCount = currentLevelIndex + 1
  const lockedCount = Math.max(0, LEVEL_ORDER.length - unlockedCount)
  const safeProgress = Math.round(Math.max(0, Math.min(100, progressToNext)))

  useEffect(() => {
    if (isVisible) {
      fadeAnim.setValue(0)
      slideAnim.setValue(24)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 18,
          stiffness: 180,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start()
      return
    }

    fadeAnim.setValue(0)
    slideAnim.setValue(24)
  }, [fadeAnim, isVisible, slideAnim])

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
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />

        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.contentScrim} pointerEvents="none" />

          <View style={styles.closeFloating}>
            <LiquidGlassSurface style={styles.closeShell} debugLabel="lifter-level-close">
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </LiquidGlassSurface>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.centeredStack}>
              <LiquidGlassSurface style={styles.headerCopyShell} debugLabel="lifter-level-header-chip">
                <View style={styles.headerCopy}>
                  <Text style={styles.title}>Lifter Levels</Text>
                  <Text style={styles.subtitle}>
                    {unlockedCount} unlocked, {lockedCount} locked
                  </Text>
                </View>
              </LiquidGlassSurface>

              <LiquidGlassSurface
                style={styles.currentCard}
                debugLabel="lifter-level-current-card"
              >
                <LinearGradient
                  colors={[
                    `${LEVEL_COLORS[currentLevel]}40`,
                    `${LEVEL_COLORS[currentLevel]}12`,
                  ]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                />

                <View style={styles.currentCardTopRow}>
                  <View style={styles.currentCopy}>
                    <Text style={styles.currentLabel}>Current Level</Text>
                    <Text style={styles.currentLevelName}>{currentLevel}</Text>
                    <Text style={styles.currentMeta}>
                      {nextLevel ? `${safeProgress}% to ${nextLevel}` : 'Max level reached'}
                    </Text>
                  </View>

                  <View style={styles.currentBadgeWrap}>
                    <LevelBadge
                      level={currentLevel}
                      size="hero"
                      showTooltipOnPress={false}
                    />
                  </View>
                </View>

                {nextLevel && (
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${safeProgress}%`,
                          backgroundColor: LEVEL_COLORS[currentLevel],
                        },
                      ]}
                    />
                  </View>
                )}
              </LiquidGlassSurface>

              <View style={styles.gridHeader}>
                <Text style={styles.gridTitle}>All levels</Text>
                <Text style={styles.gridSubtitle}>Unlocked and locked tiers</Text>
              </View>

              <View style={styles.grid}>
                {LEVEL_ORDER.map((level, index) => {
                  const isLocked = index > currentLevelIndex
                  const isCurrent = index === currentLevelIndex
                  const levelColor = LEVEL_COLORS[level]
                  const tileStatusLabel = isCurrent
                    ? 'Current'
                    : isLocked
                      ? 'Locked'
                      : 'Unlocked'
                  const tileStatusIcon: keyof typeof Ionicons.glyphMap = isCurrent
                    ? 'star'
                    : isLocked
                      ? 'lock-closed'
                      : 'checkmark-circle'
                  const tileStatusColor = isLocked ? colors.textTertiary : levelColor
                  const tilePillBackground = isLocked
                    ? 'rgba(255,255,255,0.22)'
                    : `${levelColor}33`

                  return (
                    <LiquidGlassSurface
                      key={level}
                      style={[
                        styles.badgeTile,
                        isLocked && styles.badgeTileLocked,
                        isCurrent && styles.badgeTileCurrent,
                      ]}
                      debugLabel={`lifter-level-${level.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {isCurrent && (
                        <LinearGradient
                          colors={[`${levelColor}36`, 'transparent']}
                          style={styles.currentTileGlow}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          pointerEvents="none"
                        />
                      )}

                      <View style={styles.badgeVisualWrap}>
                        <LevelBadge
                          level={level}
                          size="large"
                          showTooltipOnPress={false}
                          style={isLocked ? styles.lockedBadge : undefined}
                        />
                        {isLocked && (
                          <View style={styles.lockIconBadge}>
                            <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      <Text
                        style={[styles.badgeName, isLocked && styles.badgeNameLocked]}
                        numberOfLines={2}
                      >
                        {level}
                      </Text>

                      <View style={[styles.badgeStatusPill, { backgroundColor: tilePillBackground }]}>
                        <Ionicons
                          name={tileStatusIcon}
                          size={12}
                          color={tileStatusColor}
                          style={styles.badgeStatusIcon}
                        />
                        <Text style={[styles.badgeStatusText, { color: tileStatusColor }]}>
                          {tileStatusLabel}
                        </Text>
                      </View>
                    </LiquidGlassSurface>
                  )
                })}
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8,10,14,0.90)',
    },
    content: {
      flex: 1,
      paddingHorizontal: SHEET_HORIZONTAL_PADDING,
      position: 'relative',
    },
    closeFloating: {
      position: 'absolute',
      top: insets.top + 24,
      left: SHEET_HORIZONTAL_PADDING,
      zIndex: 3,
    },
    closeShell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(22,24,28,0.86)',
      borderColor: 'rgba(255,255,255,0.20)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centeredStack: {
      width: '100%',
    },
    headerCopyShell: {
      alignSelf: 'stretch',
      borderRadius: 18,
      marginBottom: 16,
      backgroundColor: 'rgba(24,26,30,0.84)',
      borderColor: 'rgba(255,255,255,0.16)',
      overflow: 'hidden',
    },
    headerCopy: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    contentScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(14,16,20,0.20)',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      zIndex: 1,
    },
    scrollView: {
      flex: 1,
      zIndex: 2,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingTop: insets.top + 90,
      paddingBottom: Math.max(insets.bottom + 24, 56),
    },
    currentCard: {
      borderRadius: 24,
      padding: 18,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: 'rgba(26,28,32,0.82)',
      borderColor: 'rgba(255,255,255,0.18)',
    },
    currentCardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    currentCopy: {
      flex: 1,
      marginRight: 12,
    },
    currentLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    currentLevelName: {
      fontSize: 30,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -0.7,
      marginBottom: 6,
    },
    currentMeta: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    currentBadgeWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 96,
    },
    progressBarTrack: {
      marginTop: 16,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.30)',
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    gridHeader: {
      marginBottom: 10,
    },
    gridTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    gridSubtitle: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: BADGE_GRID_GAP,
    },
    badgeTile: {
      width: BADGE_TILE_SIZE,
      minHeight: 154,
      borderRadius: 18,
      paddingHorizontal: 10,
      paddingVertical: 12,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(34,37,43,0.86)',
      borderColor: 'rgba(255,255,255,0.24)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 3,
    },
    badgeTileLocked: {
      backgroundColor: 'rgba(18,20,24,0.90)',
      borderColor: 'rgba(255,255,255,0.14)',
    },
    badgeTileCurrent: {
      borderColor: 'rgba(255,255,255,0.60)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 3,
    },
    currentTileGlow: {
      ...StyleSheet.absoluteFillObject,
    },
    badgeVisualWrap: {
      marginTop: 4,
      alignItems: 'center',
    },
    lockedBadge: {
      opacity: 0.35,
    },
    lockIconBadge: {
      position: 'absolute',
      right: -3,
      bottom: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(26,28,32,0.84)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    badgeName: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      minHeight: 32,
    },
    badgeNameLocked: {
      color: colors.textSecondary,
    },
    badgeStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 5,
      minWidth: 76,
    },
    badgeStatusIcon: {
      marginRight: 4,
    },
    badgeStatusText: {
      fontSize: 11,
      fontWeight: '700',
    },
  })
