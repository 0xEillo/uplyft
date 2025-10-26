import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface SwipeTutorialOverlayProps {
  onDismiss: () => void;
}

export default function SwipeTutorialOverlay({ onDismiss }: SwipeTutorialOverlayProps) {
  const overlayOpacity = useSharedValue(0);
  const handTranslateX = useSharedValue(0);

  useEffect(() => {
    // Fade in overlay
    overlayOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.ease,
    });

    // Delay animation start so user can read the text first
    setTimeout(() => {
      handTranslateX.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(-150, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(-150, { duration: 400 }),
        ),
        -1,
        false
      );
    }, 1000);

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      overlayOpacity.value = withTiming(
        0,
        {
          duration: 400,
          easing: Easing.ease,
        },
        (finished) => {
          if (finished) {
            runOnJS(onDismiss)();
          }
        }
      );
    }, 5000);

    return () => clearTimeout(timer);
  }, [handTranslateX, onDismiss, overlayOpacity]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: handTranslateX.value }],
  }));

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <View style={styles.content}>
          <Animated.View style={[styles.handContainer, handAnimatedStyle]}>
            <Ionicons name="hand-left" size={64} color="#fff" />
          </Animated.View>
          <Text style={styles.text}>Swipe left for body log</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  handContainer: {
    marginBottom: 20,
  },
  text: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
});
