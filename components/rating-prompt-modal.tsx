import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useRatingPrompt } from '@/contexts/rating-prompt-context';
import * as Haptics from 'expo-haptics';

export function RatingPromptModal() {
  const colors = useThemedColors();
  const { isVisible, handleRate, handleDismiss } = useRatingPrompt();
  const styles = createStyles(colors);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (isVisible) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const handleRatePress = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    handleRate();
  };

  const handleMaybeLaterPress = async () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    handleDismiss(0); // Will use stored workout count from context
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleMaybeLaterPress}
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Pressable style={styles.backdropPress} onPress={handleMaybeLaterPress}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Pressable>
              {/* Checkmark Icon in Brand Color Circle */}
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name="checkmark" size={32} color="#FFFFFF" />
                </View>
              </View>

              {/* Headline */}
              <Text style={styles.headline}>First Workout Complete!</Text>

              {/* Body Text */}
              <Text style={styles.bodyText}>
                You just crushed your first workout! Mind taking 5 seconds to rate
                Rep AI? It helps us grow! 💪
              </Text>

              {/* Star Rating Visual */}
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name="star"
                    size={24}
                    color="#FF6B35"
                    style={styles.star}
                  />
                ))}
              </View>

              {/* Primary Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={handleRatePress}
              >
                <Text style={styles.primaryButtonText}>Rate Rep AI</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                  style={styles.buttonIcon}
                />
              </Pressable>

              {/* Secondary Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={handleMaybeLaterPress}
              >
                <Text style={styles.secondaryButtonText}>Maybe Later</Text>
              </Pressable>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdropPress: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContainer: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        },
        android: {
          elevation: 12,
        },
      }),
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#FF6B35',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headline: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    bodyText: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
      gap: 4,
    },
    star: {
      marginHorizontal: 2,
    },
    primaryButton: {
      backgroundColor: '#FF6B35',
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 24,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    primaryButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonIcon: {
      marginLeft: 8,
    },
    secondaryButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryButtonPressed: {
      opacity: 0.5,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
    },
  });
