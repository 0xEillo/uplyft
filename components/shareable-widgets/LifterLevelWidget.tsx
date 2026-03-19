import { LevelBadge } from '@/components/LevelBadge'
import type { BodyPartSlug } from '@/lib/body-mapping'
import { LEVEL_POINT_ANCHORS } from '@/lib/overall-strength-score'
import type { StrengthLevel } from '@/lib/strength-standards'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useMemo } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Body from '@/components/PatchedBodyHighlighter'

const HIDDEN_SLUGS: BodyPartSlug[] = ['hands', 'feet', 'ankles']

const ALL_DISPLAYABLE_SLUGS: BodyPartSlug[] = [
  'trapezius',
  'triceps',
  'forearm',
  'adductors',
  'calves',
  'hair',
  'neck',
  'deltoids',
  'head',
  'tibialis',
  'obliques',
  'chest',
  'biceps',
  'abs',
  'quadriceps',
  'knees',
  'upper-back',
  'lower-back',
  'hamstring',
  'gluteal',
]

interface BodyData {
  slug: BodyPartSlug
  intensity: number
  side?: 'left' | 'right'
}

export interface LifterLevelWidgetProps {
  level: string
  score: number
  nextLevel?: string | null
  levelProgressPct: number
  levelColor: string
  progressDelta?: number
  showProgressDelta?: boolean
  bodyData: BodyData[]
  bodyColors: string[]
  bodyGender: 'male' | 'female'
  backgroundMode?: 'light' | 'dark'
  userTag?: string | null
  displayName?: string | null
}

export const LifterLevelWidget = React.forwardRef<View, LifterLevelWidgetProps>(
  (
    {
      level,
      score,
      nextLevel,
      levelProgressPct,
      levelColor,
      progressDelta,
      showProgressDelta,
      bodyData,
      bodyColors,
      bodyGender,
      backgroundMode = 'dark',
      userTag,
      displayName,
    },
    ref,
  ) => {
    const isDark = backgroundMode === 'dark'

    const subTextColor = isDark ? 'rgba(255,255,255,0.45)' : '#8E8E93'
    const textColor = isDark ? '#FFFFFF' : '#1C1C1E'
    const cardBg = isDark ? '#0D0D1A' : '#FFFFFF'
    const progressTrackColor = isDark ? 'rgba(255,255,255,0.1)' : '#E5E5EA'
    const bodyBackColor = isDark ? '#1C1C1C' : '#DCDCE4'
    const bodyBorderColor = isDark ? '#2E2E3A' : '#C8C8D0'

    const augmentedColors = useMemo(
      () => [...bodyColors, cardBg],
      [bodyColors, cardBg],
    )
    const hiddenIntensity = augmentedColors.length

    const augmentedBodyData = useMemo(() => {
      const filteredBase = bodyData.filter((d) => !HIDDEN_SLUGS.includes(d.slug))
      const dataSlugSet = new Set(filteredBase.map((d) => d.slug))
      const unrankedParts = ALL_DISPLAYABLE_SLUGS.filter(
        (slug) => !dataSlugSet.has(slug),
      ).map((slug) => ({ slug, intensity: 1 }))
      const hiddenParts = HIDDEN_SLUGS.map((slug) => ({
        slug,
        intensity: hiddenIntensity,
      }))
      return [...filteredBase, ...unrankedParts, ...hiddenParts]
    }, [bodyData, hiddenIntensity])

    const nextLevelScore = nextLevel
      ? LEVEL_POINT_ANCHORS[nextLevel as StrengthLevel]
      : null

    const gradientColors = isDark
      ? (['#0D0D1A', '#131325'] as const)
      : (['#FFFFFF', '#F2F2F7'] as const)

    return (
      <View ref={ref} style={styles.container} collapsable={false}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
          style={styles.gradient}
        >
          {/* Level header */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={styles.levelLeft}>
                <Text
                  style={[styles.levelName, { color: levelColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {level}
                </Text>
                <View style={styles.xpRow}>
                  <Text style={[styles.xpCurrent, { color: levelColor }]}>
                    {Math.round(score)}
                  </Text>
                  {nextLevelScore ? (
                    <Text style={[styles.xpTotal, { color: subTextColor }]}>
                      {'  /  '}
                      {nextLevelScore} pts
                    </Text>
                  ) : (
                    <Text style={[styles.xpTotal, { color: subTextColor }]}>
                      {' '}
                      pts
                    </Text>
                  )}
                  {showProgressDelta && !!progressDelta && (
                    <Text style={styles.xpDelta}>
                      {'  +'}
                      {progressDelta}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: progressTrackColor },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(0, Math.min(100, levelProgressPct))}%` as any,
                        backgroundColor: levelColor,
                      },
                    ]}
                  />
                </View>
              </View>
              <LevelBadge
                level={(level as StrengthLevel) ?? 'Untrained'}
                size="hero"
                showTooltipOnPress={false}
              />
            </View>
          </View>

          {/* Body diagram */}
          <View style={styles.bodySection}>
            <View style={styles.bodiesRow}>
              <View style={styles.bodyWrapper}>
                <Body
                  data={augmentedBodyData}
                  gender={bodyGender}
                  side="front"
                  scale={0.62}
                  colors={augmentedColors}
                  onBodyPartPress={() => {}}
                  border={bodyBorderColor}
                  // @ts-ignore
                  baseColor={bodyBackColor}
                  // @ts-ignore
                  backColor={bodyBackColor}
                  // @ts-ignore
                  fill={bodyBackColor}
                />
              </View>
              <View style={styles.bodyWrapper}>
                <Body
                  data={augmentedBodyData}
                  gender={bodyGender}
                  side="back"
                  scale={0.62}
                  colors={augmentedColors}
                  onBodyPartPress={() => {}}
                  border={bodyBorderColor}
                  // @ts-ignore
                  baseColor={bodyBackColor}
                  // @ts-ignore
                  backColor={bodyBackColor}
                  // @ts-ignore
                  fill={bodyBackColor}
                />
              </View>
            </View>
          </View>

          {/* Level legend pills */}
          <View style={styles.legendSection}>
            <View style={styles.legend}>
              {(
                [
                  'Beginner',
                  'Novice',
                  'Intermediate',
                  'Advanced',
                  'Elite',
                  'World Class',
                ] as StrengthLevel[]
              ).map((lvl) => (
                <LevelBadge key={lvl} level={lvl} variant="pill" size="small" />
              ))}
            </View>
          </View>

          {/* Branding */}
          <View style={styles.brandSection}>
            <View style={styles.brandContainer}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/images/bicep-icon.png')}
                  style={[styles.brandIcon, { tintColor: textColor }]}
                  resizeMode="contain"
                />
                <Text style={[styles.brandText, { color: textColor }]}>
                  REP AI
                </Text>
              </View>
              {(userTag || displayName) && (
                <Text style={[styles.userTagText, { color: textColor }]}>
                  @{userTag || displayName}
                </Text>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
    )
  },
)

LifterLevelWidget.displayName = 'LifterLevelWidget'

const styles = StyleSheet.create({
  container: {
    width: 360,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  gradient: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerSection: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  levelLeft: {
    flex: 1,
    paddingRight: 12,
  },
  levelName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 34,
    marginBottom: 8,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  xpCurrent: {
    fontSize: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  xpTotal: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  xpDelta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  bodySection: {
    marginTop: 2,
  },
  bodiesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 8,
  },
  bodyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendSection: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  brandSection: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIcon: {
    width: 24,
    height: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  userTagText: {
    fontSize: 16,
    fontWeight: '400',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
})
