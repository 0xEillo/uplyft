import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import React, { useState } from 'react'
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useThemedColors } from '@/hooks/useThemedColors'

export interface ManualFoodLogData {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  servingSize?: string
}

interface ManualFoodLogSheetProps {
  visible: boolean
  foodData: ManualFoodLogData | null
  onClose: () => void
  onLog: (data: ManualFoodLogData, quantity: number) => void
}

export function ManualFoodLogSheet({
  visible,
  foodData,
  onClose,
  onLog,
}: ManualFoodLogSheetProps) {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const [quantity, setQuantity] = useState(1)

  if (!foodData) return null

  const handleDecrease = () => {
    if (quantity > 0.25) {
      setQuantity((q) => Math.max(0.25, q - (q <= 1 ? 0.25 : 0.5)))
    }
  }

  const handleIncrease = () => {
    setQuantity((q) => q + (q < 1 ? 0.25 : 0.5))
  }

  const handleDone = () => {
    onLog(foodData, quantity)
    setQuantity(1) // reset
  }

  const cals = Math.round(foodData.calories * quantity)
  const protein = Math.round(foodData.protein * quantity)
  const carbs = Math.round(foodData.carbs * quantity)
  const fat = Math.round(foodData.fat * quantity)

  // Determine meal tag based on time of day
  const hour = new Date().getHours()
  let mealTag = 'Snack'
  if (hour >= 5 && hour < 11) mealTag = 'Breakfast'
  else if (hour >= 11 && hour < 15) mealTag = 'Lunch'
  else if (hour >= 15 && hour < 22) mealTag = 'Dinner'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceSheet,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.dragHandle} />

          <View style={styles.header}>
            <View style={[styles.mealTag, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={[styles.mealTagText, { color: colors.textPrimary }]}>
                {mealTag}
              </Text>
            </View>
          </View>

          <View style={styles.titleRow}>
            <Text
              style={[styles.foodName, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {foodData.name}
            </Text>
            <View style={[styles.stepper, { borderColor: colors.border }]}>
              <TouchableOpacity onPress={handleDecrease} style={styles.stepperBtn}>
                <Ionicons name="remove" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: colors.textPrimary }]}>
                {quantity}
              </Text>
              <TouchableOpacity onPress={handleIncrease} style={styles.stepperBtn}>
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.macrosGrid}>
            <View style={[styles.macroCard, { backgroundColor: colors.surfaceCard }]}>
              <View style={styles.macroIconBg}>
                <Ionicons name="flame" size={18} color="#000" />
              </View>
              <View style={styles.macroTextCol}>
                <Text style={[styles.macroLabel, { color: colors.textTertiary }]}>
                  Calories
                </Text>
                <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                  {cals}
                </Text>
              </View>
            </View>

            <View style={[styles.macroCard, { backgroundColor: colors.surfaceCard }]}>
              <View style={[styles.macroIconBg, { backgroundColor: '#FFF0E6' }]}>
                <Ionicons name="nutrition" size={18} color="#FBBF24" />
              </View>
              <View style={styles.macroTextCol}>
                <Text style={[styles.macroLabel, { color: colors.textTertiary }]}>
                  Carbs
                </Text>
                <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                  {carbs}g
                </Text>
              </View>
            </View>

            <View style={[styles.macroCard, { backgroundColor: colors.surfaceCard }]}>
              <View style={[styles.macroIconBg, { backgroundColor: '#FFE6E6' }]}>
                <MaterialCommunityIcons name="food-drumstick" size={18} color="#F87171" />
              </View>
              <View style={styles.macroTextCol}>
                <Text style={[styles.macroLabel, { color: colors.textTertiary }]}>
                  Protein
                </Text>
                <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                  {protein}g
                </Text>
              </View>
            </View>

            <View style={[styles.macroCard, { backgroundColor: colors.surfaceCard }]}>
              <View style={[styles.macroIconBg, { backgroundColor: '#E6F0FF' }]}>
                <Ionicons name="water" size={18} color="#60A5FA" />
              </View>
              <View style={styles.macroTextCol}>
                <Text style={[styles.macroLabel, { color: colors.textTertiary }]}>
                  Fats
                </Text>
                <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                  {fat}g
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.textPrimary }]}
              onPress={handleDone}
            >
              <Text style={[styles.doneButtonText, { color: colors.bg }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  mealTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mealTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  foodName: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    padding: 8,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'center',
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  macroCard: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  macroIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  macroTextCol: {
    flex: 1,
  },
  macroLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  doneButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 30,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
})
