import { BaseNavbar, NavbarIsland } from '@/components/base-navbar'
import { LiquidGlassSurface } from '@/components/liquid-glass-surface'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/contexts/profile-context'
import { useThemedColors } from '@/hooks/useThemedColors'
import { database } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { formatTimeAgo } from '@/lib/utils/formatters'
import { Profile, WorkoutComment } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import {
  useLocalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface CommentWithProfile extends WorkoutComment {
  profile?: Profile
}

interface CommentListItem {
  comment: CommentWithProfile
  depth: number
}

const MAX_REPLY_DEPTH = 2

function getReplyMentionTag(comment: CommentWithProfile) {
  const preferredTag = comment.profile?.user_tag?.trim()
  if (preferredTag) {
    return preferredTag
  }

  const displayName = comment.profile?.display_name?.trim() || 'user'
  return displayName.replace(/\s+/g, '').toLowerCase()
}

function flattenComments(
  comments: CommentWithProfile[],
  maxDepth = MAX_REPLY_DEPTH,
) {
  if (!comments.length) {
    return [] as CommentListItem[]
  }

  const commentsById = new Map(comments.map((comment) => [comment.id, comment]))
  const childrenByParent = new Map<string | null, CommentWithProfile[]>()

  comments.forEach((comment) => {
    const parentId =
      comment.parent_comment_id && commentsById.has(comment.parent_comment_id)
        ? comment.parent_comment_id
        : null

    const existingChildren = childrenByParent.get(parentId) || []
    existingChildren.push(comment)
    childrenByParent.set(parentId, existingChildren)
  })

  childrenByParent.forEach((threadComments) => {
    threadComments.sort((a, b) => a.created_at.localeCompare(b.created_at))
  })

  const flattened: CommentListItem[] = []
  const visited = new Set<string>()

  const walkThread = (comment: CommentWithProfile, depth: number) => {
    if (visited.has(comment.id)) {
      return
    }

    visited.add(comment.id)
    flattened.push({
      comment,
      depth,
    })

    const children = childrenByParent.get(comment.id) || []
    children.forEach((childComment) => {
      walkThread(childComment, Math.min(depth + 1, maxDepth))
    })
  }

  ;(childrenByParent.get(null) || []).forEach((rootComment) => {
    walkThread(rootComment, 0)
  })

  // Handle any edge-cases (cycles/orphans) defensively.
  comments.forEach((comment) => {
    if (!visited.has(comment.id)) {
      walkThread(comment, 0)
    }
  })

  return flattened
}

const DEBUG_NAV = false

function logNav(_event: string, _details?: Record<string, unknown>) {
  if (!DEBUG_NAV) return
}

function normalizeReturnToParam(
  rawReturnTo: string | string[] | undefined,
): string | undefined {
  if (!rawReturnTo) return undefined

  const value = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo
  if (!value) return undefined

  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith('/')) return undefined
    if (decoded.startsWith('/workout-comments/')) return undefined
    return decoded
  } catch {
    return undefined
  }
}

