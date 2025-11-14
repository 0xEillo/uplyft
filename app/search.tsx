import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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
import { SafeAreaView } from 'react-native-safe-area-context'

interface UserWithFollowStatus extends Profile {
  isFollowing: boolean
}

export default function SearchScreen() {
  const colors = useThemedColors()
  const { user } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<UserWithFollowStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(
    new Set(),
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

        // Check follow status for each user
        const usersWithFollowStatus = await Promise.all(
          filteredResults.map(async (profile) => {
            const isFollowing = await database.follows.isFollowing(
              user.id,
              profile.id,
            )
            return { ...profile, isFollowing }
          }),
        )

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

      try {
        setFollowingInProgress((prev) => new Set(prev).add(targetUser.id))
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        if (targetUser.isFollowing) {
          await database.follows.unfollow(user.id, targetUser.id)
        } else {
          await database.follows.follow(user.id, targetUser.id)
        }

        // Update local state
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetUser.id ? { ...u, isFollowing: !u.isFollowing } : u,
          ),
        )

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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
    router.replace('/(tabs)')
  }

  const handleInvite = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const appStoreLink = 'https://apps.apple.com/app/rep-ai-workout-tracker/id6753986473'
      const message = `Join me on Rep AI! Track your workouts, share your progress, and connect with the fitness community.\n\n${appStoreLink}`

      const result = await Share.share(
        Platform.OS === 'ios'
          ? {
              message: `Join me on Rep AI! Track your workouts, share your progress, and connect with the fitness community.`,
              url: appStoreLink,
            }
          : {
              message,
            }
      )

      if (result.action === Share.sharedAction) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      console.error('Error sharing:', error)
      Alert.alert('Error', 'Failed to share invite. Please try again.')
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.contentWrapper}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
              <Text style={styles.backText}>Home</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Search</Text>
            <View style={styles.headerRight} />
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
                No users found for "{trimmedQuery}"
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
              {users.length} ATHLETE{users.length !== 1 ? 'S' : ''} TO FOLLOW
            </Text>
          </View>

          {/* User List */}
          {users.map((userProfile) => (
            <TouchableOpacity
              key={userProfile.id}
              style={styles.userItem}
              onPress={() => router.push(`/user/${userProfile.id}`)}
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
                <Text style={styles.userTag}>@{userProfile.user_tag}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  userProfile.isFollowing && styles.followingButton,
                ]}
                onPress={(e) => {
                  e.stopPropagation()
                  handleToggleFollow(userProfile)
                }}
                disabled={followingInProgress.has(userProfile.id)}
              >
                {followingInProgress.has(userProfile.id) ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[
                      styles.followButtonText,
                      userProfile.isFollowing && styles.followingButtonText,
                    ]}
                  >
                    {userProfile.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
            </ScrollView>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Bottom Invite Section */}
      <View style={styles.inviteSection}>
        <Text style={styles.inviteText}>Invite friends that aren't on Rep AI</Text>
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
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentWrapper: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 12,
      backgroundColor: colors.white,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 8,
    },
    backText: {
      fontSize: 17,
      color: colors.text,
      marginLeft: 4,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
    },
    headerRight: {
      width: 80,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      marginBottom: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
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
      backgroundColor: colors.white,
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
    followButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.white,
    },
    followingButtonText: {
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
      borderRadius: 6,
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
