import { useThemedColors } from '@/hooks/useThemedColors'
import { FollowRelationshipStatus, Profile } from '@/types/database.types'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
    ActivityIndicator,
    Image,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native'

interface UserListItemProps {
  user: Pick<Profile, 'id' | 'display_name' | 'user_tag' | 'avatar_url'>
  relationship?: FollowRelationshipStatus | null
  onFollowAction: (user: Pick<Profile, 'id'>) => Promise<void>
  isOwnProfile: boolean
}

export function UserListItem({
  user,
  relationship,
  onFollowAction,
  isOwnProfile,
}: UserListItemProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handlePress = () => {
    router.push(`/user/${user.id}`)
  }

  const handleAction = async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      await onFollowAction(user)
    } finally {
      setIsLoading(false)
    }
  }

  const renderAvatar = () => {
    if (user.avatar_url) {
      return <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
    }
    const initial = user.display_name?.[0]?.toUpperCase() ?? '?'
    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
    )
  }

  const renderActionButton = () => {
    if (isOwnProfile) return null

    const isFollowing = relationship?.is_following ?? false
    const isPending = relationship?.has_pending_request ?? false
    const hasIncoming = relationship?.has_incoming_request ?? false

    let label = 'Follow'
    let buttonStyle: StyleProp<ViewStyle> = styles.actionButton
    let textStyle: StyleProp<TextStyle> = styles.actionButtonText

    if (isFollowing) {
      label = 'Following'
      buttonStyle = [styles.actionButton, styles.actionButtonFollowing]
      textStyle = [styles.actionButtonText, styles.actionButtonTextFollowing]
    } else if (isPending) {
      label = 'Requested'
      buttonStyle = [styles.actionButton, styles.actionButtonPending]
      textStyle = [styles.actionButtonText, styles.actionButtonTextPending]
    } else if (hasIncoming) {
      label = 'Follow Back'
    }

    return (
      <TouchableOpacity
        style={buttonStyle}
        onPress={handleAction}
        disabled={isLoading || isPending}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isFollowing ? colors.textPrimary : colors.surface}
          />
        ) : (
          <Text style={textStyle}>{label}</Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      {renderAvatar()}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {user.display_name || 'User'}
        </Text>
        <Text style={styles.tag} numberOfLines={1}>
          @{user.user_tag || 'user'}
        </Text>
      </View>
      {renderActionButton()}
    </TouchableOpacity>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 12,
      backgroundColor: colors.surfaceSubtle,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brandPrimary,
    },
    avatarInitial: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.surface,
    },
    info: {
      flex: 1,
      justifyContent: 'center',
      marginRight: 12,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    tag: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actionButton: {
      minWidth: 90,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.brandPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    actionButtonFollowing: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonPending: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.surface,
    },
    actionButtonTextFollowing: {
      color: colors.textPrimary,
    },
    actionButtonTextPending: {
      color: colors.textSecondary,
    },
  })