export default function WorkoutCommentsScreen() {
  const { workoutId, returnTo } = useLocalSearchParams<{
    workoutId: string
    returnTo?: string | string[]
  }>()
  const { user, isAnonymous } = useAuth()
  const { profile } = useProfile()
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSegments()
  const navigation = useNavigation()
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const normalizedReturnTo = normalizeReturnToParam(returnTo)
  const backAttemptRef = useRef(0)
  const inputRef = useRef<TextInput>(null)

  const [comments, setComments] = useState<CommentWithProfile[]>([])
  const [commentLikeCounts, setCommentLikeCounts] = useState<
    Record<string, number>
  >({})
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(
    new Set(),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isPosting, setIsPosting] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyTarget, setReplyTarget] = useState<CommentWithProfile | null>(
    null,
  )
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const flattenedComments = useMemo(
    () => flattenComments(comments),
    [comments],
  )

  const styles = createStyles(colors)

  // Block anonymous users from social features
  useEffect(() => {
    if (isAnonymous) {
      logNav('Anonymous user redirecting to create-account', {
        pathname,
        segments: segments.join('/'),
      })
      router.replace('/(auth)/create-account')
    }
  }, [isAnonymous, pathname, router, segments])

  useEffect(() => {
    logNav('Mounted comments screen', {
      workoutId,
      returnTo,
      normalizedReturnTo,
      pathname,
      segments: segments.join('/'),
      canGoBack: router.canGoBack(),
    })
    return () => {
      logNav('Unmounted comments screen', {
        workoutId,
        pathname,
      })
    }
  }, [normalizedReturnTo, pathname, returnTo, router, segments, workoutId])

  useEffect(() => {
    logNav('Route changed while comments mounted', {
      pathname,
      segments: segments.join('/'),
      canGoBack: router.canGoBack(),
    })
  }, [pathname, router, segments])

  useEffect(() => {
    const unsubscribeState = navigation.addListener('state', () => {
      const navState = navigation.getState()
      if (!navState || !navState.routes) return
      const activeRoute = navState.routes[navState.index]
      logNav('Navigation state event', {
        activeRouteName: (activeRoute as any)?.name,
        activeRouteKey: (activeRoute as any)?.key,
        index: navState.index,
        routeCount: navState.routes.length,
        routeNames: navState.routes.map((route: any) => route.name),
      })
    })
    const unsubscribeBeforeRemove = navigation.addListener(
      'beforeRemove',
      (event) => {
        logNav('beforeRemove event', {
          actionType: event.data.action.type,
          target: event.target,
        })
      },
    )
    const unsubscribeFocus = navigation.addListener('focus', () => {
      logNav('focus event', {
        pathname,
        segments: segments.join('/'),
      })
    })
    const unsubscribeBlur = navigation.addListener('blur', () => {
      logNav('blur event', {
        pathname,
        segments: segments.join('/'),
      })
    })

    return () => {
      unsubscribeState()
      unsubscribeBeforeRemove()
      unsubscribeFocus()
      unsubscribeBlur()
    }
  }, [navigation, pathname, segments])

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true),
    )
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false),
    )

    return () => {
      keyboardWillShowListener.remove()
      keyboardWillHideListener.remove()
    }
  }, [])

  // Fetch comments
  useEffect(() => {
    if (!workoutId) return

    const fetchComments = async () => {
      try {
        logNav('Fetching comments start', {
          workoutId,
        })
        setIsLoading(true)
        const commentsData = await database.workoutComments.listByWorkout(
          workoutId,
        )

        // Fetch profiles for all comment authors
        const uniqueUserIds = [...new Set(commentsData.map((c) => c.user_id))]
        const commentIds = commentsData.map((comment) => comment.id)

        const profilesPromise = uniqueUserIds.length
          ? supabase.from('profiles').select('*').in('id', uniqueUserIds)
          : Promise.resolve({ data: [] as Profile[], error: null })

        const [profilesResult, commentLikeCountMap, likedCommentIdsResult] =
          await Promise.all([
            profilesPromise,
            database.workoutCommentLikes.getCounts(commentIds),
            user?.id
              ? database.workoutCommentLikes.getLikedCommentIds(
                  commentIds,
                  user.id,
                )
              : Promise.resolve([] as string[]),
          ])

        if (profilesResult.error) {
          throw profilesResult.error
        }

        const profileMap = new Map(
          ((profilesResult.data as Profile[] | null) || []).map((p) => [
            p.id,
            p,
          ]),
        )

        const commentsWithProfiles = commentsData.map((comment) => ({
          ...comment,
          profile: profileMap.get(comment.user_id),
        }))

        setComments(commentsWithProfiles)
        setCommentLikeCounts(commentLikeCountMap)
        setLikedCommentIds(new Set(likedCommentIdsResult))
        setReplyTarget((currentReplyTarget) => {
          if (!currentReplyTarget) {
            return null
          }

          return commentsWithProfiles.some(
            (comment) => comment.id === currentReplyTarget.id,
          )
            ? currentReplyTarget
            : null
        })
        logNav('Fetching comments success', {
          workoutId,
          commentCount: commentsWithProfiles.length,
          uniqueAuthors: uniqueUserIds.length,
        })
      } catch (error) {
        logNav('Fetching comments failed', {
          workoutId,
          error: error instanceof Error ? error.message : String(error),
        })
        console.error('Error fetching comments:', error)
        Alert.alert('Error', 'Failed to load comments')
      } finally {
        setIsLoading(false)
      }
    }

    fetchComments()
  }, [workoutId, user?.id])

  const handleStartReply = useCallback((comment: CommentWithProfile) => {
    const mentionPrefix = `@${getReplyMentionTag(comment)}`
    setReplyTarget(comment)
    setCommentText((previousText) => {
      const trimmed = previousText.trim()
      if (!trimmed) {
        return `${mentionPrefix} `
      }

      if (
        trimmed.startsWith(`${mentionPrefix} `) ||
        trimmed === mentionPrefix
      ) {
        return previousText
      }

      return `${mentionPrefix} ${trimmed}`
    })

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const handleCommentTextChange = useCallback(
    (value: string) => {
      setCommentText(value)
      if (replyTarget && !value.trim()) {
        setReplyTarget(null)
      }
    },
    [replyTarget],
  )

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!user) return

      const alreadyLiked = likedCommentIds.has(commentId)

      // Optimistic update
      setLikedCommentIds((previousLikedIds) => {
        const nextLikedIds = new Set(previousLikedIds)
        if (alreadyLiked) {
          nextLikedIds.delete(commentId)
        } else {
          nextLikedIds.add(commentId)
        }
        return nextLikedIds
      })
      setCommentLikeCounts((previousCounts) => ({
        ...previousCounts,
        [commentId]: Math.max(
          0,
          (previousCounts[commentId] || 0) + (alreadyLiked ? -1 : 1),
        ),
      }))

      try {
        if (alreadyLiked) {
          await database.workoutCommentLikes.unlike(commentId, user.id)
        } else {
          await database.workoutCommentLikes.like(commentId, user.id)
        }
      } catch (error) {
        console.error('Error toggling comment like:', error)

        // Revert optimistic update
        setLikedCommentIds((previousLikedIds) => {
          const nextLikedIds = new Set(previousLikedIds)
          if (alreadyLiked) {
            nextLikedIds.add(commentId)
          } else {
            nextLikedIds.delete(commentId)
          }
          return nextLikedIds
        })
        setCommentLikeCounts((previousCounts) => ({
          ...previousCounts,
          [commentId]: Math.max(
            0,
            (previousCounts[commentId] || 0) + (alreadyLiked ? 1 : -1),
          ),
        }))
        Alert.alert('Error', 'Failed to update comment like')
      }
    },
    [user, likedCommentIds],
  )

  const handlePostComment = useCallback(async () => {
    if (!user || !workoutId || !commentText.trim() || isPosting) return

    let finalContent = commentText.trim()
    let parentCommentId: string | null = null
    let replyToUserId: string | null = null

    if (replyTarget) {
      const mentionPrefix = `@${getReplyMentionTag(replyTarget)}`
      if (!finalContent.startsWith(mentionPrefix)) {
        finalContent = `${mentionPrefix} ${finalContent}`.trim()
      }

      const replyBody = finalContent.slice(mentionPrefix.length).trim()
      if (!replyBody) {
        Alert.alert('Reply cannot be empty', 'Add text after the @mention.')
        return
      }

      parentCommentId = replyTarget.id
      replyToUserId = replyTarget.user_id
    }

    try {
      setIsPosting(true)

      // Post comment
      const newComment = await database.workoutComments.add(
        workoutId,
        user.id,
        finalContent,
        parentCommentId,
        replyToUserId,
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
      setReplyTarget(null)
      Keyboard.dismiss()
    } catch (error) {
      console.error('Error posting comment:', error)
      Alert.alert('Error', 'Failed to post comment')
    } finally {
      setIsPosting(false)
    }
  }, [user, workoutId, commentText, isPosting, replyTarget])

  const renderComment = useCallback(
    ({ item }: { item: CommentListItem }) => {
      const comment = item.comment
      const likeCount = commentLikeCounts[comment.id] || 0
      const isLiked = likedCommentIds.has(comment.id)
      const indentation = item.depth > 0 ? item.depth * 18 : 0

      return (
        <View
          style={[
            styles.commentItem,
            item.depth > 0 && styles.replyCommentItem,
            { marginLeft: indentation },
          ]}
        >
          <View style={styles.commentAvatar}>
            {comment.profile?.avatar_url ? (
              <Image
                source={{ uri: comment.profile.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {comment.profile?.display_name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>
                {comment.profile?.display_name || 'User'}
              </Text>
              <Text style={styles.commentTime}>
                {formatTimeAgo(comment.created_at)}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.content}</Text>
            <View style={styles.commentActionsRow}>
              <TouchableOpacity
                onPress={() => handleStartReply(comment)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.replyActionText}>Reply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentLikeButton}
                onPress={() => handleToggleCommentLike(comment.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={16}
                  color={isLiked ? colors.brandPrimary : colors.textSecondary}
                />
                {likeCount > 0 && (
                  <Text
                    style={[
                      styles.commentLikeCount,
                      isLiked && styles.commentLikeCountActive,
                    ]}
                  >
                    {likeCount}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )
    },
    [
      styles,
      commentLikeCounts,
      likedCommentIds,
      colors.brandPrimary,
      colors.textSecondary,
      handleStartReply,
      handleToggleCommentLike,
    ],
  )

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        {user && (
          <View style={styles.emptyAvatar}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {profile?.display_name?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.emptyText}>Be the first to comment</Text>
      </View>
    ),
    [user, profile, styles],
  )

  const handleBack = useCallback(() => {
    backAttemptRef.current += 1
    const attempt = backAttemptRef.current
    const canGoBack = router.canGoBack()
    const target = normalizedReturnTo ?? '/(tabs)'
    const navState = navigation.getState()
    const activeRoute = navState?.routes
      ? navState.routes[navState.index]
      : null
    logNav('Back pressed', {
      attempt,
      workoutId,
      returnTo,
      normalizedReturnTo,
      pathname,
      segments: segments.join('/'),
      routerCanGoBack: canGoBack,
      navIndex: navState?.index,
      navRouteCount: navState?.routes?.length,
      navRouteNames: navState?.routes?.map((route: any) => route.name),
      activeRouteName: (activeRoute as any)?.name,
      activeRouteKey: (activeRoute as any)?.key,
      resolvedTarget: target,
    })

    Keyboard.dismiss()
    if (canGoBack) {
      logNav('Back attempt using router.back()', {
        attempt,
      })
      requestAnimationFrame(() => {
        router.back()
        setTimeout(() => {
          logNav('Post-router.back check', {
            attempt,
            pathname,
            segments: segments.join('/'),
            routerCanGoBack: router.canGoBack(),
          })
        }, 300)
      })
      return
    }

    logNav('Back attempt using replace fallback', {
      attempt,
      target,
    })
    requestAnimationFrame(() => {
      router.replace(target as Parameters<typeof router.replace>[0])
      setTimeout(() => {
        logNav('Post-replace check', {
          attempt,
          target,
          pathname,
          segments: segments.join('/'),
          routerCanGoBack: router.canGoBack(),
        })
      }, 300)
    })
  }, [
    navigation,
    normalizedReturnTo,
    pathname,
    returnTo,
    router,
    segments,
    workoutId,
  ])

  // Early return for anonymous users (after all hooks)
  if (isAnonymous) return null

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          {/* Header */}
          <BaseNavbar
            leftContent={
              <NavbarIsland>
                <TouchableOpacity
                  onPress={handleBack}
                  style={styles.backButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={colors.textPrimary}
                  />
                </TouchableOpacity>
              </NavbarIsland>
            }
            centerContent={<Text style={styles.headerTitle}>Comments</Text>}
          />

          {/* Comments List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
          ) : (
            <FlatList
              data={flattenedComments}
              renderItem={renderComment}
              keyExtractor={(item) => item.comment.id}
              contentContainerStyle={styles.commentsList}
              ListEmptyComponent={renderEmptyState}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          )}

          <View
            style={[
              styles.inputContainer,
              {
                paddingBottom: isKeyboardVisible
                  ? 6
                  : Math.max(insets.bottom, 14),
              },
            ]}
          >
            <View style={styles.inputWrapper}>
              <LiquidGlassSurface
                style={styles.textInputGlass}
                debugLabel="comments-input"
              >
                <View style={styles.textInputContainer}>
                  <TextInput
                    ref={inputRef}
                    style={styles.inputField}
                    value={commentText}
                    onChangeText={handleCommentTextChange}
                    placeholder="Add a comment..."
                    placeholderTextColor={colors.textPlaceholder}
                    multiline
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={handlePostComment}
                    blurOnSubmit={false}
                    editable={!isPosting}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!commentText.trim() || isPosting) &&
                        styles.sendButtonDisabled,
                    ]}
                    onPress={handlePostComment}
                    disabled={!commentText.trim() || isPosting}
                  >
                    {isPosting ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.textPlaceholder}
                      />
                    ) : (
                      <Ionicons
                        name="arrow-up"
                        size={20}
                        color={colors.surface}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </LiquidGlassSurface>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    keyboardAvoid: {
      flex: 1,
    },
    backButton: {
      zIndex: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
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
    replyCommentItem: {
      marginBottom: 14,
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
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.surface,
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
      color: colors.textPrimary,
    },
    commentTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    commentText: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    commentActionsRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: 8,
    },
    replyActionText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    commentLikeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    commentLikeCount: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    commentLikeCountActive: {
      color: colors.brandPrimary,
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
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    textInputGlass: {
      flex: 1,
      borderRadius: 24,
      minHeight: 44,
    },
    textInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderRadius: 24,
      paddingRight: 4,
      paddingLeft: 16,
      paddingVertical: 4,
      minHeight: 44,
      borderWidth: 0,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    inputField: {
      flex: 1,
      paddingTop: Platform.OS === 'ios' ? 2 : 4,
      paddingBottom: Platform.OS === 'ios' ? 4 : 4,
      marginRight: 8,
      fontSize: 17,
      lineHeight: Platform.OS === 'ios' ? 26 : 23,
      color: colors.textPrimary,
      minHeight: Platform.OS === 'ios' ? 24 : 22,
      maxHeight: 100,
      textAlignVertical: Platform.OS === 'android' ? 'center' : 'auto',
      transform: [{ translateY: Platform.OS === 'ios' ? -2 : 0 }],
    },
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.brandPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 1,
    },
    sendButtonDisabled: {
      backgroundColor: colors.textPlaceholder,
      opacity: 0.5,
    },
  })
