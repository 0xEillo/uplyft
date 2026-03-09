import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { BlurredHeader } from '@/components/blurred-header'
import { AnalyticsEvents } from '@/constants/analytics-events'
import { useAnalytics } from '@/contexts/analytics-context'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { createInviteShareLink } from '@/lib/deeplinknow'
import { haptic, hapticSuccess } from '@/lib/haptics'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Platform,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function InviteFriendsScreen() {
  const colors = useThemedColors()
  const router = useRouter()
  const { user, session } = useAuth()
  const { trackEvent } = useAnalytics()
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (user?.id) {
      database.profiles.getByIdOrNull(user.id).then(setProfile)
    }
  }, [user?.id])

  useEffect(() => {
    trackEvent(AnalyticsEvents.INVITE_FRIENDS_VIEWED)
  }, [trackEvent])

  const generateInviteData = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in before sharing invites.')
      return null
    }

    try {
      setIsLoading(true)
      const inviterProfile = await database.profiles.getByIdOrNull(user.id)
      const inviteLink = await createInviteShareLink(
        {
          inviterId: user.id,
          inviterTag: inviterProfile?.user_tag ?? null,
          inviterName: inviterProfile?.display_name ?? null,
        },
        {
          accessToken: session?.access_token,
          platform: Platform.OS,
        },
      )

      const username = inviterProfile?.user_tag || 'user'

      const message = `Train with me on Rep AI.\n\nMy username is ${username}\n\n${inviteLink}`

      return { message, inviteLink }
    } catch (error) {
      console.error('Error sharing:', error)
      Alert.alert('Error', 'Failed to share invite. Please try again.')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const handleShareGeneric = async () => {
    haptic('light')
    const data = await generateInviteData()
    if (!data) return

    try {
      const result = await Share.share(
        Platform.OS === 'ios'
          ? { message: data.message, url: data.inviteLink }
          : { message: data.message },
      )

      if (result.action === Share.sharedAction) {
        trackEvent(AnalyticsEvents.SEARCH_INVITE_SHARED, {
          inviter_id: user?.id,
          invite_url: data.inviteLink,
        })
        hapticSuccess()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleCopyLink = async () => {
    haptic('light')
    const data = await generateInviteData()
    if (!data) return

    await Clipboard.setStringAsync(data.message)
    hapticSuccess()
    Alert.alert('Copied!', 'Invite message and link copied to clipboard.')
  }

  const handleWhatsApp = async () => {
    haptic('light')
    const data = await generateInviteData()
    if (!data) return

    const url = `whatsapp://send?text=${encodeURIComponent(data.message)}`
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        await handleShareGeneric()
      }
    } catch {
      await handleShareGeneric()
    }
  }

  const handleTwitter = async () => {
    haptic('light')
    const data = await generateInviteData()
    if (!data) return

    const url = `twitter://post?message=${encodeURIComponent(data.message)}`
    const webUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      data.message,
    )}`
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        await Linking.openURL(webUrl)
      }
    } catch {
      await handleShareGeneric()
    }
  }

  const handleMessenger = async () => {
    haptic('light')
    const data = await generateInviteData()
    if (!data) return

    const url = `fb-messenger://share/?link=${encodeURIComponent(data.inviteLink)}`
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        await handleShareGeneric()
      }
    } catch {
      await handleShareGeneric()
    }
  }

  const handleFacebook = async () => {
    haptic('light')
    const data = await generateInviteData()
    if (!data) return

    const url = `fb://facewebmodal/f?href=${encodeURIComponent(data.inviteLink)}`
    const webUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.inviteLink)}`
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        await Linking.openURL(webUrl)
      }
    } catch {
      await handleShareGeneric()
    }
  }

  const handleSMS = async () => {
    haptic('light')
    const data = await generateInviteData()
    if (!data) return

    const url = Platform.OS === 'ios' ? `sms:&body=${encodeURIComponent(data.message)}` : `sms:?body=${encodeURIComponent(data.message)}`
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        await handleShareGeneric()
      }
    } catch {
      await handleShareGeneric()
    }
  }

  const handleBack = () => {
    haptic('light')
    router.back()
  }

  const styles = createStyles(colors)

  return (
    <View style={styles.container}>
      <BlurredHeader>
        <BaseNavbar
          leftContent={
            <NavbarIsland>
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                activeOpacity={0.6}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </NavbarIsland>
          }
          centerContent={<Text style={styles.headerTitle}>Invite Friends</Text>}
        />
      </BlurredHeader>

      <View style={[styles.content, { paddingTop: insets.top + 76 }]}>
        <View style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            {/* Background silhouettes mimicking screenshot */}
            <View style={[styles.silhouette, styles.silhouetteLeft]}>
              <Ionicons name="person" size={40} color={colors.border} />
            </View>
            <View style={[styles.silhouette, styles.silhouetteRight]}>
              <Ionicons name="person" size={40} color={colors.border} />
            </View>
            <View style={[styles.mainCircle, profile?.avatar_url ? styles.mainCircleWithAvatar : null]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.mainCircleText}>
                  {profile?.display_name ? profile.display_name[0].toUpperCase() : '0'}
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.heroTitle}>Invite your gym friends</Text>
        </View>

        <View style={styles.optionsSection}>
          <Text style={styles.sectionHeading}>Invite Friends</Text>

          <View style={styles.gridContainer}>
            <TouchableOpacity onPress={handleWhatsApp} style={styles.gridItem}>
              <View style={[styles.iconButton, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={30} color="#fff" />
              </View>
              <Text style={styles.gridItemText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleMessenger} style={styles.gridItem}>
              <View style={[styles.iconButton, { backgroundColor: '#fff', 
                borderWidth: 1, borderColor: colors.border }]}
              >
                {/* Fallback Messenger Icon - usually a colorful bubble, we'll try to emulate using a simple blue bubble */}
                <Ionicons name="chatbubble-ellipses" size={30} color="#0084FF" />
              </View>
              <Text style={styles.gridItemText}>Messenger</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleFacebook} style={styles.gridItem}>
              <View style={[styles.iconButton, { backgroundColor: '#1877F2' }]}>
                <Ionicons name="logo-facebook" size={30} color="#fff" />
              </View>
              <Text style={styles.gridItemText}>Facebook</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleTwitter} style={styles.gridItem}>
              <View style={[styles.iconButton, { backgroundColor: '#000' }]}>
                <Ionicons name="close" size={32} color="#fff" />
              </View>
              <Text style={styles.gridItemText}>Twitter</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCopyLink} style={styles.gridItem}>
              <View
                style={[
                  styles.iconButton,
                  { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
                ]}
              >
                <Ionicons name="copy-outline" size={26} color={colors.textPrimary} />
              </View>
              <Text style={styles.gridItemText}>Copy Link</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleShareGeneric} style={styles.gridItem}>
              <View
                style={[
                  styles.iconButton,
                  { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
                ]}
              >
                <Ionicons name="share-outline" size={28} color={colors.textPrimary} />
              </View>
              <Text style={styles.gridItemText}>Share More</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contactsSection}>
          <TouchableOpacity onPress={handleSMS} style={styles.contactsRow}>
            <View style={styles.contactsIconWrapper}>
              <Ionicons name="id-card-outline" size={24} color={colors.textPrimary} />
            </View>
            <View style={styles.contactsTextWrapper}>
              <Text style={styles.contactsTitle}>Connect with Contacts</Text>
              <Text style={styles.contactsSubtitle}>Find people you know</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Generating link...</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    backButton: {
      zIndex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    heroSection: {
      alignItems: 'center',
      marginTop: 40,
      marginBottom: 30,
    },
    heroIconContainer: {
      width: 140,
      height: 90,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    silhouette: {
      position: 'absolute',
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      top: 15,
    },
    silhouetteLeft: {
      left: 10,
    },
    silhouetteRight: {
      right: 10,
    },
    mainCircle: {
      position: 'absolute',
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#0056D2', // A vibrant blue as per screenshot
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      borderWidth: 4,
      borderColor: colors.bg,
    },
    mainCircleWithAvatar: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 4,
      borderColor: colors.bg,
    },
    mainCircleText: {
      fontSize: 36,
      fontWeight: '600',
      color: '#fff',
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    optionsSection: {
      marginTop: 10,
    },
    sectionHeading: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    gridItem: {
      width: '30%',
      alignItems: 'center',
      marginBottom: 24,
    },
    iconButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    gridItemText: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    contactsSection: {
      marginTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 20,
    },
    contactsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    contactsIconWrapper: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    contactsTextWrapper: {
      flex: 1,
    },
    contactsTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    contactsSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    loadingCard: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 5,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
    },
  })
