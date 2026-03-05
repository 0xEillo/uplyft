import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import { memo } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'

// Same avatar URLs as onboarding testimonials (app review section)
const AVATAR_IMAGES = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80',
]
// Gym goer avatars for right-side slots (3 and 4)
const GYM_AVATARS = [
  'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80',
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=facearea&facepad=2&w=300&h=300&q=80',
]

interface InviteFriendsPromptProps {
  onConnect: () => void
  onDismiss: () => void
}

export const InviteFriendsPrompt = memo(function InviteFriendsPrompt({
  onConnect,
  onDismiss,
}: InviteFriendsPromptProps) {
  const colors = useThemedColors()
  const { profile } = useProfile()

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      <View style={styles.graphicContainer}>
        <View style={styles.avatarStack}>
          <View style={[styles.avatar, styles.avatar1]}>
            <Image
              source={{ uri: AVATAR_IMAGES[0] }}
              style={styles.avatarImage}
            />
            <BlurView intensity={3} tint="light" style={styles.avatarBlur} />
          </View>
          <View style={[styles.avatar, styles.avatar2]}>
            <Image
              source={{ uri: AVATAR_IMAGES[2] }}
              style={styles.avatarImage}
            />
            <BlurView intensity={3} tint="light" style={styles.avatarBlur} />
          </View>
          <View style={styles.mainCircleWrapper}>
            <View style={[styles.mainCircle]}>
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.mainCircleImage}
                />
              ) : (
                <Text style={styles.mainCircleText}>0</Text>
              )}
            </View>
            <View style={styles.badgeIcon}>
              <Ionicons name="bar-chart" size={12} color="#FFF" />
            </View>
          </View>
          <View style={[styles.avatar, styles.avatar3]}>
            <Image
              source={{ uri: GYM_AVATARS[0] }}
              style={styles.avatarImage}
            />
            <BlurView intensity={3} tint="light" style={styles.avatarBlur} />
          </View>
          <View style={[styles.avatar, styles.avatar4]}>
            <Image
              source={{ uri: GYM_AVATARS[1] }}
              style={styles.avatarImage}
            />
            <BlurView intensity={3} tint="light" style={styles.avatarBlur} />
          </View>
        </View>
      </View>

      <Text style={styles.title}>Rep AI is more fun with your gym friends</Text>
      <Text style={styles.description}>
        Invite and connect with your friends on Rep AI! A little friendly
        competition never hurts 😉
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={onConnect}>
          <Text style={styles.primaryButtonText}>Connect with Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
          <Text style={styles.secondaryButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
})

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.bg,
      padding: 20,
      alignItems: 'center',
      borderBottomWidth: 8,
      borderBottomColor: colors.separator || '#F2F2F7',
    },
    graphicContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 110,
      marginBottom: 16,
    },
    avatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 220,
      height: 90,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#D1D1D6',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bg,
      position: 'absolute',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 22,
    },
    avatarBlur: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 22,
      overflow: 'hidden',
    },
    avatar1: {
      left: 10,
      zIndex: 1,
      backgroundColor: '#A2C4C9',
    },
    avatar2: {
      left: 32,
      zIndex: 2,
      backgroundColor: '#E0A96D',
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    avatar3: {
      right: 32,
      zIndex: 2,
      backgroundColor: '#A2C4C9',
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    avatar4: {
      right: 10,
      zIndex: 1,
      backgroundColor: '#D6A4A4',
    },
    mainCircleWrapper: {
      position: 'relative',
      zIndex: 3,
    },
    mainCircle: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.brandPrimary || '#007AFF',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bg,
      overflow: 'hidden',
    },
    mainCircleImage: {
      width: '100%',
      height: '100%',
      borderRadius: 38,
    },
    mainCircleText: {
      color: '#FFF',
      fontSize: 32,
      fontWeight: '600',
    },
    badgeIcon: {
      position: 'absolute',
      bottom: -4,
      left: -4,
      backgroundColor: colors.brandPrimary || '#007AFF',
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bg,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    buttonContainer: {
      width: '100%',
      gap: 12,
    },
    primaryButton: {
      backgroundColor: colors.brandPrimary || '#007AFF',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      width: '100%',
    },
    primaryButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      paddingVertical: 14,
      alignItems: 'center',
      width: '100%',
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  })
