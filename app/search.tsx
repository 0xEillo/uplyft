import { SlideInView } from '@/components/slide-in-view'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

let skipNextSearchEntryAnimation = false

const markSearchEntrySkipFlag = () => {
  skipNextSearchEntryAnimation = true
}

const consumeSearchEntrySkipFlag = () => {
  const shouldSkip = skipNextSearchEntryAnimation
  skipNextSearchEntryAnimation = false
  return shouldSkip
}

interface UserWithFollowStatus extends Profile {
  isFollowing: boolean
  isPrivate: boolean
  hasPendingRequest: boolean
  requestId: string | null
  hasIncomingRequest: boolean
}

export default function SearchScreen() {
  const colors = useThemedColors()
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<UserWithFollowStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(
    new Set(),
  )
  const [shouldExit, setShouldExit] = useState(false)
  const shouldSkipNextEntryRef = useRef<boolean>(consumeSearchEntrySkipFlag())
  const [shouldAnimate, setShouldAnimate] = useState(
    !shouldSkipNextEntryRef.current,
  )
  const isInitialFocusRef = useRef(true)

  useEffect(() => {
    return () => {
      shouldSkipNextEntryRef.current = false
      isInitialFocusRef.current = true
    }
  }, [shouldSkipNextEntryRef])

  // Handle focus events - disable animation when returning from child route
  useFocusEffect(
    useCallback(() => {
      if (shouldSkipNextEntryRef.current) {
        setShouldAnimate(false)
        shouldSkipNextEntryRef.current = false
        isInitialFocusRef.current = false
      } else if (isInitialFocusRef.current) {
        setShouldAnimate(true)
        isInitialFocusRef.current = false
      }
    }, [shouldSkipNextEntryRef]),
  )

  const styles = createStyles(colors)
  const trimmedQuery = searchQuery.trim()

  // Load users when search query changes
  useEffect(() => {
    if (!trimmedQuery) {
      setUsers([])
      return
    }

    const loadUsers = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const results = await database.profiles.searchByUserTag(trimmedQuery)

        // Filter out current user from results
        const filteredResults = results.filter((u) => u.id !== user.id)

        const statuses = await database.relationships.getStatuses(
          user.id,
          filteredResults.map((profile) => profile.id),
        )
        const statusMap = new Map(
          statuses.map((status) => [status.target_id, status]),
        )

        const usersWithFollowStatus = filteredResults.map((profile) => {
          const status = statusMap.get(profile.id)
          return {
            ...profile,
            isFollowing: status?.is_following ?? false,
            isPrivate: status?.is_private ?? false,
            hasPendingRequest: status?.has_pending_request ?? false,
            requestId: status?.request_id ?? null,
            hasIncomingRequest: status?.has_incoming_request ?? false,
          }
        })

        setUsers(usersWithFollowStatus)
      } catch (error) {
        console.error('Error loading users:', error)
        setUsers([])
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce search
    const timeoutId = setTimeout(loadUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, user])

  const handleToggleFollow = useCallback(
    async (targetUser: UserWithFollowStatus) => {
      if (!user || followingInProgress.has(targetUser.id)) return
      if (targetUser.hasPendingRequest || targetUser.hasIncomingRequest) {
        return
      }

      try {
        setFollowingInProgress((prev) => new Set(prev).add(targetUser.id))
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        if (targetUser.isFollowing) {
          await database.follows.unfollow(user.id, targetUser.id)
        } else {
          const result = await database.follows.follow(user.id, targetUser.id)

          setUsers((prev) =>
            prev.map((u) => {
              if (u.id !== targetUser.id) return u
              if (
                result.status === 'following' ||
                result.status === 'already_following'
              ) {
                return {
                  ...u,
                  isFollowing: true,
                  hasPendingRequest: false,
                  requestId: null,
                }
              }
              return {
                ...u,
                isFollowing: false,
                hasPendingRequest: true,
                requestId: result.requestId ?? null,
                isPrivate: true,
              }
            }),
          )
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          )
          return
        }

        // Update local state
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id
              ? {
                  ...u,
                  isFollowing: !targetUser.isFollowing,
                  hasPendingRequest: false,
                  requestId: null,
                }
              : u,
          ),
        )

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        )
      } catch (error) {
        console.error('Error toggling follow:', error)
        Alert.alert(
          'Error',
          error instanceof Error
            ? error.message
            : 'Failed to update follow status. Please try again.',
        )
      } finally {
        setFollowingInProgress((prev) => {
          const newSet = new Set(prev)
          newSet.delete(targetUser.id)
          return newSet
        })
      }
    },
    [user, followingInProgress],
  )

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Keyboard.dismiss()
    setShouldExit(true)
  }

  const handleExitComplete = () => {
    router.back()
  }

  const handleInvite = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const appStoreLink =
        'https://apps.apple.com/app/rep-ai-workout-tracker/id6753986473'
      const message = `Join me on Rep AI! Track your workouts, share your progress, and connect with the fitness community.\n\n${appStoreLink}`

      const result = await Share.share(
        Platform.OS === 'ios'
          ? {
              message: `Join me on Rep AI! Track your workouts, share your progress, and connect with the fitness community.`,
              url: appStoreLink,
            }
          : {
              message,
            },
      )

      if (result.action === Share.sharedAction) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        )
      }
    } catch (error) {
      console.error('Error sharing:', error)
      Alert.alert('Error', 'Failed to share invite. Please try again.')
    }
  }

  const markNextFocusAsChildReturn = useCallback(() => {
    markSearchEntrySkipFlag()
    shouldSkipNextEntryRef.current = true
  }, [shouldSkipNextEntryRef])

  const handleReviewRequests = useCallback(() => {
    markNextFocusAsChildReturn()
    router.push('/follow-requests')
  }, [router, markNextFocusAsChildReturn])

  const handleNavigateToProfile = useCallback(
    (userId: string) => {
      markNextFocusAsChildReturn()
      router.push(`/user/${userId}`)
    },
    [router, markNextFocusAsChildReturn],
  )

  return (
    <SlideInView
      style={{ flex: 1 }}
      enabled={shouldAnimate}
      shouldExit={shouldExit}
      onExitComplete={handleExitComplete}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Status bar background to match navbar */}
        <View style={[styles.statusBarBackground, { height: insets.top }]} />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.contentWrapper}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                activeOpacity={0.6}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Search</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search for people on Rep AI"
                placeholderTextColor={colors.textPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : !trimmedQuery ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="people-outline"
                  size={48}
                  color={colors.textTertiary}
                />
                <Text style={styles.emptyText}>
                  Start typing to search for users
                </Text>
              </View>
            ) : users.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="search-outline"
                  size={48}
                  color={colors.textTertiary}
                />
                <Text style={styles.emptyText}>
                  No users found for &quot;{trimmedQuery}&quot;
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.userList}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={styles.userListContent}
              >
                {/* Results Header */}
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsCount}>
                    {users.length} ATHLETE{users.length !== 1 ? 'S' : ''} TO
                    FOLLOW
                  </Text>
                </View>

                {/* User List */}
                {users.map((userProfile) => (
                  <TouchableOpacity
                    key={userProfile.id}
                    style={styles.userItem}
                    onPress={() => handleNavigateToProfile(userProfile.id)}
                  >
                    <View style={styles.userAvatar}>
                      {userProfile.avatar_url ? (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarText}>
                            {userProfile.display_name[0]?.toUpperCase()}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarText}>
                            {userProfile.display_name[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.displayName}>
                        {userProfile.display_name}
                      </Text>
                      <Text style={styles.userTag}>
                        @{userProfile.user_tag}
                      </Text>
                    </View>
                    {(() => {
                      const isBusy = followingInProgress.has(userProfile.id)
                      const isPending = userProfile.hasPendingRequest
                      const hasIncoming = userProfile.hasIncomingRequest
                      const buttonLabel = hasIncoming
                        ? 'Requested you'
                        : isPending
                        ? 'Pending'
                        : userProfile.isFollowing
                        ? 'Following'
                        : userProfile.isPrivate
                        ? 'Request'
                        : 'Follow'

                      const buttonStyles = [
                        styles.followButton,
                        userProfile.isFollowing && styles.followingButton,
                        (isPending || hasIncoming) && styles.pendingButton,
                      ]

                      const textStyles = [
                        styles.followButtonText,
                        userProfile.isFollowing && styles.followingButtonText,
                        (isPending || hasIncoming) && styles.pendingButtonText,
                      ]

                      return (
                        <TouchableOpacity
                          style={buttonStyles}
                          onPress={(e) => {
                            e.stopPropagation()
                            if (hasIncoming) {
                              handleReviewRequests()
                              return
                            }
                            if (isPending) {
                              return
                            }
                            handleToggleFollow(userProfile)
                          }}
                          disabled={isBusy || isPending}
                        >
                          {isBusy ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.primary}
                            />
                          ) : (
                            <Text style={textStyles}>{buttonLabel}</Text>
                          )}
                        </TouchableOpacity>
                      )
                    })()}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* Bottom Invite Section */}
        <View style={styles.inviteSection}>
          <Text style={styles.inviteText}>
            Invite friends that aren&apos;t on Rep AI
          </Text>
          <TouchableOpacity style={styles.inviteButton} onPress={handleInvite}>
            <Ionicons
              name="share-outline"
              size={20}
              color={colors.white}
              style={styles.inviteIcon}
            />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SlideInView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    statusBarBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.white,
    },
    contentWrapper: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      paddingVertical: 8,
      backgroundColor: colors.white,
    },
    backButton: {
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 44,
      minHeight: 44,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      pointerEvents: 'none',
    },
    headerSpacer: {
      width: 44,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      marginBottom: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      minHeight: 48,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingVertical: Platform.OS === 'ios' ? 12 : 0,
      minHeight: 40,
      lineHeight: 20,
      textAlignVertical: Platform.OS === 'android' ? 'center' : undefined,
      includeFontPadding: Platform.OS === 'android' ? false : undefined,
    },
    clearButton: {
      padding: 4,
    },
    resultsHeader: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    resultsCount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    userList: {
      flex: 1,
    },
    userListContent: {
      paddingBottom: 100,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userAvatar: {
      marginRight: 12,
    },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.white,
    },
    userInfo: {
      flex: 1,
    },
    displayName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    userTag: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    followButton: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.primary,
      minWidth: 90,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    followingButton: {
      backgroundColor: colors.white,
      borderColor: colors.border,
    },
    pendingButton: {
      backgroundColor: colors.backgroundLight,
      borderColor: colors.border,
    },
    followButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.white,
    },
    followingButtonText: {
      color: colors.textSecondary,
    },
    pendingButtonText: {
      color: colors.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingBottom: 140,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 12,
    },
    inviteSection: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.white,
      paddingHorizontal: 16,
      paddingVertical: 16,
      paddingBottom: 34,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    inviteText: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    inviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FC4C02',
      paddingVertical: 14,
      borderRadius: 28,
    },
    inviteIcon: {
      marginRight: 8,
    },
    inviteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.white,
    },
  })
