import { ScreenHeader } from '@/components/screen-header'
import { FoodLibrarySheet, type FoodLibraryMealDraft } from '@/components/food-library-sheet'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { setPendingFoodLibraryChatText } from '@/lib/food-library-handoff'
import { haptic, hapticSuccess } from '@/lib/haptics'
import type { DailyLogMeal } from '@/types/database.types'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Platform, ToastAndroid, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
        <ScreenHeader
          title="Food Library"
          onLeftPress={handleClose}
          leftIcon="arrow-back"
        />
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
      />
    </View>
  )
}
