import { useTheme } from '@/contexts/theme-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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
  maintenanceCalories?: number | null
  onUpdateCalorieGoal?: (goal: number) => Promise<void>
}

const roundMacro = (value: number): number => Math.round(value)

export function DailyMacrosSheet({
  visible,
  onClose,
  totals,
  goals,
  maintenanceCalories,
  onUpdateCalorieGoal,
}: DailyMacrosSheetProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const pagerRef = useRef<ScrollView>(null)
  const [sheetWidth, setSheetWidth] = useState(0)
  const [activePage, setActivePage] = useState(0)
  const [calorieInput, setCalorieInput] = useState('')
  const [isSavingGoal, setIsSavingGoal] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const styles = createStyles(colors, insets, isDark)

  const { calories, protein_g, carbs_g, fat_g, meal_count } = totals

  const safeCalGoal = goals.calorie_goal || maintenanceCalories || 2000
  const safeProtGoal = goals.protein_goal_g || 150
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

  const pageWidth = sheetWidth || windowWidth
  const presetBase =
    maintenanceCalories && maintenanceCalories > 0
      ? maintenanceCalories
      : safeCalGoal

  const goalPresets = useMemo(
    () => [
      {
        label: 'Aggressive Cut',
        calories: Math.max(1200, Math.round(presetBase * 0.75)),
        color: '#EF4444',
      },
      {
        label: 'Cut',
        calories: Math.max(1200, Math.round(presetBase * 0.85)),
        color: '#F97316',
      },
      {
        label: 'Maintenance',
        calories: Math.round(presetBase),
        color: '#3B82F6',
      },
      {
        label: 'Bulk',
        calories: Math.round(presetBase * 1.1),
        color: '#10B981',
      },
    ],
    [presetBase],
  )

  useEffect(() => {
    if (!visible) {
      setGoalSaved(false)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      return
    }
    setActivePage(0)
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: 0, animated: false })
    })
  }, [visible])

  useEffect(() => {
    if (!visible) return
    setCalorieInput(roundMacro(safeCalGoal).toString())
  }, [safeCalGoal, visible])

  const handlePagerMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!pageWidth) return
      const nextPage = Math.round(event.nativeEvent.contentOffset.x / pageWidth)
      if (nextPage !== activePage) {
        setActivePage(nextPage)
      }
    },
    [activePage, pageWidth],
  )

  const parsedCalorieInput = parseInt(calorieInput.replace(/[^0-9]/g, ''), 10)
  const isDirty =
    !Number.isNaN(parsedCalorieInput) && parsedCalorieInput !== safeCalGoal

  const saveGoal = useCallback(
    async (nextGoal: number) => {
      if (!onUpdateCalorieGoal) return
      try {
        setIsSavingGoal(true)
        await onUpdateCalorieGoal(nextGoal)
        setGoalSaved(true)
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => setGoalSaved(false), 1500)
      } catch (error) {
        console.error('[DailyMacrosSheet] Failed to update calorie goal:', error)
        Alert.alert('Error', 'Unable to update calorie goal right now.')
      } finally {
        setIsSavingGoal(false)
      }
    },
    [onUpdateCalorieGoal],
  )

  const handleSaveGoal = useCallback(async () => {
    if (!isDirty) return
    const parsedGoal = parseInt(calorieInput.replace(/[^0-9]/g, ''), 10)
    if (Number.isNaN(parsedGoal)) {
      Alert.alert('Invalid Goal', 'Enter a number like 2200 kcal.')
      return
    }

    const boundedGoal = Math.max(1200, Math.min(6000, parsedGoal))
    setCalorieInput(boundedGoal.toString())
    await saveGoal(boundedGoal)
  }, [calorieInput, isDirty, saveGoal])

  const handlePresetPress = useCallback(
    async (presetCalories: number) => {
      setCalorieInput(presetCalories.toString())
      await saveGoal(presetCalories)
    },
    [saveGoal],
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoiding}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            style={styles.sheetContainer}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.header}>
              <View style={styles.handle} />
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.title}>Today&apos;s Nutrition</Text>
              <TouchableOpacity
                style={styles.foodLogButton}
                onPress={() => {
                  router.push('/body-log/daily-food-log')
                  setTimeout(onClose, 50)
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.foodLogButtonText}>Food Log</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={styles.pagerViewport}
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width
                if (width && width !== sheetWidth) {
                  setSheetWidth(width)
                }
              }}
            >
              <ScrollView
                ref={pagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onMomentumScrollEnd={handlePagerMomentumEnd}
                scrollEventThrottle={16}
                keyboardShouldPersistTaps="handled"
              >
                <View style={[styles.page, { width: pageWidth }]}>
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
                </View>

                <View style={[styles.page, styles.goalPage, { width: pageWidth }]}>
                  <Text style={styles.goalCardLabel}>Daily goal</Text>
                  <View style={styles.goalCard}>
                    <View style={styles.goalCardRow}>
                      <View style={styles.goalCardInputGroup}>
                        <TextInput
                          style={styles.goalCardInput}
                          value={calorieInput}
                          onChangeText={(v) => {
                            setCalorieInput(v)
                            setGoalSaved(false)
                          }}
                          keyboardType="numeric"
                          placeholder="2200"
                          placeholderTextColor={colors.textTertiary}
                          returnKeyType="done"
                          onSubmitEditing={() => void handleSaveGoal()}
                        />
                        <Text style={styles.goalCardUnit}>kcal</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.goalCardSave,
                          goalSaved && styles.goalCardSaveDone,
                          (!isDirty || !onUpdateCalorieGoal) &&
                            !goalSaved &&
                            styles.goalCardSaveDisabled,
                        ]}
                        onPress={() => void handleSaveGoal()}
                        activeOpacity={0.85}
                        disabled={!onUpdateCalorieGoal || isSavingGoal || !isDirty}
                      >
                        {isSavingGoal ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : goalSaved ? (
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        ) : (
                          <Text
                            style={[
                              styles.goalCardSaveText,
                              !isDirty && styles.goalCardSaveTextDisabled,
                            ]}
                          >
                            Save
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.goalPresetSectionLabel}>Quick set</Text>
                  <View style={styles.goalPresetGrid}>
                    {goalPresets.map((preset) => {
                      const isSelected = roundMacro(safeCalGoal) === preset.calories
                      return (
                        <TouchableOpacity
                          key={preset.label}
                          style={[
                            styles.goalPresetCard,
                            isSelected && styles.goalPresetCardSelected,
                          ]}
                          onPress={() => {
                            void handlePresetPress(preset.calories)
                          }}
                          activeOpacity={0.85}
                          disabled={isSavingGoal}
                        >
                          <Text style={styles.goalPresetLabel}>
                            {preset.label}
                          </Text>
                          <Text style={styles.goalPresetValue}>
                            {preset.calories} kcal
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>

            <View style={styles.paginationDots}>
              <View
                style={[
                  styles.paginationDot,
                  activePage === 0 && styles.paginationDotActive,
                ]}
              />
              <View
                style={[
                  styles.paginationDot,
                  activePage === 1 && styles.paginationDotActive,
                ]}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const createStyles = (
  colors: ReturnType<typeof useThemedColors>,
  insets: { bottom: number },
  isDark: boolean,
) =>
  StyleSheet.create({
    keyboardAvoiding: {
      flex: 1,
    },
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
      paddingBottom: insets.bottom + 20,
      maxHeight: '90%',
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
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    foodLogButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
    },
    foodLogButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    pagerViewport: {
      overflow: 'hidden',
    },
    page: {
      paddingBottom: 4,
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
    goalPage: {
      gap: 16,
    },
    goalCard: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED',
      paddingHorizontal: 24,
      paddingVertical: 20,
      gap: 12,
    },
    goalCardLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    goalCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    goalCardInputGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    goalCardInput: {
      flexShrink: 1,
      fontSize: 36,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1,
      paddingVertical: 4,
      paddingHorizontal: 0,
    },
    goalCardUnit: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    goalCardSave: {
      minWidth: 72,
      borderRadius: 12,
      backgroundColor: colors.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    goalCardSaveDisabled: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB',
    },
    goalCardSaveDone: {
      backgroundColor: '#10B981',
    },
    goalCardSaveText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    goalCardSaveTextDisabled: {
      color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
    },
    goalPresetSectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    goalPresetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    goalPresetCard: {
      width: '48%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#E8E8ED',
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    goalPresetCardSelected: {
      borderColor: colors.textPrimary,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
    },
    goalPresetLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    goalPresetValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    paginationDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : '#D1D5DB',
    },
    paginationDotActive: {
      width: 22,
      backgroundColor: colors.textPrimary,
    },
  })
