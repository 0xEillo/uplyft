import { UserListItem } from '@/components/UserListItem'
import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { FollowRelationshipStatus, Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

type FollowingItem = {
  followee: Pick<Profile, 'id' | 'display_name' | 'user_tag' | 'avatar_url'>
}

export default function FollowingScreen() {
  const { userId, returnTo } = useLocalSearchParams<{
    userId: string
    returnTo?: string
  }>()
  const { user: currentUser } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const styles = createStyles(colors)

  const [following, setFollowing] = useState<FollowingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [relationships, setRelationships] = useState<
    Record<string, FollowRelationshipStatus>
  >({})

  const handleBack = useCallback(() => {
    if (returnTo) {
      router.dismissTo(returnTo as any)
    } else {
      router.back()
    }
  }, [router, returnTo])

  const loadFollowing = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const data = await database.follows.listFollowing(userId, 100)

      // Normalize data: filter out any missing followee profiles
      const validFollowing = data.filter((item) => item.followee)
      setFollowing(validFollowing)

      // Load relationship statuses if logged in
      if (currentUser) {
        const followeeIds = validFollowing.map((f) => f.followee.id)
        const idsToCheck = followeeIds.filter((id) => id !== currentUser.id)

        if (idsToCheck.length > 0) {
          const statuses = await database.relationships.getStatuses(
            currentUser.id,
            idsToCheck,
          )
          const statusMap: Record<string, FollowRelationshipStatus> = {}
          statuses.forEach((status) => {
            statusMap[status.target_id] = status
          })
          setRelationships(statusMap)
        }
      }
    } catch (error) {
      console.error('Error loading following:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [userId, currentUser])

  useEffect(() => {
    loadFollowing()
  }, [loadFollowing])

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    loadFollowing()
  }, [loadFollowing])

  const handleFollowAction = useCallback(
    async (targetUser: Pick<Profile, 'id'>) => {
      if (!currentUser) {
        router.push('/(auth)/welcome')
        return
      }

      const status = relationships[targetUser.id]
      const isFollowing = status?.is_following ?? false

      try {
        if (isFollowing) {
          await database.follows.unfollow(currentUser.id, targetUser.id)
          setRelationships((prev) => ({
            ...prev,
            [targetUser.id]: {
              ...prev[targetUser.id],
              is_following: false,
              target_id: targetUser.id,
              is_private: prev[targetUser.id]?.is_private ?? false,
              has_pending_request: false,
              request_id: null,
              has_incoming_request:
                prev[targetUser.id]?.has_incoming_request ?? false,
              incoming_request_id:
                prev[targetUser.id]?.incoming_request_id ?? null,
            },
          }))
        } else {
          const result = await database.follows.follow(
            currentUser.id,
            targetUser.id,
          )
          if (
            result.status === 'following' ||
            result.status === 'already_following'
          ) {
            setRelationships((prev) => ({
              ...prev,
              [targetUser.id]: {
                ...prev[targetUser.id],
                is_following: true,
                has_pending_request: false,
                request_id: null,
                target_id: targetUser.id,
                is_private: prev[targetUser.id]?.is_private ?? false,
                has_incoming_request:
                  prev[targetUser.id]?.has_incoming_request ?? false,
                incoming_request_id:
                  prev[targetUser.id]?.incoming_request_id ?? null,
              },
            }))
          } else {
            setRelationships((prev) => ({
              ...prev,
              [targetUser.id]: {
                ...prev[targetUser.id],
                has_pending_request: true,
                request_id: result.requestId ?? null,
                target_id: targetUser.id,
                is_following: false,
                is_private: prev[targetUser.id]?.is_private ?? true,
                has_incoming_request:
                  prev[targetUser.id]?.has_incoming_request ?? false,
                incoming_request_id:
                  prev[targetUser.id]?.incoming_request_id ?? null,
              },
            }))
          }
        }
      } catch (error) {
        console.error('Error updating follow status:', error)
      }
    },
    [currentUser, relationships, router],
  )

  const filteredFollowing = following.filter((item) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      item.followee.display_name?.toLowerCase().includes(query) ||
      item.followee.user_tag?.toLowerCase().includes(query)
    )
  })

  const renderItem = ({ item }: { item: FollowingItem }) => (
    <UserListItem
      user={item.followee}
      relationship={currentUser ? relationships[item.followee.id] : undefined}
      onFollowAction={handleFollowAction}
      isOwnProfile={currentUser?.id === item.followee.id}
    />
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Status bar background */}
      <View style={[styles.statusBarBackground, { height: insets.top }]} />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Following</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search following"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredFollowing}
          renderItem={renderItem}
          keyExtractor={(item) => item.followee.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No users found' : 'Not following anyone yet'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
      zIndex: 0,
    },
    header: {
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 12,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    backButton: {
      padding: 4,
      marginLeft: -4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    headerPlaceholder: {
      width: 24,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
      marginHorizontal: 20,
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 8,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      height: '100%',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
  })
