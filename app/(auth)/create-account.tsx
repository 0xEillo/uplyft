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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    router.back()
  }

  const handleLinkApple = async () => {
    if (!isAnonymous) {
      Alert.alert('Already Signed In', 'You already have a linked account.')
      return
    }

    setIsAppleLoading(true)
    try {
      await linkWithApple()

      // Update profile to mark as non-guest
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

      // Update profile to mark as non-guest
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
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.placeholder} />
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
      <View style={styles.wrapper}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons
                  name="cloud-upload"
                  size={48}
                  color={colors.primary}
                />
              </View>
            </View>

            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Sync Your Data</Text>
              <Text style={styles.stepSubtitle}>
                Create an account to backup your workouts and access them on any
                device. Your existing data will be preserved.
              </Text>
            </View>

            {/* Benefits */}
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.benefitText}>
                  Keep all your workout history
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.benefitText}>
                  Access your data on any device
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.benefitText}>
                  Connect with other athletes
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.benefitText}>
                  Keep your subscription if you switch phones
                </Text>
              </View>
            </View>

            <View style={styles.buttonsWrapper}>
              <View style={styles.stepContent}>
                {Platform.OS === 'ios' && (
                  <HapticButton
                    style={[
                      styles.appleButton,
                      isAppleLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleLinkApple}
                    disabled={isAppleLoading || isGoogleLoading}
                    hapticEnabled={!isAppleLoading && !isGoogleLoading}
                  >
                    {isAppleLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="logo-apple" size={30} color="#FFFFFF" />
                        <Text style={styles.appleButtonText}>
                          Continue with Apple
                        </Text>
                      </>
                    )}
                  </HapticButton>
                )}

                <HapticButton
                  style={[
                    styles.googleButton,
                    isGoogleLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleLinkGoogle}
                  disabled={isAppleLoading || isGoogleLoading}
                  hapticEnabled={!isAppleLoading && !isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={30} />
                      <Text style={styles.googleButtonText}>
                        Continue with Google
                      </Text>
                    </>
                  )}
                </HapticButton>
              </View>
            </View>
          </View>
        </View>

        {/* Warning */}
        <View style={styles.warningContainer}>
          <Ionicons
            name="information-circle"
            size={20}
            color={colors.textSecondary}
          />
          <Text style={styles.warningText}>
            Without an account, your data is only stored on this device.
            Deleting the app will permanently delete your workouts.
          </Text>
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    backButton: {
      padding: 4,
    },
    placeholder: {
      width: 32,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
    },
    stepContainer: {
      flex: 1,
      justifyContent: 'flex-start',
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    iconWrapper: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepHeader: {
      paddingTop: 0,
      paddingBottom: 24,
    },
    stepTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    stepSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    benefitsList: {
      gap: 12,
      marginBottom: 32,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    benefitText: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    buttonsWrapper: {
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    stepContent: {
      gap: 16,
    },
    appleButton: {
      height: 64,
      backgroundColor: '#000000',
      borderRadius: 32,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    appleButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },
    googleButton: {
      height: 64,
      backgroundColor: colors.inputBackground,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 32,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    googleButtonText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 32,
      paddingVertical: 16,
      marginBottom: 24,
      backgroundColor: colors.backgroundLight,
      marginHorizontal: 20,
      borderRadius: 12,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
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
