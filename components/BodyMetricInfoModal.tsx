import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useRef } from 'react'
import {
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native'

import { useThemedColors } from '@/hooks/useThemedColors'
import type { BMIRange, BodyFatRange, Gender } from '@/lib/body-log/composition-analysis'
import { getStatusColor } from '@/lib/body-log/composition-analysis'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface BodyMetricInfoModalProps {
  visible: boolean
  onClose: () => void
  metricType: 'bodyFat' | 'bmi' | 'weight'
  currentValue: string
  status: BodyFatRange | BMIRange | null
  explanation: string
  gender: Gender
}

export function BodyMetricInfoModal({
  visible,
  onClose,
  metricType,
  currentValue,
  status,
  explanation,
}: BodyMetricInfoModalProps) {
  const colors = useThemedColors()
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const backdropAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      // Slide up
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 25,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      // Slide down
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, slideAnim, backdropAnim])

  // Pan responder for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 5
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipes
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 100px or velocity is high, close
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          onClose()
        } else {
          // Otherwise, spring back to position
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 25,
            stiffness: 200,
          }).start()
        }
      },
    }),
  ).current

  const getMetricTitle = () => {
    switch (metricType) {
      case 'bodyFat':
        return 'Body Fat %'
      case 'bmi':
        return 'BMI'
      case 'weight':
        return 'Weight'
    }
  }

  const statusColors = status ? getStatusColor(status.color) : null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.contentContainer,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View
              style={[styles.handle, { backgroundColor: colors.textSecondary }]}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {getMetricTitle()}
              </Text>
            </View>

            {/* Current Value Display */}
            <View
              style={[
                styles.valueCard,
                {
                  backgroundColor: colors.backgroundLight,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.valueLabel, { color: colors.textSecondary }]}
              >
                Your Current Value
              </Text>
              <Text style={[styles.valueText, { color: colors.text }]}>
                {currentValue}
              </Text>
            </View>

            {/* Status Badge */}
            {status && statusColors && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColors.background },
                ]}
              >
                <Ionicons
                  name={status.icon as any}
                  size={20}
                  color={statusColors.primary}
                />
                <Text
                  style={[styles.statusLabel, { color: statusColors.text }]}
                >
                  {status.label}
                </Text>
              </View>
            )}

            {/* Explanation */}
            <View style={styles.section}>
              <Text
                style={[styles.sectionTitle, { color: colors.text }]}
              >
                What This Means
              </Text>
              <Text
                style={[styles.sectionText, { color: colors.textSecondary }]}
              >
                {explanation}
              </Text>
            </View>

            {/* Status Description */}
            {status && (
              <View style={styles.section}>
                <Text
                  style={[styles.sectionTitle, { color: colors.text }]}
                >
                  Your Status
                </Text>
                <Text
                  style={[styles.sectionText, { color: colors.textSecondary }]}
                >
                  {status.description}
                </Text>
              </View>
            )}

            {/* Recommendation */}
            {status && (
              <View
                style={[
                  styles.recommendationCard,
                  {
                    backgroundColor: colors.primary + '12',
                    borderColor: colors.primary + '30',
                  },
                ]}
              >
                <View style={styles.recommendationHeader}>
                  <Ionicons
                    name="bulb-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.recommendationTitle,
                      { color: colors.primary },
                    ]}
                  >
                    Recommendation
                  </Text>
                </View>
                <Text
                  style={[
                    styles.recommendationText,
                    { color: colors.text },
                  ]}
                >
                  {status.recommendation}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  contentContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  valueCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  valueText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  recommendationCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  recommendationText: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
})
