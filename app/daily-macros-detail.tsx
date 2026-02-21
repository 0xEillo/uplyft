import { NATIVE_SHEET_LAYOUT } from '@/constants/native-sheet-layout'
import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Circle, G, Svg } from 'react-native-svg'

type DailyTotals = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal_count: number
}

type DailyGoals = {
  calorie_goal: number | null
  protein_goal_g: number | null
}

const DEFAULT_TOTALS: DailyTotals = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  meal_count: 0,
}

const DEFAULT_GOALS: DailyGoals = {
  calorie_goal: null,
  protein_goal_g: null,
}

const roundMacro = (value: number): number => Math.round(value)

export default function DailyMacrosDetailScreen() {
  const params = useLocalSearchParams<{
    totalsJson?: string
    goalsJson?: string
  }>()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, isDark)

  const totals = useMemo<DailyTotals>(() => {
    if (!params.totalsJson) return DEFAULT_TOTALS
    try {
      return JSON.parse(params.totalsJson) as DailyTotals
    } catch {
      return DEFAULT_TOTALS
    }
  }, [params.totalsJson])

  const goals = useMemo<DailyGoals>(() => {
    if (!params.goalsJson) return DEFAULT_GOALS
    try {
      return JSON.parse(params.goalsJson) as DailyGoals
    } catch {
      return DEFAULT_GOALS
    }
  }, [params.goalsJson])

  const { calories, protein_g, carbs_g, fat_g, meal_count } = totals
  const { calorie_goal, protein_goal_g } = goals

  const safeCalGoal = calorie_goal || 2500
  const safeProtGoal = protein_goal_g || 150
  const safeCarbGoal = 250
  const safeFatGoal = 70

  const calProgress = Math.min(calories / safeCalGoal, 1)
  const protProgress = Math.min(protein_g / safeProtGoal, 1)
  const carbProgress = Math.min(carbs_g / safeCarbGoal, 1)
  const fatProgress = Math.min(fat_g / safeFatGoal, 1)

  const calRemaining = Math.max(0, safeCalGoal - calories)
  const protRemaining = Math.max(0, safeProtGoal - protein_g)
  const carbRemaining = Math.max(0, safeCarbGoal - carbs_g)
  const fatRemaining = Math.max(0, safeFatGoal - fat_g)

  const protOver = protein_g > safeProtGoal
  const carbOver = carbs_g > safeCarbGoal
  const fatOver = fat_g > safeFatGoal
  const calOver = calories > safeCalGoal

  const calSize = 100
  const calStroke = 9
  const calRadius = (calSize - calStroke) / 2
  const calCircumference = calRadius * 2 * Math.PI

  const macroSize = 52
  const macroStroke = 5
  const macroRadius = (macroSize - macroStroke) / 2
  const macroCircumference = macroRadius * 2 * Math.PI

  return (
    <View
      collapsable={false}
      style={[
        styles.formSheetContainer,
        { paddingBottom: insets.bottom + NATIVE_SHEET_LAYOUT.bottomSafeAreaPadding },
      ]}
    >
      <View collapsable={false} style={styles.headerSection}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Today&apos;s Nutrition</Text>
          <View style={styles.mealCountBadge}>
            <Ionicons
              name="nutrition"
              size={13}
              color={colors.textSecondary}
            />
            <Text style={styles.mealCountText}>
              {meal_count} {meal_count === 1 ? 'meal' : 'meals'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.formSheetScroll}
        contentContainerStyle={styles.formSheetScrollContent}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.caloriesHero}>
          <View style={styles.caloriesTextColumn}>
            <Text
              style={[
                styles.caloriesValue,
                calOver && { color: '#FF6B6B' },
              ]}
            >
              {roundMacro(calOver ? calories - safeCalGoal : calRemaining)}
            </Text>
            <Text style={styles.caloriesLabel}>
              {calOver ? 'Calories over' : 'Calories left'}
            </Text>
          </View>

          <View style={styles.caloriesRingContainer}>
            <Svg width={calSize} height={calSize}>
              <G rotation="-90" origin={`${calSize / 2}, ${calSize / 2}`}>
                <Circle
                  cx={calSize / 2}
                  cy={calSize / 2}
                  r={calRadius}
                  stroke={isDark ? colors.border : '#E8E8ED'}
                  strokeWidth={calStroke}
                  fill="transparent"
                />
                <Circle
                  cx={calSize / 2}
                  cy={calSize / 2}
                  r={calRadius}
                  stroke={calOver ? '#FF6B6B' : colors.textPrimary}
                  strokeWidth={calStroke}
                  fill="transparent"
                  strokeDasharray={`${calCircumference}`}
                  strokeDashoffset={`${calCircumference * (1 - calProgress)}`}
                  strokeLinecap="round"
                />
              </G>
            </Svg>
            <View style={styles.caloriesRingCenter}>
              <Ionicons
                name="flame"
                size={22}
                color={calOver ? '#FF6B6B' : colors.textPrimary}
              />
            </View>
          </View>
        </View>

        <View style={styles.macroGrid}>
          <View style={styles.macroCard}>
            <Text style={styles.macroValue}>
              {roundMacro(protOver ? protein_g - safeProtGoal : protRemaining)}g
            </Text>
            <Text style={styles.macroLabel}>
              Protein {protOver ? 'over' : 'left'}
            </Text>
            <View style={styles.macroRingContainer}>
              <Svg width={macroSize} height={macroSize}>
                <G rotation="-90" origin={`${macroSize / 2}, ${macroSize / 2}`}>
                  <Circle
                    cx={macroSize / 2}
                    cy={macroSize / 2}
                    r={macroRadius}
                    stroke="rgba(248, 113, 113, 0.15)"
                    strokeWidth={macroStroke}
                    fill="transparent"
                  />
                  <Circle
                    cx={macroSize / 2}
                    cy={macroSize / 2}
                    r={macroRadius}
                    stroke="#F87171"
                    strokeWidth={macroStroke}
                    fill="transparent"
                    strokeDasharray={`${macroCircumference}`}
                    strokeDashoffset={`${macroCircumference * (1 - protProgress)}`}
                    strokeLinecap="round"
                  />
                </G>
              </Svg>
              <View style={styles.macroRingIcon}>
                <MaterialCommunityIcons
                  name="food-drumstick"
                  size={16}
                  color="#F87171"
                />
              </View>
            </View>
          </View>

          <View style={styles.macroCard}>
            <Text style={styles.macroValue}>
              {roundMacro(carbOver ? carbs_g - safeCarbGoal : carbRemaining)}g
            </Text>
            <Text style={styles.macroLabel}>
              Carbs {carbOver ? 'over' : 'left'}
            </Text>
            <View style={styles.macroRingContainer}>
              <Svg width={macroSize} height={macroSize}>
                <G rotation="-90" origin={`${macroSize / 2}, ${macroSize / 2}`}>
                  <Circle
                    cx={macroSize / 2}
                    cy={macroSize / 2}
                    r={macroRadius}
                    stroke="rgba(251, 191, 36, 0.15)"
                    strokeWidth={macroStroke}
                    fill="transparent"
                  />
                  <Circle
                    cx={macroSize / 2}
                    cy={macroSize / 2}
                    r={macroRadius}
                    stroke="#FBBF24"
                    strokeWidth={macroStroke}
                    fill="transparent"
                    strokeDasharray={`${macroCircumference}`}
                    strokeDashoffset={`${macroCircumference * (1 - carbProgress)}`}
                    strokeLinecap="round"
                  />
                </G>
              </Svg>
              <View style={styles.macroRingIcon}>
                <Ionicons name="nutrition" size={16} color="#FBBF24" />
              </View>
            </View>
          </View>

          <View style={styles.macroCard}>
            <Text style={styles.macroValue}>
              {roundMacro(fatOver ? fat_g - safeFatGoal : fatRemaining)}g
            </Text>
            <Text style={styles.macroLabel}>
              Fats {fatOver ? 'over' : 'left'}
            </Text>
            <View style={styles.macroRingContainer}>
              <Svg width={macroSize} height={macroSize}>
                <G rotation="-90" origin={`${macroSize / 2}, ${macroSize / 2}`}>
                  <Circle
                    cx={macroSize / 2}
                    cy={macroSize / 2}
                    r={macroRadius}
                    stroke="rgba(96, 165, 250, 0.15)"
                    strokeWidth={macroStroke}
                    fill="transparent"
                  />
                  <Circle
                    cx={macroSize / 2}
                    cy={macroSize / 2}
                    r={macroRadius}
                    stroke="#60A5FA"
                    strokeWidth={macroStroke}
                    fill="transparent"
                    strokeDasharray={`${macroCircumference}`}
                    strokeDashoffset={`${macroCircumference * (1 - fatProgress)}`}
                    strokeLinecap="round"
                  />
                </G>
              </Svg>
              <View style={styles.macroRingIcon}>
                <Ionicons name="water" size={16} color="#60A5FA" />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.breakdownContainer}>
          <View style={styles.breakdownBar}>
            <View
              style={[
                styles.breakdownSegment,
                {
                  flex: protein_g * 4 || 0.01,
                  backgroundColor: '#F87171',
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                },
              ]}
            />
            <View
              style={[
                styles.breakdownSegment,
                {
                  flex: carbs_g * 4 || 0.01,
                  backgroundColor: '#FBBF24',
                },
              ]}
            />
            <View
              style={[
                styles.breakdownSegment,
                {
                  flex: fat_g * 9 || 0.01,
                  backgroundColor: '#60A5FA',
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                },
              ]}
            />
          </View>
          <View style={styles.breakdownLabels}>
            <View style={styles.breakdownLabelItem}>
              <View style={[styles.breakdownDot, { backgroundColor: '#F87171' }]} />
              <Text style={styles.breakdownLabelText}>
                {roundMacro((protein_g * 4 / Math.max(calories, 1)) * 100)}%
              </Text>
            </View>
            <View style={styles.breakdownLabelItem}>
              <View style={[styles.breakdownDot, { backgroundColor: '#FBBF24' }]} />
              <Text style={styles.breakdownLabelText}>
                {roundMacro((carbs_g * 4 / Math.max(calories, 1)) * 100)}%
              </Text>
            </View>
            <View style={styles.breakdownLabelItem}>
              <View style={[styles.breakdownDot, { backgroundColor: '#60A5FA' }]} />
              <Text style={styles.breakdownLabelText}>
                {roundMacro((fat_g * 9 / Math.max(calories, 1)) * 100)}%
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    formSheetContainer: {
      flex: 1,
      backgroundColor: colors.surfaceSheet,
      paddingHorizontal: NATIVE_SHEET_LAYOUT.horizontalPadding,
      paddingTop: NATIVE_SHEET_LAYOUT.topPadding,
    },
    headerSection: {
      marginBottom: NATIVE_SHEET_LAYOUT.headerBottomSpacing,
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      fontSize: NATIVE_SHEET_LAYOUT.titleFontSize,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    mealCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
    },
    mealCountText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    formSheetScroll: {
      flex: 1,
    },
    formSheetScrollContent: {
      paddingBottom: NATIVE_SHEET_LAYOUT.contentBottomSpacing,
    },
    caloriesHero: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      borderRadius: 24,
      paddingVertical: 28,
      paddingHorizontal: 28,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED',
    },
    caloriesTextColumn: {
      flex: 1,
    },
    caloriesValue: {
      fontSize: 44,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1.5,
      lineHeight: 48,
    },
    caloriesLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 4,
    },
    caloriesRingContainer: {
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    caloriesRingCenter: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
    },
    macroGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    macroCard: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      borderRadius: 20,
      paddingTop: 16,
      paddingBottom: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED',
    },
    macroValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    macroLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: 12,
    },
    macroRingContainer: {
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    macroRingIcon: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
    },
    breakdownContainer: {
      gap: 8,
    },
    breakdownBar: {
      flexDirection: 'row',
      height: 6,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#E8E8ED',
    },
    breakdownSegment: {
      height: '100%',
    },
    breakdownLabels: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
    },
    breakdownLabelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    breakdownDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    breakdownLabelText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
  })
