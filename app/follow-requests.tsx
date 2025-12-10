import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { FollowRequest, Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type RequestProfile = Pick<Profile, 'id' | 'display_name' | 'user_tag' | 'avatar_url'>
type IncomingRequest = FollowRequest & { follower?: RequestProfile }
type OutgoingRequest = FollowRequest & { followee?: RequestProfile }

export default function FollowRequestsScreen() {
  const { user, isAnonymous } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const styles = createStyles(colors)

  // Block anonymous users from social features
  useEffect(() => {
    if (isAnonymous) {
      router.replace('/(auth)/create-account')
    }
  }, [isAnonymous, router])

  if (isAnonymous) return null

  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [busyRequestIds, setBusyRequestIds] = useState<Set<string>>(new Set())

  const loadRequests = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      const [incomingData, outgoingData] = await Promise.all([
        database.followRequests.listIncoming(user.id),
        database.followRequests.listOutgoing(user.id),
      ])
      setIncoming(incomingData)
      setOutgoing(outgoingData)
    } catch (error) {
      console.error('Error loading follow requests:', error)
      Alert.alert('Error', 'Unable to load follow requests right now.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      loadRequests()
    }, [loadRequests]),
  )

  const handleRefresh = useCallback(() => {
    if (!user) return
    setIsRefreshing(true)
    loadRequests()
  }, [user, loadRequests])

  const markBusy = (requestId: string, add: boolean) => {
    setBusyRequestIds((prev) => {
      const next = new Set(prev)
      if (add) {
        next.add(requestId)
      } else {
        next.delete(requestId)
      }
      return next
    })
  }

  const handleRespond = useCallback(
    async (requestId: string, decision: 'approve' | 'decline') => {
      if (!user) return
      markBusy(requestId, true)
      try {
        await database.followRequests.respond(requestId, decision)
        setIncoming((prev) => prev.filter((req) => req.id !== requestId))
      } catch (error) {
        console.error('Error responding to follow request:', error)
        Alert.alert('Error', 'Unable to update the follow request. Please try again.')
      } finally {
        markBusy(requestId, false)
      }
    },
    [user],
  )

  const handleCancel = useCallback(
    async (requestId: string) => {
      if (!user) return
      markBusy(requestId, true)
      try {
        await database.followRequests.cancel(requestId, user.id)
        setOutgoing((prev) => prev.filter((req) => req.id !== requestId))
      } catch (error) {
        console.error('Error cancelling follow request:', error)
        Alert.alert('Error', 'Unable to cancel the request right now.')
      } finally {
        markBusy(requestId, false)
      }
    },
    [user],
  )

  const renderAvatar = (profile?: RequestProfile) => {
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

  const renderIncomingRequests = () => {
    if (incoming.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptyMessage}>
            Followers you approve will immediately see your workouts.
          </Text>
        </View>
      )
    }

    return incoming.map((request) => {
      const follower = request.follower
      const isBusy = busyRequestIds.has(request.id)
      return (
        <View key={request.id} style={styles.requestRow}>
          {renderAvatar(follower)}
          <View style={styles.requestInfo}>
            <Text style={styles.requestName}>{follower?.display_name || 'Athlete'}</Text>
            <Text style={styles.requestTag}>@{follower?.user_tag || 'unknown'}</Text>
          </View>
          <View style={styles.incomingActions}>
            <TouchableOpacity
              style={[styles.requestButton, styles.declineButton]}
              onPress={() => handleRespond(request.id, 'decline')}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={[styles.requestButtonText, styles.declineButtonText]}>Decline</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.requestButton, styles.approveButton]}
              onPress={() => handleRespond(request.id, 'approve')}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.requestButtonText}>Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )
    })
  }

  const renderOutgoingRequests = () => {
    if (outgoing.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="timer-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No pending invites</Text>
          <Text style={styles.emptyMessage}>
            Send requests to private athletes from their profile or the search tab.
          </Text>
        </View>
      )
    }

    return outgoing.map((request) => {
      const followee = request.followee
      const isBusy = busyRequestIds.has(request.id)
      return (
        <View key={request.id} style={styles.requestRow}>
          {renderAvatar(followee)}
          <View style={styles.requestInfo}>
            <Text style={styles.requestName}>{followee?.display_name || 'Athlete'}</Text>
            <Text style={styles.requestTag}>@{followee?.user_tag || 'unknown'}</Text>
            <Text style={styles.outgoingStatus}>Waiting for approval</Text>
          </View>
          <TouchableOpacity
            style={[styles.requestButton, styles.declineButton]}
            onPress={() => handleCancel(request.id)}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Text style={[styles.requestButtonText, styles.declineButtonText]}>Cancel</Text>
            )}
          </TouchableOpacity>
        </View>
      )
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Follow Requests</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Incoming</Text>
            {renderIncomingRequests()}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Outgoing</Text>
            {renderOutgoingRequests()}
          </View>
        </ScrollView>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    headerPlaceholder: {
      width: 24,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: '700',
    },
    requestInfo: {
      flex: 1,
    },
    requestName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    requestTag: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    outgoingStatus: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    incomingActions: {
      flexDirection: 'row',
      gap: 8,
    },
    requestButton: {
      minWidth: 88,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    requestButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.white,
    },
    approveButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    declineButton: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
    },
    declineButtonText: {
      color: colors.error,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 12,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    emptyMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  })

