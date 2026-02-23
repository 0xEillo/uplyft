import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Circle, G, Svg } from 'react-native-svg'

interface DailyMacrosSheetProps {
  visible: boolean
  onClose: () => void
  totals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    meal_count: number
  }
  goals: {
    calorie_goal: number | null
    protein_goal_g: number | null
  }
  onPressContent?: () => void
}

const roundMacro = (value: number): number => Math.round(value)

export function DailyMacrosSheet({
  visible,
  onClose,
  totals,
  goals,
  onPressContent,
}: DailyMacrosSheetProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors, insets, isDark)

  const { calories, protein_g, carbs_g, fat_g, meal_count } = totals
  const { calorie_goal, protein_goal_g } = goals

  // Goals with sensible defaults
  const safeCalGoal = calorie_goal || 2500
  const safeProtGoal = protein_goal_g || 150
  const safeCarbGoal = 250
  const safeFatGoal = 70

  // Progress calculations
  const calProgress = Math.min(calories / safeCalGoal, 1)
  const protProgress = Math.min(protein_g / safeProtGoal, 1)
  const carbProgress = Math.min(carbs_g / safeCarbGoal, 1)
  const fatProgress = Math.min(fat_g / safeFatGoal, 1)

  // Remaining values
  const calRemaining = Math.max(0, safeCalGoal - calories)
  const protRemaining = Math.max(0, safeProtGoal - protein_g)
  const carbRemaining = Math.max(0, safeCarbGoal - carbs_g)
  const fatRemaining = Math.max(0, safeFatGoal - fat_g)

  // Over/left labels
  const protOver = protein_g > safeProtGoal
  const carbOver = carbs_g > safeCarbGoal
  const fatOver = fat_g > safeFatGoal
  const calOver = calories > safeCalGoal

  // Circle metrics — calorie ring
  const calSize = 100
  const calStroke = 9
  const calRadius = (calSize - calStroke) / 2
  const calCircumference = calRadius * 2 * Math.PI

  // Circle metrics — macro rings
  const macroSize = 52
  const macroStroke = 5
  const macroRadius = (macroSize - macroStroke) / 2
  const macroCircumference = macroRadius * 2 * Math.PI

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.sheetContainer}
          activeOpacity={0.95}
          onPress={onPressContent}
        >
          {/* Handle bar */}
          <View style={styles.header}>
            <View style={styles.handle} />
          </View>

          {/* Title row */}
          <View style={styles.titleRow}>
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

          {/* Calories Hero — Rep AI style: big number left, ring right */}
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
                <G
                  rotation="-90"
                  origin={`${calSize / 2}, ${calSize / 2}`}
                >
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

          {/* Macros Grid — Rep AI style: value + "left" label on top, ring below */}
          <View style={styles.macroGrid}>
            {/* Protein */}
            <View style={styles.macroCard}>
              <Text style={styles.macroValue}>
                {roundMacro(protOver ? protein_g - safeProtGoal : protRemaining)}g
              </Text>
              <Text style={styles.macroLabel}>
                Protein {protOver ? 'over' : 'left'}
              </Text>
              <View style={styles.macroRingContainer}>
                <Svg width={macroSize} height={macroSize}>
                  <G
                    rotation="-90"
                    origin={`${macroSize / 2}, ${macroSize / 2}`}
                  >
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
                  <MaterialCommunityIcons name="food-drumstick" size={16} color="#F87171" />
                </View>
              </View>
            </View>

            {/* Carbs */}
            <View style={styles.macroCard}>
              <Text style={styles.macroValue}>
                {roundMacro(carbOver ? carbs_g - safeCarbGoal : carbRemaining)}g
              </Text>
              <Text style={styles.macroLabel}>
                Carbs {carbOver ? 'over' : 'left'}
              </Text>
              <View style={styles.macroRingContainer}>
                <Svg width={macroSize} height={macroSize}>
                  <G
                    rotation="-90"
                    origin={`${macroSize / 2}, ${macroSize / 2}`}
                  >
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

            {/* Fat */}
            <View style={styles.macroCard}>
              <Text style={styles.macroValue}>
                {roundMacro(fatOver ? fat_g - safeFatGoal : fatRemaining)}g
              </Text>
              <Text style={styles.macroLabel}>
                Fats {fatOver ? 'over' : 'left'}
              </Text>
              <View style={styles.macroRingContainer}>
                <Svg width={macroSize} height={macroSize}>
                  <G
                    rotation="-90"
                    origin={`${macroSize / 2}, ${macroSize / 2}`}
                  >
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

          {/* Calorie breakdown bar — our unique touch */}
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
                <View
                  style={[
                    styles.breakdownDot,
                    { backgroundColor: '#F87171' },
                  ]}
                />
                <Text style={styles.breakdownLabelText}>
                  {roundMacro((protein_g * 4 / Math.max(calories, 1)) * 100)}%
                </Text>
              </View>
              <View style={styles.breakdownLabelItem}>
                <View
                  style={[
                    styles.breakdownDot,
                    { backgroundColor: '#FBBF24' },
                  ]}
                />
                <Text style={styles.breakdownLabelText}>
                  {roundMacro((carbs_g * 4 / Math.max(calories, 1)) * 100)}%
                </Text>
              </View>
              <View style={styles.breakdownLabelItem}>
                <View
                  style={[
                    styles.breakdownDot,
                    { backgroundColor: '#60A5FA' },
                  ]}
                />
                <Text style={styles.breakdownLabelText}>
                  {roundMacro((fat_g * 9 / Math.max(calories, 1)) * 100)}%
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { bottom: number },
  isDark: boolean,
) =>
  // Explicit elevated surfaces keep cards visible even when theme tokens are close.
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 20,
      paddingBottom: insets.bottom + 24,
    },
    header: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 8,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      paddingHorizontal: 4,
    },
    title: {
      fontSize: 22,
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
    // Calories hero — big number left, ring right
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
    // Macro cards grid — value + label on top, ring below
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
    // Breakdown bar
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
