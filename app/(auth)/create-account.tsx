import { HapticButton } from '@/components/haptic-button'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CreateAccountScreen() {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const { user, isAnonymous, linkWithGoogle, linkWithApple } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isAppleLoading, setIsAppleLoading] = useState(false)

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  const handleEmailSignup = () => {
    router.push('/(auth)/signup-email')
  }

  const handleLinkApple = async () => {
    if (!isAnonymous) {
      Alert.alert('Already Signed In', 'You already have a linked account.')
      return
    }

    setIsAppleLoading(true)
    try {
      await linkWithApple()

      if (user?.id) {
        try {
          await database.profiles.update(user.id, {
            is_guest: false,
          })
        } catch (profileError) {
          console.error('[CreateAccount] Error updating profile:', profileError)
        }
      }

      Alert.alert(
        'Account Created!',
        'Your data is now synced with your Apple account.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to link with Apple'
      if (!errorMessage.includes('cancelled')) {
        Alert.alert('Error', errorMessage)
      }
    } finally {
      setIsAppleLoading(false)
    }
  }

  const handleLinkGoogle = async () => {
    if (!isAnonymous) {
      Alert.alert('Already Signed In', 'You already have a linked account.')
      return
    }

    setIsGoogleLoading(true)
    try {
      await linkWithGoogle()

      if (user?.id) {
        try {
          await database.profiles.update(user.id, {
            is_guest: false,
          })
        } catch (profileError) {
          console.error('[CreateAccount] Error updating profile:', profileError)
        }
      }

      Alert.alert(
        'Account Created!',
        'Your data is now synced with your Google account.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to link with Google'
      if (!errorMessage.includes('cancelled')) {
        Alert.alert('Error', errorMessage)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  if (!isAnonymous) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.wrapper}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.centeredContent}>
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={colors.primary}
            />
            <Text style={styles.alreadyLinkedTitle}>
              Account Already Linked
            </Text>
            <Text style={styles.alreadyLinkedSubtitle}>
              Your account is already connected. Your data is synced and secure.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Top Section: Logos and Text */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoRow}>
              <Ionicons
                name="arrow-up"
                size={32}
                color="#E8F953"
                style={[styles.icon, { transform: [{ rotate: '-15deg' }] }]}
              />
              <Ionicons
                name="arrow-undo"
                size={32}
                color="#9C5BF5"
                style={[styles.icon, { transform: [{ rotate: '15deg' }] }]}
              />
            </View>
            <View style={styles.logoRow}>
              <Ionicons
                name="heart"
                size={32}
                color="#FF5F85"
                style={[styles.icon, { transform: [{ rotate: '-10deg' }] }]}
              />
              <Ionicons
                name="ellipse"
                size={32}
                color="#3DDA67"
                style={styles.icon}
              />
            </View>
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>
              Sign up now for the full experience. It&apos;s free!
            </Text>
            <Text style={styles.subtitle}>
              With an account, you will be able to sync your workouts, track
              your progress, share workouts with others, and do a lot more.
            </Text>
          </View>
        </View>

        {/* Bottom Section: Buttons and Footer */}
        <View style={styles.bottomSection}>
          <View style={styles.buttonsContainer}>
            <HapticButton
              style={styles.emailButton}
              onPress={handleEmailSignup}
              hapticStyle="medium"
            >
              <Text style={styles.emailButtonText}>Sign up with Email</Text>
            </HapticButton>

            <View style={styles.socialRow}>
              {Platform.OS === 'ios' && (
                <View style={styles.socialButtonWrapper}>
                  <HapticButton
                    style={styles.socialButton}
                    onPress={handleLinkApple}
                    disabled={isAppleLoading || isGoogleLoading}
                  >
                    {isAppleLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
                        <Text style={styles.socialButtonText}>Apple</Text>
                      </>
                    )}
                  </HapticButton>
                </View>
              )}

              <View style={styles.socialButtonWrapper}>
                <HapticButton
                  style={styles.socialButton}
                  onPress={handleLinkGoogle}
                  disabled={isAppleLoading || isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={24} color="#FFFFFF" />
                      <Text style={styles.socialButtonText}>Google</Text>
                    </>
                  )}
                </HapticButton>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.termsText}>
              By signing in, you agree to Privacy Policy and Terms of Use
            </Text>

            <TouchableOpacity onPress={handleBack} style={styles.notNowButton}>
              <Text style={styles.notNowText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    wrapper: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
    },
    topSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 40,
    },
    bottomSection: {
      justifyContent: 'flex-end',
      paddingBottom: 24,
      gap: 32,
    },
    logoContainer: {
      marginBottom: 32,
      gap: 8,
    },
    logoRow: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
    },
    icon: {
      // Add subtle shadow or glow if needed
    },
    textContainer: {
      alignItems: 'center',
      gap: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 34,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 16,
    },
    buttonsContainer: {
      width: '100%',
      gap: 12,
    },
    emailButton: {
      height: 56,
      backgroundColor: '#FFFFFF',
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    emailButtonText: {
      color: '#000000',
      fontSize: 17,
      fontWeight: '600',
    },
    socialRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    socialButtonWrapper: {
      flex: 1,
    },
    socialButton: {
      height: 56,
      backgroundColor: '#1C1C1E',
      borderRadius: 28,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    socialButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },
    footer: {
      alignItems: 'center',
      gap: 24,
    },
    termsText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      opacity: 0.6,
      paddingHorizontal: 16,
    },
    notNowButton: {
      paddingVertical: 12,
      paddingHorizontal: 32,
    },
    notNowText: {
      fontSize: 17,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    centeredContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 16,
    },
    alreadyLinkedTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    alreadyLinkedSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  })
