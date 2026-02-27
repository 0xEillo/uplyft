import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { ScreenHeader } from '@/components/screen-header'
import { FoodLibrarySheet, type FoodLibraryMealDraft } from '@/components/food-library-sheet'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { setPendingFoodLibraryChatText } from '@/lib/food-library-handoff'
import { haptic, hapticSuccess } from '@/lib/haptics'
import type { DailyLogMeal } from '@/types/database.types'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function FoodItemHeader({
  isLogging,
  onBack,
  onLog,
}: {
  isLogging: boolean
  onBack: () => void
  onLog: () => void
}) {
  const colors = useThemedColors()
  const styles = createStyles(colors)

  return (
    <View style={styles.foodItemHeader}>
      <LiquidGlassSurface style={styles.headerIconShell}>
        <TouchableOpacity onPress={onBack} style={styles.headerIconButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </LiquidGlassSurface>

      <View style={styles.foodItemHeaderCenter}>
        <Text style={styles.foodItemHeaderTitle}>Food Item</Text>
      </View>

      <LiquidGlassSurface style={styles.headerIconShell}>
        <TouchableOpacity
          onPress={onLog}
          disabled={isLogging}
          style={styles.headerIconButton}
        >
          {isLogging ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Ionicons name="checkmark" size={22} color={colors.brandPrimary} />
          )}
        </TouchableOpacity>
      </LiquidGlassSurface>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    foodItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    headerIconShell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    foodItemHeaderCenter: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    foodItemHeaderTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  })

const getLocalDateString = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function FoodLibraryScreen() {
  const router = useRouter()
  const colors = useThemedColors()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [recentMeals, setRecentMeals] = useState<DailyLogMeal[]>([])
  const [isRecentMealsLoading, setIsRecentMealsLoading] = useState(false)
  const [foodDetail, setFoodDetail] = useState<{
    itemName: string | null
    isSaved: boolean
    isLogging: boolean
    isChatting: boolean
    isSaving: boolean
    onLog: () => void
    onUseInChat: () => void
    onSave: () => void
    closeToFoodLibrary: (() => void) | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadRecentMeals = async () => {
      if (!user?.id) {
        setRecentMeals([])
        setIsRecentMealsLoading(false)
        return
      }

      setIsRecentMealsLoading(true)

      try {
        const data = await database.dailyLog.getRecentMeals(user.id, 28)
        if (cancelled) return
        setRecentMeals(data)
      } catch (error) {
        console.error('[FoodLibraryScreen] Failed to load recent meals:', error)
        if (!cancelled) setRecentMeals([])
      } finally {
        if (!cancelled) setIsRecentMealsLoading(false)
      }
    }

    loadRecentMeals()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const handleClose = useCallback(() => {
    haptic('light')
    router.back()
  }, [router])

  const handleHeaderBack = useCallback(() => {
    if (foodDetail?.closeToFoodLibrary) {
      foodDetail.closeToFoodLibrary()
      return
    }
    handleClose()
  }, [handleClose, foodDetail?.closeToFoodLibrary])

  const handleFoodBankItemDetailChange = useCallback(
    (detail: {
      isOpen: boolean
      itemName: string | null
      isSaved: boolean
      isLogging: boolean
      isChatting: boolean
      isSaving: boolean
      onLog: () => void
      onUseInChat: () => void
      onSave: () => void
      closeToFoodLibrary: (() => void) | null
    }) => {
      if (detail.isOpen) {
        setFoodDetail({
          itemName: detail.itemName,
          isSaved: detail.isSaved,
          isLogging: detail.isLogging,
          isChatting: detail.isChatting,
          isSaving: detail.isSaving,
          onLog: detail.onLog,
          onUseInChat: detail.onUseInChat,
          onSave: detail.onSave,
          closeToFoodLibrary: detail.closeToFoodLibrary,
        })
      } else {
        setFoodDetail(null)
      }
    },
    [],
  )

  const handleLogMeal = useCallback(
    async (meal: FoodLibraryMealDraft) => {
      if (!user?.id) {
        Alert.alert('Sign In Required', 'Please sign in to save food logs.')
        throw new Error('SIGN_IN_REQUIRED')
      }

      await database.dailyLog.logMeal(user.id, {
        description: meal.description,
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        source: meal.source ?? 'manual',
        confidence: meal.confidence ?? null,
        metadata: meal.metadata ?? { from: 'food_library_page' },
        logDate: getLocalDateString(),
      })

      await hapticSuccess()

      if (Platform.OS === 'android') {
        ToastAndroid.show('Meal logged', ToastAndroid.SHORT)
      }
    },
    [user?.id],
  )

  const handleUseFoodText = useCallback(async (text: string) => {
    await setPendingFoodLibraryChatText(text)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top, backgroundColor: colors.bg }}>
        {foodDetail ? (
          <FoodItemHeader
            isLogging={foodDetail.isLogging}
            onBack={handleHeaderBack}
            onLog={foodDetail.onLog}
          />
        ) : (
          <ScreenHeader
            title="Food Library"
            onLeftPress={handleHeaderBack}
            leftIcon="arrow-back"
          />
        )}
      </View>
      <FoodLibrarySheet
        visible
        presentation="page"
        onClose={handleClose}
        showTopHeader={false}
        userId={user?.id}
        recentMeals={recentMeals}
        isRecentMealsLoading={isRecentMealsLoading}
        onLogMeal={handleLogMeal}
        onUseFoodText={handleUseFoodText}
        onFoodBankItemDetailChange={handleFoodBankItemDetailChange}
      />
    </View>
  )
}
