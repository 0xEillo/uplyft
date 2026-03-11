import {
    ProfileCard,
    useProfileCardDimensions,
} from '@/components/Profile/ProfileCard'
import { database } from '@/lib/database'
import { haptic } from '@/lib/haptics'
import { getRoutineImageUrl } from '@/lib/utils/routine-images'
import { WorkoutRoutineWithDetails } from '@/types/database.types'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    FlatList,
    StyleSheet,
    View,
} from 'react-native'

interface ProfileRoutinesProps {
  userId: string
  renderLeading?: (scrollToRoutines: () => void) => React.ReactNode
}

export function ProfileRoutines({
  userId,
  renderLeading,
}: ProfileRoutinesProps) {
  const router = useRouter()
  const [routines, setRoutines] = useState<WorkoutRoutineWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { cardWidth, cardHeight } = useProfileCardDimensions()
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    const loadRoutines = async () => {
      if (!userId) return
      try {
        const data = await database.workoutRoutines.getAll(userId)
        const activeRoutines = data.filter((r) => !r.is_archived)
        setRoutines(activeRoutines)
      } catch (error) {
        console.error('Error loading routines:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRoutines()
  }, [userId])

  if (isLoading || (routines.length === 0 && !renderLeading)) {
    return null
  }

  const scrollToRoutines = () => {
    if (routines.length > 0) {
      listRef.current?.scrollToIndex({ index: 0, animated: true })
    }
  }

  const renderItem = ({ item }: { item: WorkoutRoutineWithDetails }) => {
    const imageUri = getRoutineImageUrl(item.image_path)
    
    const exerciseCount = item.workout_routine_exercises?.length || 0
    const setCount =
      item.workout_routine_exercises?.reduce(
        (sum, ex) => sum + (ex.sets?.length || 0),
        0,
      ) || 0

    const subtext = `${exerciseCount} exercises • ${setCount} sets`

    return (
      <ProfileCard
        title={item.name}
        subtext={subtext}
        imageUri={imageUri}
        tintColor={item.tint_color}
        onPress={() => {
          haptic('light')
          router.push({
            pathname: '/routine/[routineId]',
            params: { routineId: item.id },
          })
        }}
        width={cardWidth}
        height={cardHeight}
      />
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={routines}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        decelerationRate="fast"
        snapToAlignment="start"
        ListHeaderComponent={
          renderLeading ? (
            <View style={styles.leadingWrapper}>
              {renderLeading(scrollToRoutines)}
            </View>
          ) : undefined
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  listContent: {
    paddingHorizontal: 14,
    gap: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  leadingWrapper: {
    marginRight: 0,
  },
})
