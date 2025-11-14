import { useAuth } from '@/contexts/auth-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { formatTimeAgo } from '@/lib/utils/formatters'
import { Profile, WorkoutComment } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

interface CommentWithProfile extends WorkoutComment {
  profile?: Profile
}

export default function WorkoutCommentsScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()

  const [comments, setComments] = useState<CommentWithProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPosting, setIsPosting] = useState(false)
  const [commentText, setCommentText] = useState('')

  const styles = createStyles(colors)

  // Fetch comments
  useEffect(() => {
    if (!workoutId) return

    const fetchComments = async () => {
      try {
        setIsLoading(true)
        const commentsData = await database.workoutComments.listByWorkout(
          workoutId,
        )

        // Fetch profiles for all comment authors
        const uniqueUserIds = [
          ...new Set(commentsData.map((c) => c.user_id)),
        ]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', uniqueUserIds)

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

        const commentsWithProfiles = commentsData.map((comment) => ({
          ...comment,
          profile: profileMap.get(comment.user_id),
        }))

        setComments(commentsWithProfiles)
      } catch (error) {
        console.error('Error fetching comments:', error)
        Alert.alert('Error', 'Failed to load comments')
      } finally {
        setIsLoading(false)
      }
    }

    fetchComments()
  }, [workoutId])

  const handlePostComment = useCallback(async () => {
    if (!user || !workoutId || !commentText.trim() || isPosting) return

    const trimmedText = commentText.trim()

    try {
      setIsPosting(true)

      // Post comment
      const newComment = await database.workoutComments.add(
        workoutId,
        user.id,
        trimmedText,
      )

      // Fetch user profile
      const userProfile = await database.profiles.getById(user.id)

      // Optimistically add to list
      const commentWithProfile: CommentWithProfile = {
        ...newComment,
        profile: userProfile,
      }

      setComments((prev) => [...prev, commentWithProfile])
      setCommentText('')
      Keyboard.dismiss()
    } catch (error) {
      console.error('Error posting comment:', error)
      Alert.alert('Error', 'Failed to post comment')
    } finally {
      setIsPosting(false)
    }
  }, [user, workoutId, commentText, isPosting])

  const renderComment = useCallback(
    ({ item }: { item: CommentWithProfile }) => (
      <View style={styles.commentItem}>
        <View style={styles.commentAvatar}>
          {item.profile?.avatar_url ? (
            <Image
              source={{ uri: item.profile.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.profile?.display_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>
              {item.profile?.display_name || 'User'}
            </Text>
            <Text style={styles.commentTime}>
              {formatTimeAgo(item.created_at)}
            </Text>
          </View>
          <Text style={styles.commentText}>{item.content}</Text>
        </View>
      </View>
    ),
    [styles],
  )

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        {user && (
          <View style={styles.emptyAvatar}>
            {user.user_metadata?.avatar_url ? (
              <Image
                source={{ uri: user.user_metadata.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {user.user_metadata?.full_name?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.emptyText}>Be the first to comment</Text>
      </View>
    ),
    [user, styles],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Comments</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Comments List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={renderEmptyState}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}

        {/* Input Section */}
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          <TextInput
            style={styles.input}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textPlaceholder}
            multiline
            maxLength={500}
            editable={!isPosting}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!commentText.trim() || isPosting) && styles.sendButtonDisabled,
            ]}
            onPress={handlePostComment}
            disabled={!commentText.trim() || isPosting}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons
                name="arrow-up"
                size={20}
                color={
                  commentText.trim() ? colors.white : colors.textPlaceholder
                }
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoid: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerRight: {
      width: 36,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentsList: {
      padding: 16,
      flexGrow: 1,
    },
    commentItem: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    commentAvatar: {
      marginRight: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.white,
    },
    commentContent: {
      flex: 1,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
      gap: 8,
    },
    commentAuthor: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    commentTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    commentText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyAvatar: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
    },
    input: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      maxHeight: 100,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    sendButtonDisabled: {
      backgroundColor: colors.backgroundLight,
    },
  })
