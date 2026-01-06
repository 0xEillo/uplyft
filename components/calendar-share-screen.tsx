import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { Ionicons } from '@expo/vector-icons'
import React, { useRef, useState } from 'react'
import {
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { ConsistencyWidget } from './shareable-widgets/ConsistencyWidget'

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

interface CalendarShareScreenProps {
  visible: boolean
  workoutDates: string[] | Set<string>
  userTag?: string
  displayName?: string
  onClose: () => void
  onShare: (
    widgetIndex: number,
    shareType: 'instagram' | 'general',
    widgetRef: View,
  ) => void
}

export function CalendarShareScreen({
  visible,
  workoutDates,
  userTag,
  displayName,
  onClose,
  onShare,
}: CalendarShareScreenProps) {
  const colors = useThemedColors()
  const { user } = useAuth()
  const scrollViewRef = useRef<ScrollView>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [backgroundMode, setBackgroundMode] = useState<
    'light' | 'dark' | 'transparent'
  >('dark')

  // Refs for each widget
  const widgetMonthRef = useRef<View>(null)
  const widgetYearlyRef = useRef<View>(null)
  const widgetMultiYearRef = useRef<View>(null)

  const widgetRefs = [widgetMonthRef, widgetYearlyRef, widgetMultiYearRef]
  const widgetVariants: ('month' | 'yearly' | 'multi-year')[] = ['month', 'yearly', 'multi-year']

  // Animation values
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
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          gestureState.dy > 5 && gestureState.dy > Math.abs(gestureState.dx)
        )
      },
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

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const page = Math.round(offsetX / SCREEN_WIDTH)
    setCurrentPage(page)
  }

  const handleShareGeneral = () => {
    const currentRef = widgetRefs[currentPage]
    if (currentRef?.current) {
      onShare(currentPage, 'general', currentRef.current)
    }
  }

  const handleBackdropPress = () => {
    onClose()
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
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.header}>
            <View style={styles.handleBar} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH}
            snapToAlignment="center"
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
          >
            {widgetVariants.map((variant, index) => (
              <View key={variant} style={styles.widgetPage}>
                {backgroundMode === 'transparent' && (
                  <View style={[StyleSheet.absoluteFill, styles.checkerboardContainer]}>
                    <View style={styles.checkerboardRow}>
                      {Array.from({ length: 420 }).map((_, i) => {
                        const squaresPerRow = Math.floor((SCREEN_WIDTH - 40) / 20);
                        const row = Math.floor(i / squaresPerRow);
                        const col = i % squaresPerRow;
                        return (
                          <View
                            key={i}
                            style={[
                              styles.checkerboardSquare,
                              { backgroundColor: (row + col) % 2 === 0 ? '#3A3A3C' : '#2C2C2E' },
                            ]}
                          />
                        );
                      })}
                    </View>
                  </View>
                )}
                <ConsistencyWidget
                  ref={widgetRefs[index]}
                  workoutDates={workoutDates}
                  variant={variant}
                  backgroundMode={backgroundMode}
                  userTag={userTag}
                  displayName={displayName}
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.pageIndicators}>
            {widgetRefs.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pageIndicator,
                  {
                    backgroundColor:
                      currentPage === index ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.shareButtons}>
            <TouchableOpacity
              style={[styles.shareButton, styles.backgroundButton]}
              onPress={() => {
                const modes: ('light' | 'dark' | 'transparent')[] = [
                  'light',
                  'dark',
                  'transparent',
                ]
                const nextIndex =
                  (modes.indexOf(backgroundMode) + 1) % modes.length
                setBackgroundMode(modes[nextIndex])
              }}
              activeOpacity={0.8}
            >
              <View style={styles.backgroundIcon}>
                {backgroundMode === 'light' && (
                  <View style={[styles.bgCircle, { backgroundColor: '#FFF' }]} />
                )}
                {backgroundMode === 'dark' && (
                  <View style={[styles.bgCircle, { backgroundColor: '#000' }]} />
                )}
                {backgroundMode === 'transparent' && (
                  <View
                    style={[
                      styles.bgCircle,
                      {
                        backgroundColor: '#D1D1D6',
                        borderWidth: 1,
                        borderColor: '#FFF',
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.backgroundButtonText}>
                {backgroundMode.charAt(0).toUpperCase() + backgroundMode.slice(1)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.shareButton,
                styles.shareButtonFull,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleShareGeneral}
              activeOpacity={0.8}
            >
              <Ionicons
                name="share-outline"
                size={18}
                color="#FFFFFF"
                style={styles.moreIcon}
              />
              <Text style={[styles.shareButtonText, { color: '#FFFFFF' }]}>
                Share
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '92%',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  handleBar: {
    width: 36,
    height: 5,
    backgroundColor: '#D1D1D6',
    borderRadius: 3,
    marginBottom: 16,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollViewContent: {
    alignItems: 'center',
  },
  widgetPage: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  pageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  shareButtons: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  shareButtonFull: {
    flex: 1,
  },
  moreIcon: {
    marginTop: -1,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backgroundButton: {
    backgroundColor: '#2C2C2E',
    flexDirection: 'column',
    gap: 4,
    paddingVertical: 10,
    width: 80,
  },
  backgroundIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  bgCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  backgroundButtonText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  checkerboardContainer: {
    marginVertical: 10,
    marginHorizontal: 20,
    borderRadius: 0,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
  },
  checkerboardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  checkerboardSquare: {
    width: 20,
    height: 20,
  },
})
