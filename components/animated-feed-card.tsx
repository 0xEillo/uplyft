import { AsyncPrFeedCard } from '@/components/async-pr-feed-card'
import { WorkoutSessionWithDetails } from '@/types/database.types'
import { memo, useEffect, useRef } from 'react'
import { Animated } from 'react-native'

interface AnimatedFeedCardProps {
  workout: WorkoutSessionWithDetails
  onDelete: () => void
  index: number
  isNew?: boolean
  isDeleting?: boolean
  isFirst?: boolean
}

/**
 * Wrapper component that adds elegant slide-in and slide-out animations to feed cards.
 * New cards slide in from the top while existing cards smoothly slide down.
 * Deleted cards fade out and slide up elegantly.
 */
export const AnimatedFeedCard = memo(function AnimatedFeedCard({
  workout,
  onDelete,
  index,
  isNew = false,
  isDeleting = false,
  isFirst = false,
}: AnimatedFeedCardProps) {
  const slideAnim = useRef(new Animated.Value(isNew ? -100 : 0)).current
  const opacityAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current
  const scaleAnim = useRef(new Animated.Value(isNew ? 0.95 : 1)).current

  // Entrance animation for new cards
  useEffect(() => {
    if (isNew) {
      // Elegant entrance animation for new cards
      Animated.parallel([
        // Slide down from above - slower, more luxurious
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40, // Even lower = even slower, ultra-premium feel
          friction: 9, // Slightly higher = smoother motion
          delay: 0,
        }),
        // Fade in - longer duration
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 650, // Slightly longer for smoother fade
          useNativeDriver: true,
        }),
        // Subtle scale up
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70, // Slower scale
          friction: 10,
        }),
      ]).start()
    }
  }, [isNew, slideAnim, opacityAnim, scaleAnim])

  // Exit animation for deleted cards
  useEffect(() => {
    if (isDeleting) {
      // Elegant exit animation - reverse of entrance
      Animated.parallel([
        // Slide up and out
        Animated.timing(slideAnim, {
          toValue: -120,
          duration: 500,
          useNativeDriver: true,
        }),
        // Fade out smoothly
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        // Subtle scale down
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 450,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Call onDelete after animation completes
        onDelete()
      })
    }
  }, [isDeleting, slideAnim, opacityAnim, scaleAnim, onDelete])

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <AsyncPrFeedCard
        workout={workout}
        onDelete={onDelete}
        isFirst={isFirst}
      />
    </Animated.View>
  )
})
