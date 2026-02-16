import { LevelBadge } from '@/components/LevelBadge'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useTheme } from '@/contexts/theme-context'
import { LEVEL_COLORS } from '@/hooks/useStrengthData'
import { useThemedColors } from '@/hooks/useThemedColors'
import { LEVEL_POINT_ANCHORS } from '@/lib/overall-strength-score'
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
  score?: number | null
  title?: string
  levelMilestoneLabels?: Partial<Record<StrengthLevel, string>>
  showMilestones?: boolean
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
  score,
  title,
  levelMilestoneLabels,
  showMilestones = false,
}: LifterLevelsSheetProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(24)).current

  const currentLevelIndex = useMemo(() => {
    return LEVEL_ORDER.indexOf(currentLevel)
  }, [currentLevel])

  const isUnranked = currentLevel === 'Untrained'
  const unlockedCount = isUnranked ? 0 : currentLevelIndex + 1
  const lockedCount = LEVEL_ORDER.length - unlockedCount
  const normalizedMilestoneMap = useMemo(() => {
    const normalized = new Map<string, string>()
    Object.entries(levelMilestoneLabels ?? {}).forEach(([level, label]) => {
      if (!label) return
      normalized.set(level.toLowerCase().replace(/\s+/g, ''), label)
    })
    return normalized
  }, [levelMilestoneLabels])

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

  const styles = createStyles(colors, insets, isDark)

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
              <View style={[styles.headerCopy, { marginBottom: 16 }]}>
                <Text style={styles.title}>{title || 'Lifter Levels'}</Text>
                <Text style={styles.subtitle}>
                  {unlockedCount} unlocked, {lockedCount} locked
                </Text>
              </View>

              <LiquidGlassSurface
                style={[
                  styles.currentCard,
                  { borderColor: LEVEL_COLORS[currentLevel], borderWidth: 2 },
                ]}
                debugLabel="lifter-level-current-card"
              >
                <LinearGradient
                  colors={[
                    `${LEVEL_COLORS[currentLevel]}15`,
                    `${LEVEL_COLORS[currentLevel]}05`,
                  ]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                />

                <View style={styles.currentCardTopRow}>
                  <View style={styles.currentCopy}>
                    <Text style={styles.currentLabel}>Current Level</Text>
                    <Text style={styles.currentLevelName}>
                      {isUnranked ? 'Unranked' : currentLevel}
                    </Text>
                    {score != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.currentScoreGray}>{score} pts</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.currentBadgeWrap}>
                    <LevelBadge
                      level={currentLevel}
                      size="hero"
                      showTooltipOnPress={false}
                    />
                  </View>
                </View>

              </LiquidGlassSurface>

              <View style={styles.gridHeader}>
                <Text style={styles.gridTitle}>All levels</Text>
              </View>

              <View style={styles.grid}>
                {LEVEL_ORDER.map((level, index) => {
                  const isLocked = isUnranked || index > currentLevelIndex
                  const isCurrent = !isUnranked && index === currentLevelIndex
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
                    ? isDark
                      ? 'rgba(255,255,255,0.22)'
                      : 'rgba(0,0,0,0.10)'
                    : `${levelColor}33`
                  const milestoneLabel =
                    levelMilestoneLabels?.[level] ??
                    normalizedMilestoneMap.get(
                      level.toLowerCase().replace(/\s+/g, ''),
                    )
                  const shouldRenderMilestone = showMilestones || !!milestoneLabel

                  return (
                    <LiquidGlassSurface
                      key={level}
                      style={[
                        styles.badgeTile,
                        isLocked && styles.badgeTileLocked,
                        !isLocked && styles.badgeTileCurrent,
                        !isLocked && { borderColor: levelColor, borderWidth: 2 },
                      ]}
                      debugLabel={`lifter-level-${level.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {!isLocked && (
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
                              <Ionicons name="lock-closed" size={12} color={colors.textPrimary} />
                            </View>
                          )}
                      </View>

                      <View style={styles.textStack}>
                        <Text
                          style={[styles.badgeName, isLocked && styles.badgeNameLocked]}
                          numberOfLines={2}
                        >
                          {level}
                        </Text>

                        <Text
                          style={[
                            styles.badgePoints,
                            isLocked && styles.badgePointsLocked,
                          ]}
                          numberOfLines={1}
                        >
                          {LEVEL_POINT_ANCHORS[level]} pts
                        </Text>

                        {shouldRenderMilestone ? (
                          <Text
                            style={[
                              styles.badgeMilestone,
                              isLocked && styles.badgeMilestoneLocked,
                            ]}
                            numberOfLines={1}
                          >
                            {milestoneLabel ?? '--'}
                          </Text>
                        ) : (
                          <View style={styles.badgeMilestoneSpacer} />
                        )}
                      </View>

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

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { top: number; bottom: number },
  isDark: boolean,
) => {
  const palette = isDark
    ? {
      backdrop: 'rgba(5,7,10,0.96)',
      closeShellBg: 'rgba(22,24,28,0.86)',
      closeShellBorder: 'rgba(255,255,255,0.20)',
      headerShellBg: 'rgba(24,26,30,0.84)',
      headerShellBorder: 'rgba(255,255,255,0.16)',
      contentScrim: 'rgba(14,16,20,0.20)',
      currentCardBg: 'rgba(26,28,32,0.82)',
      currentCardBorder: 'rgba(255,255,255,0.18)',
      progressTrack: 'rgba(255,255,255,0.30)',
      badgeTileBg: 'rgba(34,37,43,0.86)',
      badgeTileBorder: 'rgba(255,255,255,0.24)',
      badgeTileLockedBg: 'rgba(18,20,24,0.90)',
      badgeTileLockedBorder: 'rgba(255,255,255,0.14)',
      badgeTileCurrentBorder: 'rgba(255,255,255,0.60)',
      lockBadgeBg: 'rgba(26,28,32,0.84)',
      lockBadgeBorder: 'rgba(255,255,255,0.16)',
    }
    : {
      backdrop: 'rgba(8,10,14,0.72)',
      closeShellBg: 'rgba(255,255,255,0.86)',
      closeShellBorder: 'rgba(0,0,0,0.14)',
      headerShellBg: 'rgba(255,255,255,0.84)',
      headerShellBorder: 'rgba(0,0,0,0.12)',
      contentScrim: 'rgba(205, 209, 216, 0.98)',
      currentCardBg: 'rgba(255,255,255,0.94)',
      currentCardBorder: 'rgba(0,0,0,0.13)',
      progressTrack: 'rgba(0,0,0,0.16)',
      badgeTileBg: 'rgba(255,255,255,0.94)',
      badgeTileBorder: 'rgba(0,0,0,0.14)',
      badgeTileLockedBg: 'rgba(246,248,252,0.90)',
      badgeTileLockedBorder: 'rgba(0,0,0,0.10)',
      badgeTileCurrentBorder: 'rgba(0,0,0,0.30)',
      lockBadgeBg: 'rgba(255,255,255,0.92)',
      lockBadgeBorder: 'rgba(0,0,0,0.16)',
    }

  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: palette.backdrop,
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
      backgroundColor: palette.closeShellBg,
      borderColor: palette.closeShellBorder,
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
      backgroundColor: palette.headerShellBg,
      borderColor: palette.headerShellBorder,
      overflow: 'hidden',
    },
    headerCopy: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      alignItems: 'center',
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 4,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    contentScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: palette.contentScrim,
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
      paddingBottom: insets.bottom + 90,
    },
    currentCard: {
      borderRadius: 24,
      padding: 18,
      overflow: 'hidden',
      marginBottom: 16,
      backgroundColor: palette.currentCardBg,
      borderColor: palette.currentCardBorder,
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
    currentScoreGray: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'] as const,
    },
    scoreDeltaText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#10B981',
      fontVariant: ['tabular-nums'] as any,
    },
    currentBadgeWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 96,
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
      minHeight: 124,
      borderRadius: 18,
      paddingHorizontal: 6,
      paddingVertical: 10,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: palette.badgeTileBg,
      borderColor: palette.badgeTileBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 3,
    },
    badgeTileLocked: {
      backgroundColor: palette.badgeTileLockedBg,
      borderColor: palette.badgeTileLockedBorder,
    },
    badgeTileCurrent: {
      borderColor: palette.badgeTileCurrentBorder,
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
      width: 48,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    textStack: {
      gap: 3,
      alignItems: 'center',
      width: '100%',
    },
    lockedBadge: {
      opacity: 0.35,
    },
    lockIconBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: palette.lockBadgeBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: palette.lockBadgeBorder,
      zIndex: 10,
    },
    badgeName: {
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      includeFontPadding: false,
    },
    badgeNameLocked: {
      color: colors.textSecondary,
    },
    badgePoints: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 13,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    badgePointsLocked: {
      color: colors.textTertiary,
    },
    badgeMilestone: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      lineHeight: 14,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
    },
    badgeMilestoneLocked: {
      color: colors.textSecondary,
    },
    badgeMilestoneSpacer: {
      height: 14,
    },
    badgeStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      minWidth: 70,
    },
    badgeStatusIcon: {
      marginRight: 4,
    },
    badgeStatusText: {
      fontSize: 10,
      fontWeight: '700',
    },
  })
}
