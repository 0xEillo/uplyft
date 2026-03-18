import { LifterLevelWidget, type LifterLevelWidgetProps } from '@/components/shareable-widgets/LifterLevelWidget'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { useWorkoutShare } from '@/hooks/useWorkoutShare'
import { Ionicons } from '@expo/vector-icons'
import React, { useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

const SCREEN_HEIGHT = Dimensions.get('window').height

type BackgroundMode = 'light' | 'dark'

interface LifterLevelShareSheetProps
  extends Omit<LifterLevelWidgetProps, 'backgroundMode'> {
  visible: boolean
  onClose: () => void
}

export function LifterLevelShareSheet({
  visible,
  onClose,
  userTag,
  displayName,
  ...widgetProps
}: LifterLevelShareSheetProps) {
  const colors = useThemedColors()
  const { user } = useAuth()
  const { shareWorkoutWidget, isSharing } = useWorkoutShare()
  const resolvedUserTag = userTag || displayName || user?.user_metadata?.user_tag || user?.user_metadata?.display_name
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('dark')
  const widgetRef = useRef<View>(null)

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const backdropAnim = useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    if (visible) {
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 5 && gestureState.dy > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          onClose()
        } else {
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

  const handleShare = async () => {
    if (!widgetRef.current) return
    await shareWorkoutWidget(widgetRef, 'general', 'lifter-level')
  }

  const toggleBackground = () => {
    setBackgroundMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.bg,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle bar */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Share Lifter Level
            </Text>
          </View>

          {/* Widget preview */}
          <View style={styles.widgetContainer}>
            <LifterLevelWidget
              ref={widgetRef}
              {...widgetProps}
              userTag={resolvedUserTag}
              displayName={undefined}
              backgroundMode={backgroundMode}
            />
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.bgButton, { backgroundColor: colors.surfaceCard }]}
              onPress={toggleBackground}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.bgCircle,
                  {
                    backgroundColor:
                      backgroundMode === 'dark' ? '#0D0D1A' : '#FFFFFF',
                    borderColor: colors.border,
                  },
                ]}
              />
              <Text style={[styles.bgButtonText, { color: colors.textPrimary }]}>
                {backgroundMode === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.shareButton,
                { backgroundColor: colors.brandPrimary },
                isSharing && styles.shareButtonDisabled,
              ]}
              onPress={handleShare}
              disabled={isSharing}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>
                {isSharing ? 'Sharing…' : 'Share'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  handleBar: {
    width: 36,
    height: 5,
    backgroundColor: '#D1D1D6',
    borderRadius: 3,
    marginTop: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  widgetContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actions: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
  },
  bgButton: {
    width: 80,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bgCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  bgButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
