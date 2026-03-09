import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  buildInviteDeepLinkUrl,
  consumePendingInvite,
  savePendingInvite,
} from '@/lib/deeplinknow'
import { database } from '@/lib/database'
import { FollowRelationshipStatus, Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const getInviteId = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default function InviteProfileScreen() {
  const { inviteId: rawInviteId } = useLocalSearchParams<{
    inviteId?: string | string[]
  }>()
  const inviteId = getInviteId(rawInviteId)
  const { user, isLoading, isAnonymous } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [profile, setProfile] = useState<Profile | null>(null)
  const [relationship, setRelationship] =
    useState<FollowRelationshipStatus | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadInviteContext = useCallback(async () => {
    if (!inviteId) {
      setProfile(null)
      setRelationship(null)
      setIsFetching(false)
      return
    }

    try {
      setIsFetching(true)
      const profilePromise = database.profiles.getByIdOrNull(inviteId)
      const relationshipPromise =
        user?.id && user.id !== inviteId
          ? database.relationships
              .getStatuses(user.id, [inviteId])
              .then((statuses) => statuses[0] ?? null)
          : Promise.resolve(null)

      const [profileData, relationshipData] = await Promise.all([
        profilePromise,
        relationshipPromise,
      ])

      setProfile(profileData)
      setRelationship(relationshipData)
    } catch (error) {
      console.error('Error loading invite profile:', error)
      setProfile(null)
      setRelationship(null)
    } finally {
      setIsFetching(false)
    }
  }, [inviteId, user?.id])

  useEffect(() => {
    loadInviteContext()
  }, [loadInviteContext])

  const openProfile = useCallback(() => {
    if (!inviteId) return

    router.replace({
      pathname: '/user/[userId]',
      params: { userId: inviteId },
    })
  }, [inviteId, router])

  const openStore = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url)
    } catch (error) {
      console.error('Error opening store URL:', error)
    }
  }, [])

  const openApp = useCallback(async () => {
    if (!inviteId) return

    try {
      await Linking.openURL(buildInviteDeepLinkUrl({ inviterId: inviteId }))
    } catch (error) {
      console.error('Error opening app invite URL:', error)
    }
  }, [inviteId])

  const handlePrimaryAction = useCallback(async () => {
    if (!inviteId) {
      router.replace(user ? '/(tabs)' : '/(auth)/welcome')
      return
    }

    if (!user) {
      await savePendingInvite(inviteId)
      router.push('/(auth)/welcome')
      return
    }

    if (isAnonymous) {
      await savePendingInvite(inviteId)
      router.push('/(auth)/create-account')
      return
    }

    if (user.id === inviteId) {
      await consumePendingInvite().catch(() => null)
      router.replace('/(tabs)/profile')
      return
    }

    if (relationship?.is_following) {
      openProfile()
      return
    }

    if (relationship?.has_pending_request) {
      Alert.alert('Request pending', 'Your follow request is still waiting.')
      return
    }

    try {
      setIsSubmitting(true)
      const result = await database.follows.follow(user.id, inviteId)

      if (
        result.status === 'following' ||
        result.status === 'already_following'
      ) {
        setRelationship((prev) =>
          prev
            ? {
                ...prev,
                is_following: true,
                has_pending_request: false,
                request_id: null,
              }
            : {
                target_id: inviteId,
                is_private: profile?.is_private ?? false,
                is_following: true,
                has_pending_request: false,
                request_id: null,
                has_incoming_request: false,
                incoming_request_id: null,
              },
        )
        openProfile()
        return
      }

      setRelationship((prev) =>
        prev
          ? {
              ...prev,
              has_pending_request: true,
              request_id: result.requestId ?? null,
            }
          : {
              target_id: inviteId,
              is_private: profile?.is_private ?? false,
              is_following: false,
              has_pending_request: true,
              request_id: result.requestId ?? null,
              has_incoming_request: false,
              incoming_request_id: null,
            },
      )
      Alert.alert(
        'Request sent',
        `Your follow request was sent to ${profile?.display_name || 'this athlete'}.`,
      )
      openProfile()
    } catch (error) {
      console.error('Error following from invite:', error)
      Alert.alert('Error', 'Unable to complete the invite right now.')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    inviteId,
    isAnonymous,
    openProfile,
    profile?.display_name,
    profile?.is_private,
    relationship?.has_pending_request,
    relationship?.is_following,
    router,
    user,
  ])

  const renderAvatar = () => {
    if (profile?.avatar_url) {
      return <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
    }

    const initial = profile?.display_name?.[0]?.toUpperCase() ?? '?'
    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
    )
  }

  const primaryLabel = (() => {
    if (!inviteId) return 'Open Rep AI'
    if (!user) return 'Sign up to continue'
    if (isAnonymous) return 'Create account to continue'
    if (user.id === inviteId) return 'Open your profile'
    if (relationship?.is_following) return 'View profile'
    if (relationship?.has_pending_request) return 'Request pending'
    if (relationship?.is_private) return 'Request to follow'
    return 'Follow'
  })()

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        {isLoading || isFetching ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Loading invite...</Text>
          </View>
        ) : !inviteId || !profile ? (
          <View style={styles.card}>
            <Text style={styles.title}>Invite not found</Text>
            <Text style={styles.subtitle}>
              This invite link is invalid or the profile no longer exists.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {renderAvatar()}
            <Text style={styles.kicker}>INVITED YOU TO TRAIN</Text>
            <Text style={styles.title}>{profile.display_name}</Text>
            <Text style={styles.tag}>@{profile.user_tag}</Text>
            <Text style={styles.subtitle}>
              Follow {profile.display_name.split(' ')[0] || 'them'} on Rep AI to
              see workouts, progress, and activity.
            </Text>

            {profile.is_private ? (
              <View style={styles.badge}>
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.badgeText}>Private profile</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (relationship?.has_pending_request || relationship?.is_following) &&
                  styles.primaryButtonMuted,
              ]}
              onPress={() => {
                void handlePrimaryAction()
              }}
              disabled={
                isSubmitting ||
                Boolean(user && user.id !== inviteId && relationship?.has_pending_request)
              }
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.primaryButtonText,
                    (relationship?.has_pending_request ||
                      relationship?.is_following) &&
                      styles.primaryButtonTextMuted,
                  ]}
                >
                  {primaryLabel}
                </Text>
              )}
            </TouchableOpacity>

            {user && !isAnonymous && user.id !== inviteId ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={openProfile}
              >
                <Text style={styles.secondaryButtonText}>View full profile</Text>
              </TouchableOpacity>
            ) : null}

            {Platform.OS === 'web' ? (
              <View style={styles.storeGroup}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={openApp}
                >
                  <Text style={styles.secondaryButtonText}>Open in app</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    void openStore(APP_STORE_URL)
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    Download on App Store
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    void openStore(PLAY_STORE_URL)
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    Get it on Google Play
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    card: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 12,
    },
    avatar: {
      width: 112,
      height: 112,
      borderRadius: 56,
      marginBottom: 10,
    },
    avatarPlaceholder: {
      backgroundColor: colors.brandPrimarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontSize: 38,
      fontWeight: '700',
      color: colors.brandPrimary,
    },
    kicker: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brandPrimary,
      letterSpacing: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    tag: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 320,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
    },
    badgeText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    primaryButton: {
      width: '100%',
      borderRadius: 12,
      backgroundColor: colors.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      marginTop: 10,
    },
    primaryButtonMuted: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    primaryButtonTextMuted: {
      color: colors.textPrimary,
    },
    secondaryButton: {
      width: '100%',
      borderRadius: 12,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    storeGroup: {
      width: '100%',
      gap: 10,
      marginTop: 6,
    },
  })
